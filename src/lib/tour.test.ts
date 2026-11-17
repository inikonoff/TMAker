import { describe, expect, it } from "vitest";
import { en } from "./i18n.en";
import { TOUR, nextVisible, tipPosition } from "./tour";

describe("tour", () => {
  it("пропускает невидимые шаги", () => {
    const steps = [{ id: "a", title: "", text: "" }, { id: "b", target: "x", title: "", text: "" }, { id: "c", target: "y", title: "", text: "" }];
    expect(nextVisible(steps, 0, 1, (t) => t === "y")).toBe(2);
    expect(nextVisible(steps, 2, 1, () => true)).toBeNull();
    expect(nextVisible(steps, 2, -1, () => false)).toBe(0);
  });

  it("подсказка не выходит за окно и не перекрывает цель", () => {
    const view = { w: 1000, h: 700 };
    const tip = { w: 300, h: 160 };
    const below = tipPosition({ x: 10, y: 10, w: 100, h: 30 }, tip, view, "bottom");
    expect(below.y).toBeGreaterThanOrEqual(40);
    expect(below.x).toBeGreaterThanOrEqual(12);
    // справа, сверху и снизу места нет — уходит влево и не перекрывает цель
    const left = tipPosition({ x: 700, y: 0, w: 290, h: 700 }, tip, view, "right");
    expect(left.x + tip.w).toBeLessThanOrEqual(700);
    // справа места нет, снизу есть — уходит вниз
    const down = tipPosition({ x: 900, y: 300, w: 90, h: 100 }, tip, view, "right");
    expect(down.y).toBeGreaterThanOrEqual(400);
    const center = tipPosition(null, tip, view);
    expect(center).toEqual({ x: 350, y: 270 });
  });

  it("все тексты обучения переведены", () => {
    const missing = TOUR.flatMap((s) => [s.title, s.text]).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });
});
