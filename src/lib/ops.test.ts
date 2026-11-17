import { describe, expect, it } from "vitest";
import { emptyProject, makeElement } from "./defaults";
import {
  addScreen,
  deleteElements,
  deleteScreen,
  duplicateElements,
  duplicateScreen,
  elementsOf,
  moveToScreen,
  reorderScreens,
  reorderZ,
  updateElements,
} from "./ops";

function setup() {
  let p = emptyProject();
  const s1 = p.screens[0]!.id;
  const r = addScreen(p);
  p = r.project;
  const s2 = r.id;
  const a = makeElement("box", s1, { x: 10, y: 10 }, 0);
  const b = makeElement("button", s1, { x: 10, y: 200 }, 1);
  b.action = { to: s2, transition: "slideLeft" };
  const arr = makeElement("arrow", s1, { x: 0, y: 0 }, 2);
  arr.arrow = { from: { el: a.id, x: 0, y: 0 }, to: { el: b.id, x: 0, y: 0 }, head: "end" };
  p = { ...p, elements: [a, b, arr] };
  return { p: updateElements(p, new Map([[a.id, {}]])), s1, s2, a, b, arr };
}

describe("ops", () => {
  it("новый экран ставится справа", () => {
    const { p, s1, s2 } = setup();
    const x1 = p.screens.find((s) => s.id === s1)!.x;
    expect(p.screens.find((s) => s.id === s2)!.x).toBeGreaterThan(x1 + 300);
  });

  it("стрелка следует за элементами", () => {
    const { p, a, arr } = setup();
    const before = p.elements.find((e) => e.id === arr.id)!;
    const moved = updateElements(p, new Map([[a.id, { x: 300 }]]));
    const after = moved.elements.find((e) => e.id === arr.id)!;
    expect(after.arrow!.from.x).not.toBe(before.arrow!.from.x);
  });

  it("удаление экрана снимает переходы", () => {
    const { p, s2, b } = setup();
    const q = deleteScreen(p, s2);
    expect(q.screens.length).toBe(1);
    expect(q.elements.find((e) => e.id === b.id)!.action).toBeUndefined();
    expect(deleteScreen(q, q.screens[0]!.id)).toBe(q); // последний экран не удаляется
  });

  it("удаление элемента отвязывает стрелку", () => {
    const { p, a, arr } = setup();
    const q = deleteElements(p, new Set([a.id]));
    expect(q.elements.find((e) => e.id === arr.id)!.arrow!.from.el).toBeUndefined();
  });

  it("дублирование экрана копирует элементы и перепривязывает стрелки", () => {
    const { p, s1 } = setup();
    const r = duplicateScreen(p, s1)!;
    const copies = elementsOf(r.project, r.id);
    expect(copies.length).toBe(3);
    const arrow = copies.find((e) => e.kind === "arrow")!;
    const ids = new Set(copies.map((e) => e.id));
    expect(ids.has(arrow.arrow!.from.el!)).toBe(true);
    expect(r.project.screens[1]!.id).toBe(r.id);
  });

  it("дублирование элементов", () => {
    const { p, a } = setup();
    const r = duplicateElements(p, [a.id]);
    const c = r.project.elements.find((e) => e.id === r.ids[0])!;
    expect(c.x).toBe(a.x + 16);
    expect(c.z).toBe(3);
  });

  it("порядок слоёв", () => {
    const { p, a, s1 } = setup();
    const f = reorderZ(p, new Set([a.id]), "front");
    expect(elementsOf(f, s1).at(-1)!.id).toBe(a.id);
    const b2 = reorderZ(f, new Set([a.id]), "backward");
    expect(elementsOf(b2, s1).at(-2)!.id).toBe(a.id);
  });

  it("перенос на другой экран сохраняет мировое положение", () => {
    const { p, a, s1, s2 } = setup();
    const q = moveToScreen(p, new Set([a.id]), s2);
    const e = q.elements.find((x) => x.id === a.id)!;
    const sc1 = p.screens.find((s) => s.id === s1)!;
    const sc2 = q.screens.find((s) => s.id === s2)!;
    expect(e.screenId).toBe(s2);
    expect(e.x + sc2.x).toBe(a.x + sc1.x);
  });

  it("перестановка экранов", () => {
    const { p, s1, s2 } = setup();
    expect(reorderScreens(p, [s2, s1]).screens[0]!.id).toBe(s2);
    expect(reorderScreens(p, [s2])).toBe(p);
  });
});

describe("переходы пунктов навигации", () => {
  it("валидатор чистит ссылки, удаление экрана их снимает, карта их видит", async () => {
    const { parseProject } = await import("./validate");
    const { flowEdges } = await import("./flow");
    const { p, s1, s2 } = setup();
    const nav = makeElement("nav", s1, { x: 0, y: 700 }, 9);
    nav.content = { ...nav.content, links: ["", s2, "ghost"] };
    // Убираем у кнопки переход на s2, чтобы стрелка карты была именно от пункта навигации.
    const q = { ...p, elements: [...p.elements.map((e) => ({ ...e, action: undefined })), nav] };
    const r = parseProject(JSON.parse(JSON.stringify(q)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = r.project.elements.find((e) => e.id === nav.id)!;
    expect(parsed.content!.links).toEqual(["", s2, ""]);
    expect(flowEdges(r.project).some((e) => e.label === "Поиск" && e.to === s2)).toBe(true);
    const d = deleteScreen(r.project, s2);
    expect(d.elements.find((e) => e.id === nav.id)!.content!.links).toEqual(["", "", ""]);
  });
});
