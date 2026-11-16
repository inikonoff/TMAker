import { describe, expect, it } from "vitest";
import { applySchemaDraft, applyScreenDraft, applyTextsDraft, buildMessages, extractJson, mergeTables, parseTables } from "./ai";
import { emptyProject, makeElement } from "./defaults";
import { elementsOf } from "./ops";
import { parseProject } from "./validate";

describe("ai", () => {
  it("достаёт JSON из ответа с обёрткой", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Вот:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('ok {"a":3} end')).toEqual({ a: 3 });
    expect(() => extractJson("нет json")).toThrow();
  });

  it("промпт экрана фиксированный и содержит контекст", () => {
    const m = buildMessages("screen", emptyProject(), { prompt: "список задач" });
    expect(m[0]!.role).toBe("system");
    expect(m[1]!.content).toContain("список задач");
    expect(m[1]!.content).toContain('"elements"');
  });

  it("«список задач с формой добавления» → экран без координат от модели", () => {
    const p = emptyProject();
    const reply = {
      name: "Задачи",
      elements: [
        { kind: "headerBar", text: "Мои задачи", x: 999, y: 999 },
        { kind: "card", text: "Новая задача", bind: { table: "tasks", mode: "form" } },
        { kind: "list", bind: { table: "tasks", mode: "list", field: "title" } },
        { kind: "blink" },
        { kind: "button", text: "Назад", goTo: "back" },
      ],
      tables: [{ name: "tasks", fields: [{ name: "title", type: "text", required: true }, { name: "id", type: "number" }] }],
    };
    const r = applyScreenDraft(p, reply);
    expect(r.project.screens.length).toBe(2);
    const els = elementsOf(r.project, r.focusScreen!);
    expect(els.map((e) => e.kind)).toEqual(["headerBar", "card", "list", "button"]);
    expect(els[0]!.x).toBe(0);
    expect(els[0]!.y).toBe(0); // координаты модели проигнорированы
    expect(els[1]!.y).toBeGreaterThan(els[0]!.h);
    expect(els[2]!.y).toBeGreaterThan(els[1]!.y + els[1]!.h);
    expect(els[3]!.action).toEqual({ back: true });
    expect(r.project.data!.tables[0]!.fields.map((f) => f.name)).toEqual(["title"]);
    expect(parseProject(JSON.parse(JSON.stringify(r.project))).ok).toBe(true);
  });

  it("схема: только новые таблицы, битые ref снимаются", () => {
    const merged = mergeTables([{ name: "a", fields: [] }], parseTables([{ name: "a", fields: [] }, { name: "b", fields: [{ name: "x", type: "ref", ref: "zzz" }] }]));
    expect(merged.map((t) => t.name)).toEqual(["a", "b"]);
    expect(merged[1]!.fields[0]!.type).toBe("number");
    const p = emptyProject();
    expect(() => applySchemaDraft(p, { tables: [] })).toThrow();
    expect(applySchemaDraft(p, { tables: [{ name: "t", fields: [{ name: "n", type: "text" }] }] }).project.data!.tables.length).toBe(1);
  });

  it("тексты: меняются только тексты элементов этого экрана", () => {
    const p = emptyProject();
    const b = makeElement("button", p.screens[0]!.id, { x: 10, y: 20 }, 0);
    const q = { ...p, elements: [b] };
    const r = applyTextsDraft(q, { texts: [{ id: b.id, text: "Начать", x: 500 }, { id: "чужой", text: "x" }] }, p.screens[0]!.id);
    const e = r.project.elements[0]!;
    expect(e.content!.text).toBe("Начать");
    expect(e.x).toBe(10);
    expect(() => applyTextsDraft(q, { texts: [] }, p.screens[0]!.id)).toThrow();
  });
});
