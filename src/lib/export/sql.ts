// Схема данных → SQL-миграция и схема Drizzle (SQLite или Postgres).
import type { Field, Table } from "../model";
import { slug } from "./prompt";

export type Dialect = "sqlite" | "postgres";

/** Безопасный идентификатор: латиница, цифры, подчёркивания. */
export function ident(name: string, fallback = "t"): string {
  const s = slug(name, fallback).replace(/-/g, "_");
  return /^[a-z_]/.test(s) ? s : `_${s}`;
}

export function camel(name: string): string {
  return ident(name).replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Уникальные имена таблиц и полей после транслитерации. */
export function normalizeTables(tables: Table[]): { table: Table; sqlName: string; fields: { field: Field; sqlName: string }[] }[] {
  const used = new Set<string>();
  const uniq = (base: string, set: Set<string>) => {
    let n = base;
    let i = 2;
    while (set.has(n)) n = `${base}_${i++}`;
    set.add(n);
    return n;
  };
  return tables.map((t) => {
    const sqlName = uniq(ident(t.name, "table"), used);
    const fu = new Set(["id", "user_id", "created_at"]);
    return { table: t, sqlName, fields: t.fields.map((f) => ({ field: f, sqlName: uniq(ident(f.name, "field"), fu) })) };
  });
}

function sqlType(f: Field, d: Dialect): string {
  switch (f.type) {
    case "number":
      return d === "sqlite" ? "REAL" : "DOUBLE PRECISION";
    case "boolean":
      return d === "sqlite" ? "INTEGER" : "BOOLEAN";
    case "ref":
      return "INTEGER";
    default:
      return "TEXT";
  }
}

export function migrationSql(tables: Table[], d: Dialect): string {
  const norm = normalizeTables(tables);
  const byName = new Map(norm.map((n) => [n.table.name, n.sqlName]));
  const out: string[] = ["-- Сгенерировано TMA Builder. Начальная схема."];
  for (const t of norm) {
    const cols = [
      d === "sqlite" ? `  "id" INTEGER PRIMARY KEY AUTOINCREMENT` : `  "id" SERIAL PRIMARY KEY`,
      `  "user_id" ${d === "sqlite" ? "INTEGER" : "BIGINT"}`,
      d === "sqlite" ? `  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())` : `  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()`,
    ];
    for (const { field, sqlName } of t.fields) {
      let col = `  "${sqlName}" ${sqlType(field, d)}${field.required ? " NOT NULL" : ""}`;
      const ref = field.type === "ref" && field.ref ? byName.get(field.ref) : undefined;
      if (ref) col += ` REFERENCES "${ref}"("id") ON DELETE CASCADE`;
      cols.push(col);
    }
    out.push(`CREATE TABLE IF NOT EXISTS "${t.sqlName}" (\n${cols.join(",\n")}\n);`);
  }
  return out.join("\n\n") + "\n";
}

function drizzleCol(f: Field, sqlName: string, d: Dialect): string {
  const name = JSON.stringify(sqlName);
  let c: string;
  if (d === "sqlite") {
    c = f.type === "number" ? `real(${name})` : f.type === "boolean" ? `integer(${name}, { mode: "boolean" })` : f.type === "ref" ? `integer(${name})` : `text(${name})`;
  } else {
    c = f.type === "number" ? `doublePrecision(${name})` : f.type === "boolean" ? `boolean(${name})` : f.type === "ref" ? `integer(${name})` : `text(${name})`;
  }
  return f.required ? `${c}.notNull()` : c;
}

/** Код server/src/schema.ts. Экспортирует таблицы и описание полей для API. */
export function drizzleSchema(tables: Table[], d: Dialect): string {
  const norm = normalizeTables(tables);
  const imports =
    d === "sqlite"
      ? `import { integer, real, sqliteTable as table, text } from "drizzle-orm/sqlite-core";\nimport { sql } from "drizzle-orm";`
      : `import { bigint, boolean, doublePrecision, integer, pgTable as table, serial, text, timestamp } from "drizzle-orm/pg-core";`;
  const lines = ["// Сгенерировано TMA Builder из project.json.", imports, ""];
  const meta: string[] = [];
  for (const t of norm) {
    const v = camel(t.sqlName);
    const base =
      d === "sqlite"
        ? [
            `  id: integer("id").primaryKey({ autoIncrement: true }),`,
            `  userId: integer("user_id"),`,
            `  createdAt: integer("created_at").notNull().default(sql\`(unixepoch())\`),`,
          ]
        : [`  id: serial("id").primaryKey(),`, `  userId: bigint("user_id", { mode: "number" }),`, `  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),`];
    const cols = t.fields.map(({ field, sqlName }) => `  ${camel(sqlName)}: ${drizzleCol(field, sqlName, d)},`);
    lines.push(`export const ${v} = table(${JSON.stringify(t.sqlName)}, {`, ...base, ...cols, "});", "");
    const fields = t.fields.map(({ field, sqlName }) => `{ name: ${JSON.stringify(field.name)}, key: ${JSON.stringify(camel(sqlName))}, type: ${JSON.stringify(field.type)}, required: ${field.required} }`);
    meta.push(`  ${JSON.stringify(t.table.name)}: { table: ${v}, fields: [${fields.join(", ")}] },`);
  }
  lines.push(
    "export type FieldMeta = { name: string; key: string; type: string; required: boolean };",
    "/** Таблицы по имени из project.json — для общего API. */",
    `export const registry = {\n${meta.join("\n")}\n} as const satisfies Record<string, { table: unknown; fields: FieldMeta[] }>;`,
    "",
  );
  return lines.join("\n");
}
