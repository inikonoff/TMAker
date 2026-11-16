// Песочница данных для режима «Запустить»: записи таблиц живут в браузере.
import type { Binding, Field, Table } from "./model";

export type Row = Record<string, string | number | boolean | null> & { _id: string; _at: number };
export type SandboxData = Record<string, Row[]>;

export function coerce(field: Field, raw: string | boolean): string | number | boolean | null {
  if (field.type === "boolean") return typeof raw === "boolean" ? raw : raw === "true" || raw === "1";
  if (typeof raw !== "string") return null;
  if (field.type === "number") {
    const n = Number(raw.replace(",", "."));
    return raw.trim() === "" || !Number.isFinite(n) ? null : n;
  }
  return raw.trim() === "" ? null : raw.trim();
}

export function validateRow(table: Table, values: Record<string, string | boolean>): { ok: true; row: Omit<Row, "_id" | "_at"> } | { ok: false; error: string } {
  const row: Record<string, string | number | boolean | null> = {};
  for (const f of table.fields) {
    const v = coerce(f, values[f.name] ?? (f.type === "boolean" ? false : ""));
    if (f.required && (v === null || v === "")) return { ok: false, error: `Заполните поле «${f.name}»` };
    if (f.type === "number" && values[f.name] !== undefined && values[f.name] !== "" && v === null)
      return { ok: false, error: `«${f.name}» — нужно число` };
    row[f.name] = v;
  }
  return { ok: true, row };
}

export function addRow(data: SandboxData, table: string, row: Omit<Row, "_id" | "_at">, id: string, at = Date.now()): SandboxData {
  return { ...data, [table]: [...(data[table] ?? []), { ...row, _id: id, _at: at } as Row] };
}

export function removeRow(data: SandboxData, table: string, id: string): SandboxData {
  return { ...data, [table]: (data[table] ?? []).filter((r) => r._id !== id) };
}

/** Поле для показа строки: заданное в привязке или первое текстовое. */
export function displayField(table: Table, bind: Binding): string | undefined {
  if (bind.field && table.fields.some((f) => f.name === bind.field)) return bind.field;
  return (table.fields.find((f) => f.type === "text") ?? table.fields[0])?.name;
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  return String(v);
}

/** Строки списка, привязанного к таблице. Новые сверху. */
export function listRows(data: SandboxData, table: Table, bind: Binding): string[] {
  const f = displayField(table, bind);
  return [...(data[table.name] ?? [])].reverse().map((r) => formatValue(f ? r[f] : r._id));
}

/** Одиночное значение: поле последней записи или число записей. */
export function singleValue(data: SandboxData, table: Table, bind: Binding): string {
  const rows = data[table.name] ?? [];
  if (!bind.field) return String(rows.length);
  const last = rows[rows.length - 1];
  return last ? formatValue(last[bind.field]) : "—";
}

export function parseSandbox(raw: unknown): SandboxData {
  if (typeof raw !== "object" || raw === null) return {};
  const out: SandboxData = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!Array.isArray(v)) continue;
    out[k] = v.filter((r): r is Row => typeof r === "object" && r !== null && typeof (r as Row)._id === "string");
  }
  return out;
}
