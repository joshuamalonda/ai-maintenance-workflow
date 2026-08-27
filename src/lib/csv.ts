// Dependency-free CSV helpers. Safe to import from client and server.

/** Parses RFC4180-style CSV text into rows of raw string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip BOM
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function escapeCell(value: string | null | undefined): string {
  const v = value ?? "";
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(header: string[], rows: Array<Array<string | null | undefined>>): string {
  return [header.join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
}

export const PROPERTY_IMPORT_COLUMNS = [
  "property_address",
  "postcode",
  "tenant_name",
  "tenant_phone",
  "landlord_name",
  "landlord_phone",
] as const;

export type PropertyImportColumn = (typeof PROPERTY_IMPORT_COLUMNS)[number];

export const PROPERTY_IMPORT_TEMPLATE = toCsv(
  [...PROPERTY_IMPORT_COLUMNS],
  [
    ["12 Arundel Street, London", "SW1A 1AA", "Jane Smith", "07700 900123", "Paul Owner", "07700 900456"],
    ["Flat 3, 90 High Road, Leeds", "LS1 4AB", "Tom Ford", "07700 900789", "Acme Holdings", ""],
  ],
);

/** Downloads a CSV string as a file in the browser. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
