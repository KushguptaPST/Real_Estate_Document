import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { leadsApi, propertiesApi } from '@/services/api';
import { useToast } from '@/context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (count: number) => void;
  title?: string;
  type?: 'leads' | 'properties' | string;
}

interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  summaryLabel: string;
  subLabel: string;
  error?: string;
}

/**
 * RFC-4180 aware CSV line parser handling quoted fields and escaped quotes.
 */
function parseCsvText(rawText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const cleanText = rawText.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"' && cleanText[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && cleanText[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapCsvToRows(rawText: string, mode: 'leads' | 'properties'): ParsedRow[] {
  const matrix = parseCsvText(rawText);
  if (matrix.length < 2) return [];

  const headers = matrix[0].map(normalizeHeader);
  const pick = (cells: string[], aliases: string[]) => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1 && cells[idx]) return cells[idx].trim();
    }
    return '';
  };

  return matrix.slice(1).map((cells, idx) => {
    const rowNumber = idx + 2;
    if (mode === 'properties') {
      const title = pick(cells, ['title', 'listingtitle', 'property', 'project', 'name']);
      const address = pick(cells, ['address', 'streetaddress', 'location', 'micromarket']);
      const city = pick(cells, ['city', 'locality']);
      const priceRaw = pick(cells, ['price', 'askingprice', 'priceinr']).replace(/[^0-9.]/g, '');
      const price = Number(priceRaw);
      const bedroomsRaw = pick(cells, ['bedrooms', 'bhk', 'beds']).replace(/[^0-9]/g, '');
      const bathroomsRaw = pick(cells, ['bathrooms', 'baths']).replace(/[^0-9.]/g, '');
      const propertyType = pick(cells, ['propertytype', 'type']) || 'APARTMENT';
      const microMarket = pick(cells, ['micromarket', 'area']);
      const builderName = pick(cells, ['buildername', 'builder', 'developer']);
      const reraNumber = pick(cells, ['reranumber', 'rera']);
      const brochureUrl = pick(cells, ['brochureurl', 'brochure', 'pdfurl']);

      let error: string | undefined;
      if (!title) error = 'Missing title';
      else if (!address) error = 'Missing address';
      else if (!city) error = 'Missing city';
      else if (!price || price <= 0) error = 'Invalid price';

      return {
        rowNumber,
        data: {
          title,
          address,
          city,
          microMarket: microMarket || undefined,
          builderName: builderName || undefined,
          reraNumber: reraNumber || undefined,
          price,
          bedrooms: bedroomsRaw ? Number(bedroomsRaw) : 2,
          bathrooms: bathroomsRaw ? Number(bathroomsRaw) : 2,
          propertyType,
          brochureUrl: brochureUrl || undefined,
        },
        summaryLabel: title || '(Untitled Listing)',
        subLabel: `${city || '—'} • ₹${price > 0 ? price.toLocaleString('en-IN') : '—'} • ${propertyType}`,
        error,
      };
    }

    const fullName = pick(cells, ['fullname', 'name', 'buyer', 'buyername', 'leadname']);
    const phone = pick(cells, ['phone', 'mobile', 'phonenumber', 'contact']);
    const email = pick(cells, ['email', 'emailaddress']);
    const enquiryText = pick(cells, ['enquirytext', 'enquiry', 'notes', 'requirements', 'message']);

    let error: string | undefined;
    if (!fullName) error = 'Missing fullName';
    else if (!phone && !email) error = 'Phone or email required';

    return {
      rowNumber,
      data: { fullName, phone, email, enquiryText },
      summaryLabel: fullName || '(No Name)',
      subLabel: phone || email || 'No contact',
      error,
    };
  });
}

export function CsvImportModal({ isOpen, onClose, onImportSuccess, title, type = 'leads' }: Props) {
  const { toast } = useToast();
  const mode: 'leads' | 'properties' = type === 'properties' ? 'properties' : 'leads';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; skippedCount: number; errors: Array<{ row: number; reason: string }> } | null>(null);

  if (!isOpen) return null;

  const displayTitle = title || (mode === 'properties' ? 'Import Properties CSV' : 'Import Leads CSV');
  const validRows = parsedRows.filter((r) => !r.error);
  const invalidCount = parsedRows.length - validRows.length;

  const handleClose = () => {
    setFileName('');
    setParsedRows([]);
    setResult(null);
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      mode === 'properties'
        ? 'title,address,city,microMarket,price,bedrooms,bathrooms,propertyType,builderName,reraNumber\nEmerald Tower 3BHK,ITPL Main Rd,Bengaluru,Whitefield,18500000,3,2,APARTMENT,Emerald Builders,PRM/KA/RERA/1251/446\n'
        : 'fullName,phone,email,enquiryText\nAarav Sharma,+919876543210,aarav@example.com,Looking for 3BHK in Whitefield under 2 Cr\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = mode === 'properties' ? 'properties_template.csv' : 'leads_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFilePicked = async (file?: File | null) => {
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const rows = mapCsvToRows(text, mode);
    if (rows.length === 0) {
      toast.error('Empty CSV file', 'Make sure the CSV has a header row and at least 1 data row.');
      setParsedRows([]);
      return;
    }
    setParsedRows(rows);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    try {
      setImporting(true);
      const payloadRows = validRows.map((r) => r.data);
      const res =
        mode === 'properties'
          ? await propertiesApi.importCsv(payloadRows)
          : await leadsApi.importCsv(payloadRows);

      setResult(res);
      toast.success(
        'CSV Import Completed',
        `Imported ${res.importedCount} ${mode}${res.skippedCount > 0 ? `, skipped ${res.skippedCount}` : ''}.`,
      );
      if (res.importedCount > 0) {
        onImportSuccess?.(res.importedCount);
      }
    } catch (err: any) {
      toast.error('CSV Import Failed', err.message || 'Could not import CSV rows');
    } finally {
      setImporting(false);
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-xl shadow-2xl space-y-5 my-auto relative">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" /> {displayTitle}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Upload a `.csv` spreadsheet, review parsed rows, and import directly into your workspace.
            </p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            void handleFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs">
          <div className="text-slate-600">
            <span className="font-semibold text-slate-900 block">
              {mode === 'properties'
                ? 'Required: title, address, city, price'
                : 'Required: fullName + (phone or email)'}
            </span>
            <span className="text-[11px] text-slate-500">Up to 500 rows per upload</span>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs cursor-pointer shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-emerald-700" />
            <span>Sample CSV</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-100/70 py-6 px-4 text-center transition-colors cursor-pointer space-y-1.5"
        >
          <Upload className="h-6 w-6 text-slate-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-800">
            {fileName ? `Selected: ${fileName}` : 'Choose a .csv file to preview & validate'}
          </p>
          <p className="text-[11px] text-slate-500">Click to browse from your computer</p>
        </button>

        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">
                Preview ({parsedRows.length} rows)
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
                  {validRows.length} Valid
                </span>
                {invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[11px]">
                    {invalidCount} Skipped
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
              {parsedRows.slice(0, 50).map((r) => (
                <div key={r.rowNumber} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      #{r.rowNumber}: {r.summaryLabel}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{r.subLabel}</p>
                  </div>
                  {r.error ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {r.error}
                    </span>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Imported {result.importedCount} {mode === 'properties' ? 'properties' : 'leads'}
              </p>
              {result.skippedCount > 0 && (
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  {result.skippedCount} rows skipped due to validation or duplicate constraints.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 text-xs transition-colors cursor-pointer"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={validRows.length === 0 || importing}
            onClick={handleImport}
            className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {importing
                ? 'Importing...'
                : validRows.length > 0
                ? `Import ${validRows.length} Valid Rows`
                : 'Select CSV First'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
