import { describe, expect, it } from "vitest";
import { ZOOM_MAX, ZOOM_MIN, edgePoint, resizeRect, toScreen, toWorld, wheelZoom, zoomAt } from "./geometry";

describe("geometry", () => {
  it("зум к курсору сохраняет точку под курсором", () => {
    const v = { x: 30, y: -20, z: 1.3 };
    const c = { x: 400, y: 300 };
    const w0 = toWorld(v, c);
    const v2 = zoomAt(v, c, 2.1);
    const back = toScreen(v2, w0);
    expect(back.x).toBeCloseTo(c.x);
    expect(back.y).toBeCloseTo(c.y);
  });

  it("зум колесом ограничен", () => {
    expect(wheelZoom(1, -100000)).toBe(ZOOM_MAX);
    expect(wheelZoom(1, 100000)).toBe(ZOOM_MIN);
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
  });

  it("resize за угол и с сохранением пропорций", () => {
    const s = { x: 10, y: 10, w: 100, h: 50 };
    expect(resizeRect(s, "se", 20, 10)).toEqual({ x: 10, y: 10, w: 120, h: 60 });
    expect(resizeRect(s, "nw", 20, 10)).toEqual({ x: 30, y: 20, w: 80, h: 40 });
    const r = resizeRect(s, "se", 100, 0, true);
    expect(r.w / r.h).toBeCloseTo(2);
    const m = resizeRect(s, "w", 500, 0);
    expect(m.w).toBe(4);
    expect(m.x).toBe(106);
  });

  it("точка на краю по направлению", () => {
    expect(edgePoint({ x: 0, y: 0, w: 100, h: 50 }, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
  });
});
