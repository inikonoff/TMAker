import { describe, expect, it } from "vitest";
import { emptyProject, makeElement } from "./defaults";
import { flowLayout } from "./flow";
import { addScreen } from "./ops";

describe("flow", () => {
  it("рёбра из кнопок и свайпов, уровни по BFS", () => {
    let p = emptyProject();
    const a = p.screens[0]!.id;
    let r = addScreen(p);
    p = r.project;
    const b = r.id;
    r = addScreen(p);
    p = r.project;
    const c = r.id;
    r = addScreen(p);
    p = r.project;
    const lonely = r.id;
    const btn = makeElement("button", a, { x: 0, y: 0 }, 0);
    btn.action = { to: b, transition: "fade" };
    const dup = makeElement("button", a, { x: 0, y: 50 }, 1);
    dup.action = { to: b, transition: "fade" };
    p = { ...p, elements: [btn, dup], screens: p.screens.map((s) => (s.id === b ? { ...s, swipe: { left: c } } : s)) };
    const f = flowLayout(p);
    expect(f.edges.length).toBe(2);
    expect(f.edges.find((e) => e.kind === "swipe")!.to).toBe(c);
    const col = (id: string) => f.nodes.find((n) => n.id === id)!.col;
    expect([col(a), col(b), col(c), col(lonely)]).toEqual([0, 1, 2, 3]);
  });
});
