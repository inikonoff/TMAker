import { describe, expect, it } from "vitest";
import { addField, addTable, deleteField, deleteTable, moveField, renameTable, updateField } from "./dataOps";
import { emptyProject, makeElement } from "./defaults";

function setup() {
  let p = emptyProject();
  p = addTable(p, "tasks").project;
  p = addTable(p, "comments").project;
  p = updateField(p, "comments", "title", { name: "task", type: "ref", ref: "tasks" });
  const list = makeElement("list", p.screens[0]!.id, { x: 0, y: 0 }, 0);
  list.bind = { table: "tasks", mode: "list", field: "title" };
  return { ...p, elements: [list] };
}

describe("dataOps", () => {
  it("уникальные имена таблиц", () => {
    const p = addTable(setup(), "tasks");
    expect(p.name).toBe("tasks2");
  });

  it("переименование таблицы обновляет привязки и ссылки", () => {
    const p = renameTable(setup(), "tasks", "todos");
    expect(p.elements[0]!.bind!.table).toBe("todos");
    expect(p.data!.tables[1]!.fields[0]!.ref).toBe("todos");
    expect(renameTable(p, "todos", "comments")).toBe(p); // занято
  });

  it("удаление таблицы снимает привязки и ref", () => {
    const p = deleteTable(setup(), "tasks");
    expect(p.elements[0]!.bind).toBeUndefined();
    const f = p.data!.tables[0]!.fields[0]!;
    expect(f.type).toBe("number");
    expect("ref" in f).toBe(false);
  });

  it("поля: переименование, тип, удаление, порядок", () => {
    let p = setup();
    p = addField(p, "tasks");
    expect(p.data!.tables[0]!.fields.map((f) => f.name)).toEqual(["title", "field"]);
    p = updateField(p, "tasks", "title", { name: "name" });
    expect(p.elements[0]!.bind!.field).toBe("name");
    p = updateField(p, "tasks", "field", { name: "name" }); // дубль — имя не меняется
    expect(p.data!.tables[0]!.fields[1]!.name).toBe("field");
    p = moveField(p, "tasks", "field", -1);
    expect(p.data!.tables[0]!.fields[0]!.name).toBe("field");
    p = deleteField(p, "tasks", "name");
    expect(p.elements[0]!.bind!.field).toBeUndefined();
    p = updateField(p, "comments", "task", { type: "text" });
    expect("ref" in p.data!.tables[1]!.fields[0]!).toBe(false);
  });
});
