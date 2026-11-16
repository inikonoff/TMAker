import { describe, expect, it } from "vitest";
import { collectTargets, magnetPull, snapMove, snapResize } from "./snap";

const frame = { x: 0, y: 0, w: 400, h: 800 };

describe("snap", () => {
  it("притягивает к краю соседа точно при отпускании", () => {
    const t = collectTargets([{ x: 100, y: 100, w: 50, h: 50 }], frame);
    const r = snapMove({ x: 153, y: 300, w: 40, h: 40 }, t, 7, "exact");
    expect(r.x).toBe(150);
    expect(r.snappedX).toBe(true);
    expect(r.guides.some((g) => g.axis === "x" && g.pos === 150)).toBe(true);
    // по y привязки нет — сетка 4
    expect(r.y % 4).toBe(0);
  });

  it("центрирует по экрану", () => {
    const t = collectTargets([], frame);
    const r = snapMove({ x: 178, y: 10, w: 40, h: 40 }, t, 7, "exact");
    expect(r.x).toBe(180);
  });

  it("магнит плавный: дальше — слабее, без прыжка на границе", () => {
    expect(magnetPull(0, 7)).toBe(1);
    expect(magnetPull(7, 7)).toBe(0);
    expect(magnetPull(2, 7)).toBeGreaterThan(magnetPull(5, 7));
    const t = collectTargets([], frame);
    const near = snapMove({ x: 6.9, y: 300, w: 40, h: 40 }, t, 7, "magnet");
    expect(near.x).toBeCloseTo(6.9, 1);
  });

  it("отключается", () => {
    const t = collectTargets([], frame);
    const r = snapMove({ x: 3, y: 3, w: 10, h: 10 }, t, 7, "exact", true);
    expect(r).toMatchObject({ x: 3, y: 3, guides: [] });
  });

  it("привязывает тянущийся край при resize", () => {
    const t = collectTargets([{ x: 200, y: 0, w: 10, h: 10 }], frame);
    const r = snapResize({ x: 100, y: 100, w: 97, h: 50 }, { e: true, w: false, n: false, s: false }, t, 7);
    expect(r.rect.w).toBe(100);
    expect(r.rect.x).toBe(100);
  });
});
