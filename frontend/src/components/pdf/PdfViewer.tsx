import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  FileText,
  Search,
  Plus,
  Minus,
  X,
  RotateCw,
  Download,
  Maximize2,
  Minimize2,
  Maximize,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Bookmark,
} from 'lucide-react';
import { findMatchingItemIndices } from '@/utils/quoteMatcher';
import type { Document as Doc, ContingencyClause } from '@/types';

// Configure pdfjs worker to use local bundled Vite worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface HighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

interface Props {
  fileUrl: string;
  filename?: string;
  initialPage?: number;
  highlightQuote?: string;
  jumpTrigger?: number;
  documents?: Doc[];
  selectedDocId?: string;
  onSelectDoc?: (docId: string) => void;
  onClearHighlight?: () => void;
  clauses?: ContingencyClause[];
  className?: string;
}

export function PdfViewer({
  fileUrl,
  filename = 'Document.pdf',
  initialPage = 1,
  highlightQuote,
  jumpTrigger,
  documents = [],
  selectedDocId,
  onSelectDoc,
  onClearHighlight,
  clauses = [],
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const isRenderingRef = useRef(false);
  const pendingRenderRef = useRef<{ page: number; scale: number; rotation: number } | null>(null);

  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasNode(node);
  }, []);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightBoxes, setHighlightBoxes] = useState<HighlightBox[]>([]);
  const [activeHighlightQuote, setActiveHighlightQuote] = useState<string | undefined>(highlightQuote);

  // In-document Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Fullscreen & Drawer State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showClauseDrawer, setShowClauseDrawer] = useState(false);

  // Update internal highlight quote if prop changes
  useEffect(() => {
    setActiveHighlightQuote(highlightQuote);
  }, [highlightQuote]);

  // Synchronize initialPage changes or jumpTrigger
  useEffect(() => {
    if (initialPage > 0) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, jumpTrigger]);

  // Auto-fit scale to available container width
  const fitToWidth = useCallback(
    async (doc?: pdfjsLib.PDFDocumentProxy, pageNum?: number) => {
      const targetDoc = doc || pdfDoc;
      const targetPageNum = pageNum || currentPage;
      const container = scrollContainerRef.current;
      if (!targetDoc || !container) return;

      const clientWidth = container.clientWidth;
      if (!clientWidth || clientWidth < 100) return;

      try {
        const page = await targetDoc.getPage(targetPageNum);
        const unscaledViewport = page.getViewport({ scale: 1, rotation });
        const availableWidth = clientWidth - 64; // 32px padding on each side

        if (availableWidth > 200 && unscaledViewport.width > 0) {
          const calculated = Math.min(2.2, Math.max(0.5, availableWidth / unscaledViewport.width));
          setScale(parseFloat(calculated.toFixed(2)));
        }
      } catch (e) {
        console.warn('Auto fitToWidth calculation failed:', e);
      }
    },
    [pdfDoc, currentPage, rotation]
  );

  // Automatic Quote Page Discovery:
  // When a highlight quote is set, ensure we are on the page containing the quote
  useEffect(() => {
    if (!pdfDoc || !activeHighlightQuote?.trim()) return;

    let isMounted = true;
    const cleanQuote = activeHighlightQuote.trim();

    async function findPageForQuote() {
      if (!pdfDoc) return;
      try {
        // 1. First check if the quote is already on the current page
        const curPageObj = await pdfDoc.getPage(currentPage);
        const curText = await curPageObj.getTextContent();
        const curMatches = findMatchingItemIndices(curText.items as any[], cleanQuote);
        if (curMatches.length > 0) return; // Already on the matching page!

        // 2. Scan all other pages in the PDF
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          if (p === currentPage) continue;
          const pageObj = await pdfDoc.getPage(p);
          const text = await pageObj.getTextContent();
          const matches = findMatchingItemIndices(text.items as any[], cleanQuote);
          if (matches.length > 0 && isMounted) {
            setCurrentPage(p);
            return;
          }
        }
      } catch (err) {
        console.warn('Auto-jump to quote page lookup failed:', err);
      }
    }

    findPageForQuote();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc, activeHighlightQuote, jumpTrigger]);

  // Smooth Auto-Scroll to highlighted clause
  useEffect(() => {
    if (highlightBoxes.length > 0 && scrollContainerRef.current) {
      const firstBox = highlightBoxes[0];
      const container = scrollContainerRef.current;
      const targetScrollTop = Math.max(0, firstBox.top - container.clientHeight / 3);
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
  }, [highlightBoxes]);

  // Load PDF Document
  useEffect(() => {
    if (!fileUrl) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setPdfDoc(null);

    const loadingTask = pdfjsLib.getDocument({
      url: fileUrl,
      cMapPacked: true,
    });

    loadingTask.promise
      .then((pdf) => {
        if (!isMounted) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        const startPage = Math.min(initialPage, pdf.numPages);
        setCurrentPage(startPage);
        setLoading(false);

        // Auto-fit initial scale nicely
        setTimeout(() => {
          fitToWidth(pdf, startPage);
        }, 100);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('PDF loading error:', err);
        setError('Failed to load PDF document. Please verify your connection.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      loadingTask.destroy().catch(() => {});
    };
  }, [fileUrl]);

  // Robust, queue-based page render function that eliminates race conditions and worker conflicts
  const renderPage = useCallback(
    async (pageNum: number, currentScale: number, currentRotation: number) => {
      const canvas = canvasRef.current;
      if (!pdfDoc || !canvas) return;

      // If already rendering, store latest requested params and request cancellation of in-flight task
      if (isRenderingRef.current) {
        pendingRenderRef.current = { page: pageNum, scale: currentScale, rotation: currentRotation };
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }
        return;
      }

      isRenderingRef.current = true;
      setRendering(true);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const effectiveRotation = (page.rotate + currentRotation) % 360;
        const viewport = page.getViewport({ scale: currentScale, rotation: effectiveRotation });

        // Maintain document dimensions on card wrapper to prevent layout shift
        setViewportSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });

        const context = canvas.getContext('2d');
        if (!context) {
          isRenderingRef.current = false;
          setRendering(false);
          return;
        }

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });
        renderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
        } catch (renderErr: any) {
          if (renderErr?.name !== 'RenderingCancelledException') {
            console.warn('PDF page render task error:', renderErr);
          }
        }
        renderTaskRef.current = null;

        // Extract text items with exact geometry for search and citation highlighting
        const textContent = await page.getTextContent();
        const targetSearch = searchQuery.trim()
          ? searchQuery.trim()
          : activeHighlightQuote
          ? activeHighlightQuote.trim()
          : '';

        const boxes: HighlightBox[] = [];
        if (targetSearch) {
          const matchedIndices = findMatchingItemIndices(textContent.items as any[], targetSearch);
          const matchedSet = new Set(matchedIndices);

          (textContent.items as any[]).forEach((item, itemIdx) => {
            if (!('str' in item) || !item.str) return;
            if (!matchedSet.has(itemIdx)) return;

            const tx = item.transform[4];
            const ty = item.transform[5];
            const tw = item.width || 30;
            const th = item.height || 12;

            const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
              tx,
              ty,
              tx + tw,
              ty + th,
            ]);

            const left = Math.min(vx1, vx2);
            const top = Math.min(vy1, vy2);
            const width = Math.max(Math.abs(vx2 - vx1), 8);
            const height = Math.max(Math.abs(vy2 - vy1), 12);

            boxes.push({ left, top, width, height, text: item.str });
          });
        }

        setHighlightBoxes(boxes);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Page render execution error:', err);
        }
      } finally {
        isRenderingRef.current = false;
        setRendering(false);

        // If a new render request was queued while rendering/cancelling, execute it now
        if (pendingRenderRef.current) {
          const next = pendingRenderRef.current;
          pendingRenderRef.current = null;
          renderPage(next.page, next.scale, next.rotation);
        }
      }
    },
    [pdfDoc, searchQuery, activeHighlightQuote]
  );

  // Trigger page rendering whenever document, mounted canvas, page, scale or rotation changes
  useEffect(() => {
    if (pdfDoc && canvasNode) {
      renderPage(currentPage, scale, rotation);
    }
  }, [pdfDoc, canvasNode, currentPage, scale, rotation, renderPage]);

  // Fullscreen transition handler: recompute optimal fit to width for reader mode after portal layout
  useEffect(() => {
    if (!pdfDoc) return;
    const timer = setTimeout(() => {
      fitToWidth();
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen, fitToWidth, pdfDoc]);

  // Press Escape to exit fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Document-wide text search handler
  const handleSearch = async (term: string) => {
    setSearchQuery(term);
    if (!pdfDoc || !term.trim()) {
      setSearchResults([]);
      return;
    }

    const matches: number[] = [];
    const lowerTerm = term.toLowerCase().trim();

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const text = await page.getTextContent();
      const str = text.items.map((it: any) => ('str' in it ? it.str : '')).join(' ');
      if (str.toLowerCase().includes(lowerTerm)) {
        matches.push(p);
      }
    }

    setSearchResults(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      setCurrentPage(matches[0]);
    }
  };

  const nextSearchMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    setCurrentPage(searchResults[nextIdx]);
  };

  const prevSearchMatch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    setCurrentPage(searchResults[prevIdx]);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage(currentPage + 1);
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleDownload = () => {
    if (!fileUrl) return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleJumpToClause = (clause: ContingencyClause) => {
    if (clause.pageNumber) {
      setCurrentPage(clause.pageNumber);
    }
    setActiveHighlightQuote(clause.rawText);
  };

  const handleClearHighlightInternal = () => {
    setActiveHighlightQuote(undefined);
    if (onClearHighlight) onClearHighlight();
  };

  // Main Viewer Content Layout
  const viewerContent = (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-slate-50 border border-slate-200/90 rounded-2xl overflow-hidden shadow-xl relative ${
        isFullscreen ? 'w-full h-full rounded-none border-none' : className
      }`}
    >
      {/* ── Executive Top Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-white border-b border-slate-200 text-xs text-slate-800 select-none shadow-2xs z-20">
        {/* Document Switcher & Info */}
        <div className="flex items-center gap-2 max-w-sm truncate">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shadow-2xs shrink-0 border border-emerald-200">
            <FileText className="h-3.5 w-3.5" />
          </div>

          {documents.length > 1 && onSelectDoc ? (
            <select
              value={selectedDocId}
              onChange={(e) => onSelectDoc(e.target.value)}
              className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold focus:border-slate-900 focus:outline-none truncate cursor-pointer shadow-2xs"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id} className="bg-white text-slate-900">
                  {d.filename}
                </option>
              ))}
            </select>
          ) : (
            <div className="truncate">
              <span className="font-bold text-slate-900 truncate block text-xs" title={filename}>
                {filename}
              </span>
            </div>
          )}

          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            {numPages || 1} Pages
          </span>

          {clauses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClauseDrawer(!showClauseDrawer)}
              className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold text-xs transition-colors cursor-pointer border ${
                showClauseDrawer
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Toggle Clauses Navigator"
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
              <span>Clauses ({clauses.length})</span>
            </button>
          )}
        </div>

        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 transition-all cursor-pointer shadow-2xs"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">Page</span>
            <span className="text-xs font-bold font-mono text-slate-900 px-1 py-0.5 bg-slate-100 rounded border border-slate-200">
              {currentPage}
            </span>
            <span className="text-[11px] text-slate-500">of {numPages || 1}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || loading}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 transition-all cursor-pointer shadow-2xs"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Viewing, Zoom & Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Document Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
              showSearch || searchQuery
                ? 'bg-[#0A0A0A] text-white border-black shadow-xs font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border-slate-200 shadow-2xs'
            }`}
            title="Search in document"
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Fit to Width Button */}
          <button
            type="button"
            onClick={() => fitToWidth()}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Fit to Width"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))))}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setScale(1.0)}
              className="font-mono text-[11px] font-bold text-slate-900 px-1.5 hover:text-emerald-700 cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, parseFloat((s + 0.1).toFixed(2))))}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
              title="Zoom In"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Rotate Clockwise */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Rotate Page Clockwise"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Download PDF Agreement"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Fullscreen Modal Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Open Fullscreen Reader'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── In-Document Search Bar ── */}
      {showSearch && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs z-10">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search contract terms (e.g. earnest, inspection)..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
              autoFocus
            />
          </div>

          {searchResults.length > 0 && (
            <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
              <span>
                Page {searchResults[currentMatchIndex]} ({currentMatchIndex + 1} of {searchResults.length} matches)
              </span>
              <button
                type="button"
                onClick={prevSearchMatch}
                className="p-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                title="Previous Match"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={nextSearchMatch}
                className="p-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                title="Next Match"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Active Citation Highlight Banner ── */}
      {activeHighlightQuote && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200/90 flex items-center justify-between gap-3 text-xs z-10 shadow-2xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 shrink-0 mt-0.5 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-emerald-950 text-[10px] uppercase tracking-wider block">
                Active Grounded Citation Highlight
              </span>
              <p className="font-mono text-slate-800 text-[11px] truncate max-w-xl">
                &ldquo;{activeHighlightQuote}&rdquo;
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearHighlightInternal}
            className="p-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
            title="Clear Highlight"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Main Viewport Area (Split with Clause Drawer) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Clause Navigator Drawer */}
        {showClauseDrawer && clauses.length > 0 && (
          <div className="w-64 sm:w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-sm">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-emerald-700" />
                Indexed Clauses ({clauses.length})
              </span>
              <button
                type="button"
                onClick={() => setShowClauseDrawer(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
              {clauses.map((clause, idx) => (
                <div
                  key={clause.id || idx}
                  onClick={() => handleJumpToClause(clause)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    currentPage === clause.pageNumber
                      ? 'border-emerald-700 bg-emerald-50/70 shadow-2xs'
                      : 'border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      {clause.clauseType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.2 rounded border border-emerald-200">
                      Pg {clause.pageNumber || 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 font-mono leading-relaxed">
                    {clause.rawText}
                  </p>
                  {clause.numberOfDays && (
                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      Timeline: {clause.numberOfDays} {clause.dayType || 'calendar'} days
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Document Desk Viewport Canvas ── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto p-6 sm:p-8 flex items-start justify-center relative bg-[#ECEEF1] shadow-inner select-text"
        >
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500 text-xs py-20">
              <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
              <span className="font-bold text-slate-900">Rendering contractual document&hellip;</span>
              <span className="text-[11px] text-slate-500">Parsing vector layers, text bounds &amp; OCR signatures</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-2 text-rose-700 text-xs max-w-sm text-center py-16 bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-sm">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            <div
              className="relative shadow-[0_12px_40px_-8px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.06)] rounded-sm bg-white ring-1 ring-slate-900/10 border border-slate-300/80 my-auto transition-all duration-150"
              style={{
                minWidth: viewportSize ? `${viewportSize.width}px` : undefined,
                minHeight: viewportSize ? `${viewportSize.height}px` : undefined,
              }}
            >
              <canvas ref={setCanvasRef} className="block rounded-sm" />

              {/* In-Situ Statutory Citation Highlighter Overlay */}
              {highlightBoxes.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {highlightBoxes.map((box, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${box.left}px`,
                        top: `${box.top}px`,
                        width: `${box.width}px`,
                        height: `${box.height}px`,
                      }}
                      className="bg-amber-300/40 border-b-2 border-emerald-700 ring-2 ring-emerald-600/30 rounded-xs shadow-xs"
                      title={box.text}
                    />
                  ))}
                </div>
              )}

              {rendering && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-sm">
                  <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 flex flex-col">
        {viewerContent}
      </div>,
      document.body
    );
  }

  return viewerContent;
}
