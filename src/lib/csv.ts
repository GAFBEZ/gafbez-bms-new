/**
 * Client-side only (Blob/URL/document) -- call from a Client Component.
 * Builds the CSV from data already loaded in the browser (the filtered
 * rows the user is currently looking at), so exporting needs no extra
 * request and always matches what's on screen.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const escape = (value: string | number): string => {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
