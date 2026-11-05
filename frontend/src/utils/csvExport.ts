/**
 * Robust, client-side CSV export utility.
 * Prepends UTF-8 BOM (\uFEFF) so Excel/Numbers automatically recognize characters properly.
 */

export interface CsvColumn<T = any> {
  key: string;
  label: string;
  format?: (value: any, row: T) => string | number | null | undefined;
}

function escapeCsvCell(cell: any): string {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns?: CsvColumn<T>[]
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No data available to export');
  }

  const cols: CsvColumn<T>[] =
    columns ||
    Object.keys(rows[0] || {}).map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    }));

  const headerLine = cols.map((col) => escapeCsvCell(col.label)).join(',');

  const dataLines = rows.map((row) =>
    cols
      .map((col) => {
        const rawVal = row[col.key];
        const formatted = col.format ? col.format(rawVal, row) : rawVal;
        return escapeCsvCell(formatted);
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
