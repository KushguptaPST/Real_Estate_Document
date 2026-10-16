import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  FileText,
  Sparkles,
  Search,
  Plus,
  Minus,
  X,
} from 'lucide-react';
import { findQuoteInPage, findMatchingItemIndices } from '@/utils/quoteMatcher';
import type { Document as Doc } from '@/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

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
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setQuoteMatched] = useState<boolean | null>(null);
  const [, setPageText] = useState('');
  const [highlightBoxes, setHighlightBoxes] = useState<HighlightBox[]>([]);

  // In-document Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Synchronize initialPage changes or jumpTrigger
  useEffect(() => {
    if (initialPage > 0) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, jumpTrigger]);

  // Automatic Quote Page Discovery:
  // When a highlight quote is set, ensure we are on the page containing the quote
  useEffect(() => {
    if (!pdfDoc || !highlightQuote?.trim()) return;

    let isMounted = true;
    const cleanQuote = highlightQuote.trim();

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
  }, [pdfDoc, highlightQuote, jumpTrigger]);

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
        setCurrentPage(Math.min(initialPage, pdf.numPages));
        setLoading(false);
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

  // Render current page to canvas & compute in-situ highlight bounding boxes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;
    setRendering(true);
    setHighlightBoxes([]);

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {}
      renderTaskRef.current = null;
    }

    pdfDoc
      .getPage(currentPage)
      .then(async (page) => {
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
        } catch (renderErr: any) {
          if (renderErr?.name === 'RenderingCancelledException') return;
          throw renderErr;
        }

        if (isCancelled) return;

        // Extract text items with exact geometry
        const textContent = await page.getTextContent();
        const extracted = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        setPageText(extracted);

        const targetSearch = searchQuery.trim()
          ? searchQuery.trim()
          : highlightQuote
          ? highlightQuote.trim()
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

        if (highlightQuote) {
          const matchResult = findQuoteInPage(highlightQuote, extracted);
          setQuoteMatched(matchResult.isMatched);
        } else {
          setQuoteMatched(null);
        }

        setRendering(false);
      })
      .catch((err) => {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.warn('Page render error:', err);
          setRendering(false);
        }
      });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, scale, highlightQuote, searchQuery]);

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

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-[#101014] border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#16161D] border-b border-white/10 text-xs text-[#F5F5F7] select-none backdrop-blur-md">
        {/* Document Switcher & Info */}
        <div className="flex items-center gap-2 max-w-xs truncate">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#1E1E26] text-[#C9A961] shadow-sm shrink-0 border border-white/10">
            <FileText className="h-3.5 w-3.5 text-[#C9A961]" />
          </div>
          {documents.length > 1 && onSelectDoc ? (
            <select
              value={selectedDocId}
              onChange={(e) => onSelectDoc(e.target.value)}
              className="bg-[#1A1A22] text-[#F5F5F7] border border-white/10 rounded-xl px-2.5 py-1 text-xs font-semibold focus:border-[#C9A961] focus:outline-none truncate cursor-pointer shadow-sm"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#141418] text-[#F5F5F7]">
                  {d.filename}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-[#F5F5F7] truncate" title={filename}>
              {filename}
            </span>
          )}
        </div>

        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 rounded-xl bg-[#1A1A22] border border-white/10 text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-[#C9A961]/40 disabled:opacity-30 transition-all cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1 bg-[#1A1A22] border border-white/10 px-2.5 py-1 rounded-xl shadow-sm">
            <span className="text-[11px] font-medium text-[#9A9AA5]">Page</span>
            <span className="text-[11px] font-bold font-mono text-[#F5F5F7] px-0.5">
              {currentPage}
            </span>
            <span className="text-[11px] text-[#6E6E7A]">of {numPages || 1}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || loading}
            className="p-1.5 rounded-xl bg-[#1A1A22] border border-white/10 text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-[#C9A961]/40 disabled:opacity-30 transition-all cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Document Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              showSearch || searchQuery
                ? 'bg-[#C9A961] text-[#0A0A0B] shadow-sm font-bold'
                : 'bg-[#1A1A22] hover:bg-[#22222E] text-[#9A9AA5] hover:text-[#F5F5F7] border border-white/10'
            }`}
            title="Search in document"
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 bg-[#1A1A22] border border-white/10 rounded-xl p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              className="p-1 rounded-lg hover:bg-white/5 text-[#9A9AA5] hover:text-[#F5F5F7] cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="font-mono text-[11px] font-semibold text-[#F5F5F7] px-1.5">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="p-1 rounded-lg hover:bg-white/5 text-[#9A9AA5] hover:text-[#F5F5F7] cursor-pointer"
              title="Zoom In"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* In-Document Search Bar */}
      {showSearch && (
        <div className="px-4 py-2.5 bg-[#14141A] border-b border-white/10 flex items-center justify-between gap-3 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-[#C9A961] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search contract terms..."
              className="w-full bg-[#0E0E12] border border-white/10 rounded-xl px-3 py-1.5 text-[#F5F5F7] text-xs placeholder-[#5E5E6C] focus:outline-none focus:border-[#C9A961] shadow-inner"
              autoFocus
            />
          </div>

          {searchResults.length > 0 && (
            <div className="flex items-center gap-2 text-[#9A9AA5]">
              <span className="text-[11px] font-medium">
                Page {searchResults[currentMatchIndex]} ({currentMatchIndex + 1} of {searchResults.length} matches)
              </span>
              <button
                type="button"
                onClick={prevSearchMatch}
                className="p-1 rounded-lg bg-[#1A1A22] border border-white/10 text-[#F5F5F7] cursor-pointer hover:border-[#C9A961]/40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={nextSearchMatch}
                className="p-1 rounded-lg bg-[#1A1A22] border border-white/10 text-[#F5F5F7] cursor-pointer hover:border-[#C9A961]/40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Citation Highlight Focus Banner */}
      {highlightQuote && (
        <div className="px-4 py-2.5 bg-[#1C170E]/95 border-b border-[#C9A961]/30 flex items-center justify-between gap-3 text-xs backdrop-blur-md">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C9A961]/20 text-[#C9A961] shrink-0 mt-0.5 border border-[#C9A961]/30 shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#E8C575] text-[10px] uppercase tracking-wider">
                  Active Citation Reference
                </span>
                {highlightBoxes.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A961]/20 border border-[#C9A961]/40 px-2 py-0.5 text-[9px] font-semibold text-[#E8C575]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] animate-pulse" />
                    In-Situ Highlighted
                  </span>
                )}
              </div>
              <p className="font-mono text-[#F5F5F7] text-[11px] mt-0.5 italic line-clamp-2">
                &ldquo;{highlightQuote}&rdquo;
              </p>
            </div>
          </div>

          {onClearHighlight && (
            <button
              type="button"
              onClick={onClearHighlight}
              className="p-1 rounded-lg bg-white/5 border border-white/10 text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-[#C9A961]/40 transition-colors cursor-pointer"
              title="Clear Highlight"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Document Viewport */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-[#0C0C10] shadow-inner"
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 text-[#9A9AA5] text-xs py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#C9A961]" />
            <span className="font-medium text-[#F5F5F7]">Rendering contractual document&hellip;</span>
            <span className="text-[11px] text-[#6E6E7A]">Parsing vector layers and annotations</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 text-rose-400 text-xs max-w-sm text-center py-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {!loading && !error && pdfDoc && (
          <div className="relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] rounded-xl bg-white ring-1 ring-white/15 transition-transform duration-150">
            <canvas ref={canvasRef} className="block rounded-xl" />

            {/* In-Situ Highlighter Overlay */}
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
                    className="bg-[#C9A961]/35 border-b-2 border-[#C9A961] rounded-xs ring-1 ring-[#C9A961]/50 shadow-sm"
                    title={box.text}
                  />
                ))}
              </div>
            )}

            {rendering && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-[#C9A961]" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
