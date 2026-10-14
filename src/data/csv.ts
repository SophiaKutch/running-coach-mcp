/**
 * Minimal RFC 4180-style CSV parser: comma-separated fields, double-quoted
 * fields (needed for Strava's "Apr 13, 2026, 6:30:00 AM" date column, which
 * contains commas), `""` as an escaped quote inside a quoted field, and
 * quoted fields that span multiple lines.
 *
 * This project deliberately hand-rolls this instead of pulling in a CSV
 * library: Strava's bulk-export format is simple enough that a ~40-line
 * parser covers it, and it keeps the data layer dependency-free. A CSV
 * export with embedded raw newlines outside of quotes, or encodings other
 * than UTF-8, is out of scope — if you hit one, reach for a real library
 * instead of extending this.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const header = rows[0]!.map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 1 && row[0] === "") continue; // trailing blank line
    const record: Record<string, string> = {};
    header.forEach((key, col) => {
      record[key] = (row[col] ?? "").trim();
    });
    records.push(record);
  }
  return records;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Normalize line endings so \r\n in quoted fields doesn't produce stray \r.
  const input = text.replace(/\r\n/g, "\n");

  while (i < input.length) {
    const char = input[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }

  // Final field/row (files not ending in a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
