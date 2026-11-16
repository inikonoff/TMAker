import { describe, expect, it } from "vitest";
import type { Table } from "../model";
import { drizzleSchema, ident, migrationSql, normalizeTables } from "./sql";

const tables: Table[] = [
  { name: "Задачи", fields: [
    { name: "Название", type: "text", required: true },
    { name: "часы", type: "number", required: false },
    { name: "готово", type: "boolean", required: false },
    { name: "id", type: "text", required: false },
  ] },
  { name: "comments", fields: [{ name: "task", type: "ref", required: true, ref: "Задачи" }] },
];

describe("sql", () => {
  it("идентификаторы безопасны и уникальны", () => {
    expect(ident("Мои задачи!")).toBe("moi_zadachi");
    expect(ident("1st")).toBe("_1st");
    const n = normalizeTables(tables);
    expect(n[0]!.sqlName).toBe("zadachi");
    expect(n[0]!.fields.map((f) => f.sqlName)).toEqual(["nazvanie", "chasy", "gotovo", "id_2"]);
  });

  it("SQLite-миграция", () => {
    const s = migrationSql(tables, "sqlite");
    expect(s).toContain(`CREATE TABLE IF NOT EXISTS "zadachi"`);
    expect(s).toContain(`"nazvanie" TEXT NOT NULL`);
    expect(s).toContain(`"chasy" REAL`);
    expect(s).toContain(`REFERENCES "zadachi"("id")`);
  });

  it("Postgres-миграция", () => {
    const s = migrationSql(tables, "postgres");
    expect(s).toContain("SERIAL PRIMARY KEY");
    expect(s).toContain(`"gotovo" BOOLEAN`);
  });

  it("схема Drizzle содержит реестр", () => {
    const s = drizzleSchema(tables, "sqlite");
    expect(s).toContain(`export const zadachi = table("zadachi"`);
    expect(s).toContain(`"Задачи": { table: zadachi`);
    expect(drizzleSchema(tables, "postgres")).toContain("pgTable as table");
  });
});
