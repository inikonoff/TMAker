// Выравнивание, распределение и «Упорядочить» (Tidy). Правила, а не модель.
import type { Rect } from "./geometry";
import { boundsOf, roundTo } from "./geometry";
import type { Element } from "./model";

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/** Выравнивание по рамке выделения (или по экрану, если выбран один элемент и передан frame). */
export function alignRects(rects: Rect[], mode: AlignMode, frame?: Rect): Rect[] {
  const b = rects.length === 1 && frame ? frame : boundsOf(rects);
  if (!b) return rects;
  return rects.map((r) => {
    switch (mode) {
      case "left":
        return { ...r, x: b.x };
      case "hcenter":
        return { ...r, x: b.x + (b.w - r.w) / 2 };
      case "right":
        return { ...r, x: b.x + b.w - r.w };
      case "top":
        return { ...r, y: b.y };
      case "vcenter":
        return { ...r, y: b.y + (b.h - r.h) / 2 };
      case "bottom":
        return { ...r, y: b.y + b.h - r.h };
    }
  });
}

/** Равные промежутки между элементами по оси. Крайние остаются на месте. */
export function distributeRects(rects: Rect[], axis: "x" | "y"): Rect[] {
  if (rects.length < 3) return rects;
  const pos = axis === "x" ? "x" : "y";
  const size = axis === "x" ? "w" : "h";
  const order = rects.map((r, i) => ({ r, i })).sort((a, b) => a.r[pos] - b.r[pos]);
  const first = order[0]!.r;
  const last = order[order.length - 1]!.r;
  const total = order.reduce((s, o) => s + o.r[size], 0);
  const span = last[pos] + last[size] - first[pos];
  const gap = (span - total) / (order.length - 1);
  const out = [...rects];
  let cursor = first[pos];
  for (const o of order) {
    out[o.i] = { ...o.r, [pos]: Math.round(cursor * 10) / 10 };
    cursor += o.r[size] + gap;
  }
  return out;
}

const inside = (a: Rect, b: Rect, tol = 2) =>
  a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;

/** Родитель элемента — наименьший другой элемент, полностью его содержащий. */
export function findParents(els: Element[]): Map<string, string> {
  const parents = new Map<string, string>();
  for (const e of els) {
    let best: Element | null = null;
    for (const o of els) {
      if (o.id === e.id || o.w * o.h <= e.w * e.h) continue;
      if (!inside(e, o)) continue;
      if (!best || o.w * o.h < best.w * best.h) best = o;
    }
    if (best) parents.set(e.id, best.id);
  }
  return parents;
}

export type TidyOptions = { margin?: number; gap?: number };

const BOTTOM_KINDS = new Set(["nav", "mainButton"]);

/**
 * Упорядочить экран: строки сверху вниз с равным шагом, отступы по краям,
 * широкие элементы — во всю ширину, одиночные почти по центру — по центру.
 * Вложенные элементы двигаются вместе с родителем. Возвращает новые прямоугольники по id.
 */
export function tidy(els: Element[], screen: { w: number; h: number }, opts: TidyOptions = {}): Map<string, Rect> {
  const margin = opts.margin ?? 16;
  const gap = opts.gap ?? 16;
  const usable = els.filter((e) => !e.locked && !e.hidden && e.kind !== "line" && e.kind !== "arrow");
  const parents = findParents(usable);
  const top = usable.filter((e) => !parents.has(e.id));
  const out = new Map<string, Rect>();

  const header = top.filter((e) => e.kind === "headerBar").sort((a, b) => a.y - b.y)[0];
  const bottom = top.filter((e) => BOTTOM_KINDS.has(e.kind));
  const flow = top.filter((e) => e !== header && !BOTTOM_KINDS.has(e.kind)).sort((a, b) => a.y - b.y || a.x - b.x);

  if (header) out.set(header.id, { x: 0, y: 0, w: screen.w, h: header.h });
  let bottomY = screen.h;
  for (const b of bottom.sort((a, c) => c.y - a.y)) {
    const full = b.kind === "nav";
    const w = full ? screen.w : screen.w - margin * 2;
    const r = { x: full ? 0 : margin, y: bottomY - b.h - (full ? 0 : margin), w, h: b.h };
    out.set(b.id, r);
    bottomY = r.y;
  }

  // Строки: элемент попадает в строку, если перекрывается с ней по вертикали больше чем на половину.
  const rows: Element[][] = [];
  for (const e of flow) {
    const row = rows[rows.length - 1];
    if (row) {
      const rTop = Math.min(...row.map((r) => r.y));
      const rBot = Math.max(...row.map((r) => r.y + r.h));
      const overlap = Math.min(rBot, e.y + e.h) - Math.max(rTop, e.y);
      if (overlap > Math.min(e.h, rBot - rTop) / 2) {
        row.push(e);
        continue;
      }
    }
    rows.push([e]);
  }

  let y = header ? header.h + gap : margin;
  const avail = screen.w - margin * 2;
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const rowH = Math.max(...row.map((e) => e.h));
    if (row.length === 1) {
      const e = row[0]!;
      let x: number;
      let w = e.w;
      if (e.w >= screen.w - 4) {
        x = 0;
        w = screen.w;
      } else if (e.w >= avail - 24) {
        x = margin;
        w = avail;
      } else {
        const center = e.x + e.w / 2;
        if (Math.abs(center - screen.w / 2) < screen.w * 0.12) x = (screen.w - w) / 2;
        else if (center > screen.w / 2) x = screen.w - margin - w;
        else x = margin;
      }
      out.set(e.id, { x: roundTo(x, 1), y, w, h: e.h });
    } else {
      const total = row.reduce((s, e) => s + e.w, 0);
      const g = total + gap * (row.length - 1) <= avail ? (avail - total) / (row.length - 1) : gap;
      const space = Math.min(g, gap * 2);
      const used = total + space * (row.length - 1);
      let x = used < avail ? margin + (avail - used) / 2 : margin;
      if (Math.abs(space - g) < 0.5) x = margin;
      for (const e of row) {
        out.set(e.id, { x: roundTo(x, 1), y: y + (rowH - e.h) / 2, w: e.w, h: e.h });
        x += e.w + space;
      }
    }
    y += rowH + gap;
  }

  // Дети двигаются вместе с родителем (по цепочке).
  const moveOf = (id: string): { dx: number; dy: number } => {
    const e = usable.find((x) => x.id === id)!;
    const placed = out.get(id);
    if (placed) return { dx: placed.x - e.x, dy: placed.y - e.y };
    const p = parents.get(id);
    return p ? moveOf(p) : { dx: 0, dy: 0 };
  };
  for (const e of usable) {
    if (out.has(e.id)) continue;
    const p = parents.get(e.id);
    if (!p) continue;
    const { dx, dy } = moveOf(p);
    out.set(e.id, { x: e.x + dx, y: e.y + dy, w: e.w, h: e.h });
  }
  return out;
}
