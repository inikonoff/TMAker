import { describe, expect, it } from "vitest";
import { alignRects, distributeRects, findParents, tidy } from "./arrange";
import { makeElement } from "./defaults";

describe("arrange", () => {
  it("выравнивание по левому краю и центру", () => {
    const rs = [
      { x: 10, y: 0, w: 20, h: 10 },
      { x: 40, y: 20, w: 40, h: 10 },
    ];
    expect(alignRects(rs, "left").map((r) => r.x)).toEqual([10, 10]);
    expect(alignRects(rs, "hcenter").map((r) => r.x + r.w / 2)).toEqual([45, 45]);
    expect(alignRects([rs[0]!], "hcenter", { x: 0, y: 0, w: 100, h: 100 })[0]!.x).toBe(40);
  });

  it("распределение даёт равные промежутки", () => {
    const rs = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 13, y: 0, w: 20, h: 10 },
      { x: 90, y: 0, w: 10, h: 10 },
    ];
    const d = distributeRects(rs, "x");
    expect(d[1]!.x - (d[0]!.x + d[0]!.w)).toBeCloseTo(d[2]!.x - (d[1]!.x + d[1]!.w));
    expect(d[0]!.x).toBe(0);
    expect(d[2]!.x).toBe(90);
  });

  it("родитель — наименьший содержащий", () => {
    const big = makeElement("box", "s", { x: 0, y: 0 }, 0);
    big.w = 300;
    big.h = 300;
    const card = makeElement("box", "s", { x: 10, y: 10 }, 1);
    const t = makeElement("text", "s", { x: 20, y: 20 }, 2);
    t.w = 50;
    const p = findParents([big, card, t]);
    expect(p.get(t.id)).toBe(card.id);
    expect(p.get(card.id)).toBe(big.id);
  });

  it("tidy: строки с равным шагом, шапка сверху, навигация снизу, дети с родителем", () => {
    const scr = { w: 390, h: 780 };
    const header = makeElement("headerBar", "s", { x: 5, y: 7 }, 0);
    const btn = makeElement("button", "s", { x: 120, y: 103 }, 1);
    const card = makeElement("card", "s", { x: 30, y: 180 }, 2);
    const inner = makeElement("text", "s", { x: 40, y: 200 }, 3);
    inner.w = 100;
    const nav = makeElement("nav", "s", { x: 0, y: 600 }, 4);
    const out = tidy([header, btn, card, inner, nav], scr);
    expect(out.get(header.id)).toEqual({ x: 0, y: 0, w: 390, h: header.h });
    expect(out.get(nav.id)!.y).toBe(780 - nav.h);
    const b = out.get(btn.id)!;
    expect(b.y).toBe(header.h + 16);
    expect(b.x + b.w / 2).toBe(195); // почти по центру → по центру
    const c = out.get(card.id)!;
    expect(c.y).toBe(b.y + b.h + 16);
    const i = out.get(inner.id)!;
    expect(i.x - c.x).toBe(inner.x - card.x);
    expect(i.y - c.y).toBe(inner.y - card.y);
  });
});
