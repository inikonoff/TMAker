import { describe, expect, it } from "vitest";
import type { Table } from "./model";
import { addRow, listRows, parseSandbox, removeRow, singleValue, validateRow } from "./sandbox";

const tasks: Table = {
  name: "tasks",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "hours", type: "number", required: false },
    { name: "done", type: "boolean", required: false },
  ],
};

describe("sandbox", () => {
  it("проверяет обязательные поля и числа", () => {
    expect(validateRow(tasks, { title: "" }).ok).toBe(false);
    expect(validateRow(tasks, { title: "x", hours: "abc" }).ok).toBe(false);
    const r = validateRow(tasks, { title: " Купить хлеб ", hours: "1,5", done: true });
    expect(r).toEqual({ ok: true, row: { title: "Купить хлеб", hours: 1.5, done: true } });
  });

  it("добавляет, показывает и удаляет записи", () => {
    let d = addRow({}, "tasks", { title: "A", hours: null, done: false }, "1", 1);
    d = addRow(d, "tasks", { title: "B", hours: 2, done: false }, "2", 2);
    expect(listRows(d, tasks, { table: "tasks", mode: "list" })).toEqual(["B", "A"]);
    expect(listRows(d, tasks, { table: "tasks", mode: "list", field: "hours" })).toEqual(["2", "—"]);
    expect(singleValue(d, tasks, { table: "tasks", mode: "value" })).toBe("2");
    expect(singleValue(d, tasks, { table: "tasks", mode: "value", field: "title" })).toBe("B");
    d = removeRow(d, "tasks", "1");
    expect(d.tasks!.length).toBe(1);
  });

  it("переживает сериализацию", () => {
    const d = addRow({}, "tasks", { title: "A" }, "1", 1);
    expect(parseSandbox(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(parseSandbox("x")).toEqual({});
    expect(parseSandbox({ t: [{ nope: 1 }] })).toEqual({ t: [] });
  });
});
