import type { DataRecord } from "./types";

/** Minimal RFC-4180-style CSV parser: quotes, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const REQUIRED = ["id", "name", "email", "phone", "last_login", "status", "created_at"] as const;

export function recordsFromCsv(text: string): DataRecord[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  for (const col of REQUIRED) {
    if (idx(col) === -1) throw new Error(`Missing required column: ${col}`);
  }
  const loginIdx = idx("login_count");
  return rows.slice(1).map((cells) => {
    const get = (name: string) => (cells[idx(name)] ?? "").trim();
    const rawLogin = loginIdx >= 0 ? (cells[loginIdx] ?? "").trim() : "";
    const parsed = rawLogin === "" ? 0 : Number(rawLogin);
    return {
      id: get("id"),
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      last_login: get("last_login"),
      status: get("status").toLowerCase(),
      created_at: get("created_at"),
      login_count: Number.isNaN(parsed) ? 0 : parsed,
    };
  });
}

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function recordsToCsv(records: DataRecord[]): string {
  const head = "id,name,email,phone,last_login,status,created_at,login_count";
  const lines = records.map((r) =>
    [r.id, r.name, r.email, r.phone, r.last_login, r.status, r.created_at, r.login_count]
      .map(esc)
      .join(","),
  );
  return [head, ...lines].join("\n") + "\n";
}
