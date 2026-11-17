import { describe, expect, it } from "vitest";
import { KIND_SPEC, makeElement } from "./defaults";
import { placeNew } from "./placement";

const size = { w: 390, h: 780 };

describe("placeNew", () => {
  it("ставит элементы друг под другом", () => {
    const els = [];
    for (const k of ["headerBar", "button", "card"] as const) {
      const pos = placeNew(k, size, KIND_SPEC[k], els);
      const e = makeElement(k, "s", pos, els.length);
      e.w = pos.w;
      els.push(e);
    }
    const [h, b, c] = els;
    expect(h!.y).toBe(0);
    expect(b!.y).toBeGreaterThanOrEqual(h!.h + 16);
    expect(c!.y).toBeGreaterThanOrEqual(b!.y + b!.h + 16);
    expect(b!.x + b!.w / 2).toBeCloseTo(195, -1);
  });

  it("навигация и MainButton прижаты к низу, поток их не перекрывает", () => {
    const nav = makeElement("nav", "s", placeNew("nav", size, KIND_SPEC.nav, []), 0);
    expect(nav.y + nav.h).toBe(780);
    const tall = makeElement("box", "s", { x: 0, y: 600 }, 1);
    const pos = placeNew("card", size, KIND_SPEC.card, [nav, tall]);
    expect(pos.y + KIND_SPEC.card.h).toBeLessThan(nav.y);
  });

  it("MainButton встаёт над нижней навигацией", () => {
    const nav = makeElement("nav", "s", placeNew("nav", size, KIND_SPEC.nav, []), 0);
    const pos = placeNew("mainButton", size, KIND_SPEC.mainButton, [nav]);
    expect(pos.y + KIND_SPEC.mainButton.h).toBeLessThanOrEqual(nav.y);
  });
});
