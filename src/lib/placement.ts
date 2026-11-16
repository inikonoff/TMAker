// Куда поставить новый элемент: под последним в потоке экрана, чтобы элементы не ложились стопкой.
import type { Element, Kind } from "./model";

const BOTTOM: ReadonlySet<Kind> = new Set(["nav", "mainButton"]);
const MARGIN = 16;
const GAP = 16;

export function placeNew(
  kind: Kind,
  size: { w: number; h: number },
  spec: { w: number; h: number },
  existing: Element[],
): { x: number; y: number; w: number } {
  if (kind === "headerBar") return { x: 0, y: 0, w: size.w };
  if (kind === "nav") return { x: 0, y: size.h - spec.h, w: size.w };
  if (kind === "mainButton") return { x: MARGIN, y: size.h - spec.h - MARGIN, w: size.w - MARGIN * 2 };

  const w = Math.min(spec.w, size.w - MARGIN * 2);
  const flow = existing.filter((e) => !BOTTOM.has(e.kind) && !e.hidden);
  const bottomLimit = Math.min(size.h, ...existing.filter((e) => BOTTOM.has(e.kind)).map((e) => e.y));
  const lowest = flow.reduce((m, e) => Math.max(m, e.y + e.h), 0);
  const x = Math.round((size.w - w) / 2 / 4) * 4;
  let y = lowest === 0 ? MARGIN : Math.ceil((lowest + GAP) / 4) * 4;
  if (y + spec.h > bottomLimit - 8) {
    // Места внизу нет — лесенкой от центра.
    const step = (existing.length % 8) * 12;
    y = Math.round((size.h / 3 + step) / 4) * 4;
  }
  return { x, y, w };
}
