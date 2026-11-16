// SVG-пути фигур и пунктиры рамок. Чистая геометрия.
import type { ShapeKind, StrokeStyle } from "./model";

const f = (v: number) => Math.round(v * 100) / 100;

function poly(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join(" ") + " Z";
}

/** Правильный многоугольник, вписанный в прямоугольник. */
export function polygonPoints(w: number, h: number, sides: number, inset = 0): [number, number][] {
  const n = Math.max(3, Math.min(12, Math.round(sides)));
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(0, w / 2 - inset);
  const ry = Math.max(0, h / 2 - inset);
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

export function starPoints(w: number, h: number, points = 5, inset = 0, innerRatio = 0.45): [number, number][] {
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(0, w / 2 - inset);
  const ry = Math.max(0, h / 2 - inset);
  const out: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : innerRatio;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    out.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]);
  }
  return out;
}

/** Путь фигуры. Обводка рисуется по центру линии, поэтому фигура вписывается с отступом sw/2. */
export function shapePath(kind: ShapeKind, w: number, h: number, sw = 0, radius = 0, sides = 6): string {
  const i = sw / 2;
  switch (kind) {
    case "ellipse": {
      const rx = Math.max(0, w / 2 - i);
      const ry = Math.max(0, h / 2 - i);
      return `M${f(w / 2 - rx)} ${f(h / 2)} a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0 Z`;
    }
    case "triangle":
      return poly([
        [w / 2, i],
        [w - i, h - i],
        [i, h - i],
      ]);
    case "star":
      return poly(starPoints(w, h, 5, i));
    case "polygon":
      return poly(polygonPoints(w, h, sides, i));
    default: {
      const x0 = i;
      const y0 = i;
      const x1 = Math.max(x0, w - i);
      const y1 = Math.max(y0, h - i);
      const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
      if (r === 0) return poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      return [
        `M${f(x0 + r)} ${f(y0)}`,
        `H${f(x1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}`,
        `V${f(y1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}`,
        `H${f(x0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}`,
        `V${f(y0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)} Z`,
      ].join(" ");
    }
  }
}

/** stroke-dasharray для стиля рамки. Для double рисуется двумя линиями — здесь сплошная. */
export function strokeDash(style: StrokeStyle, width: number): string | undefined {
  const w = Math.max(1, width);
  if (style === "dashed") return `${f(w * 3)} ${f(w * 2)}`;
  if (style === "dotted") return `0 ${f(w * 2)}`;
  return undefined;
}
