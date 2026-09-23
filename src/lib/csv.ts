/**
 * CSV cell encoding for the comparer's "Export CSV" button. Pure and unit-tested — see the
 * compoundly audit-1 P2 finding: a raw `join(',')` let a comma in a scenario name shift every
 * column, and an unescaped leading `=`/`+`/`-`/`@` let a shared link (`?an=...`) plant a formula
 * that Excel/Sheets would evaluate on open.
 */

/**
 * RFC 4180-quote a CSV cell (wrap in double quotes, doubling any inner quote) whenever it contains
 * a comma, quote or newline, and neutralise spreadsheet formula injection by prefixing a leading
 * `= + - @` (or a leading tab/CR, which some spreadsheet apps also treat as a formula start) with
 * a literal-text apostrophe — the mitigation OWASP recommends for CSV export of untrusted strings.
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  // A plain negative number (e.g. "-286.76", from a negative-rate scenario's balance) is not a
  // formula and must round-trip as a number, not text — only prefix a leading "-" when the rest of
  // the cell isn't just digits/decimal point (audit-3 P3: '-286.76' broke the numeric column).
  const isPlainNumber = /^-?\d+(\.\d+)?$/.test(s);
  if (!isPlainNumber && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Join already-computed cells into one CSV row. */
export function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',');
}
