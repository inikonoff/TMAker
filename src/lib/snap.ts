// Привязка и направляющие как в Canva: края и центры соседей и экрана.
import type { Rect } from "./geometry";
import { roundTo } from "./geometry";

export const SNAP_PX = 7; // экранные пиксели
export const GRID = 4;
export const MAGNET_POWER = 2.2;

export type Guide = { axis: "x" | "y"; pos: number; from: number; to: number };

export type SnapTargets = { xs: number[]; ys: number[]; rects: Rect[] };

/** Линии привязки: края и центры соседних элементов и рамки экрана. */
export function collectTargets(others: Rect[], frame: Rect): SnapTargets {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of [...others, frame]) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w);
    ys.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { xs: dedupe(xs), ys: dedupe(ys), rects: [...others, frame] };
}

function dedupe(a: number[]): number[] {
  return [...new Set(a.map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
}

type AxisHit = { delta: number; dist: number; pos: number };

/** Ближайшее совпадение по оси для набора своих линий (края и центр). */
function nearest(own: number[], targets: number[], tol: number): AxisHit | null {
  let best: AxisHit | null = null;
  for (const o of own) {
    for (const t of targets) {
      const d = Math.abs(t - o);
      if (d <= tol && (!best || d < best.dist)) best = { delta: t - o, dist: d, pos: t };
    }
  }
  return best;
}

/** Нелинейная магнитная сила: 0 на границе допуска, 1 вплотную. */
export function magnetPull(dist: number, tol: number): number {
  if (tol <= 0) return 0;
  const d = Math.min(1, Math.abs(dist) / tol);
  return (1 - d) ** MAGNET_POWER;
}

export type SnapMoveResult = { x: number; y: number; guides: Guide[]; snappedX: boolean; snappedY: boolean };

/**
 * Привязка перемещаемого прямоугольника.
 * mode "magnet" — во время перетаскивания (плавное притяжение), "exact" — при отпускании.
 * tolerance — в мировых координатах (SNAP_PX / zoom), чтобы поведение не зависело от зума.
 */
export function snapMove(
  rect: Rect,
  targets: SnapTargets,
  tolerance: number,
  mode: "magnet" | "exact",
  disabled = false,
): SnapMoveResult {
  if (disabled) return { x: rect.x, y: rect.y, guides: [], snappedX: false, snappedY: false };
  const hx = nearest([rect.x, rect.x + rect.w / 2, rect.x + rect.w], targets.xs, tolerance);
  const hy = nearest([rect.y, rect.y + rect.h / 2, rect.y + rect.h], targets.ys, tolerance);
  const k = (h: AxisHit) => (mode === "exact" ? 1 : magnetPull(h.dist, tolerance));
  let x = rect.x;
  let y = rect.y;
  if (hx) x += hx.delta * k(hx);
  if (hy) y += hy.delta * k(hy);
  if (mode === "exact") {
    if (!hx) x = roundTo(x, GRID);
    if (!hy) y = roundTo(y, GRID);
  }
  const placed = { ...rect, x, y };
  const guides: Guide[] = [];
  if (hx) guides.push(guideFor("x", hx.pos, placed, targets.rects));
  if (hy) guides.push(guideFor("y", hy.pos, placed, targets.rects));
  return { x, y, guides, snappedX: !!hx, snappedY: !!hy };
}

/** Отрезок направляющей: от самого дальнего совпавшего элемента до перемещаемого. */
function guideFor(axis: "x" | "y", pos: number, moving: Rect, rects: Rect[]): Guide {
  const near = (v: number) => Math.abs(v - pos) < 0.5;
  let from = axis === "x" ? moving.y : moving.x;
  let to = axis === "x" ? moving.y + moving.h : moving.x + moving.w;
  for (const r of rects) {
    const lines = axis === "x" ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h];
    if (!lines.some(near)) continue;
    if (axis === "x") {
      from = Math.min(from, r.y);
      to = Math.max(to, r.y + r.h);
    } else {
      from = Math.min(from, r.x);
      to = Math.max(to, r.x + r.w);
    }
  }
  return { axis, pos, from, to };
}

/** Привязка сторон при изменении размера: двигаются только тянущиеся края. */
export function snapResize(
  rect: Rect,
  edges: { n: boolean; s: boolean; e: boolean; w: boolean },
  targets: SnapTargets,
  tolerance: number,
  disabled = false,
): { rect: Rect; guides: Guide[] } {
  if (disabled) return { rect, guides: [] };
  let { x, y, w, h } = rect;
  const guides: Guide[] = [];
  const pick = (v: number, list: number[]) => nearest([v], list, tolerance);
  if (edges.e) {
    const hit = pick(x + w, targets.xs);
    w = hit ? hit.pos - x : roundTo(x + w, GRID) - x;
    if (hit) guides.push(guideFor("x", hit.pos, { x, y, w, h }, targets.rects));
  }
  if (edges.w) {
    const hit = pick(x, targets.xs);
    const nx = hit ? hit.pos : roundTo(x, GRID);
    w += x - nx;
    x = nx;
    if (hit) guides.push(guideFor("x", hit.pos, { x, y, w, h }, targets.rects));
  }
  if (edges.s) {
    const hit = pick(y + h, targets.ys);
    h = hit ? hit.pos - y : roundTo(y + h, GRID) - y;
    if (hit) guides.push(guideFor("y", hit.pos, { x, y, w, h }, targets.rects));
  }
  if (edges.n) {
    const hit = pick(y, targets.ys);
    const ny = hit ? hit.pos : roundTo(y, GRID);
    h += y - ny;
    y = ny;
    if (hit) guides.push(guideFor("y", hit.pos, { x, y, w, h }, targets.rects));
  }
  return { rect: { x, y, w: Math.max(1, w), h: Math.max(1, h) }, guides };
}
