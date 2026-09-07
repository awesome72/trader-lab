// Small RFC4180-ish CSV parser for docs/SPEC.md Phase 10-4's broker CSV
// import. Lives at lib/ (not lib/domain/) since it's a generic text-parsing
// utility, not a trading calculation — same shelf as lib/utils.ts/labels.ts.
// Handles quoted fields, escaped quotes (""), commas/newlines inside quotes,
// and both \n and \r\n line endings.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const [headers, ...dataRows] = nonEmptyRows;
  return { headers: headers ?? [], rows: dataRows };
}

// Inverse of parseCsv, for data export (docs/SPEC.md-style "내 데이터" CSV
// download). Quotes any field containing a comma, quote, or newline, and
// doubles up embedded quotes — same escaping rules parseCsv already reads.
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(cell === null || cell === undefined ? "" : String(cell))).join(",")
  );
  return lines.join("\r\n");
}
