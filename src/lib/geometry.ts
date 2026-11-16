// Геометрия прямоугольников и преобразования координат холста.

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Viewport = { x: number; y: number; z: number };

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Прямоугольник по двум точкам (рамка выделения). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Экранные координаты → мировые. */
export function toWorld(v: Viewport, p: Point): Point {
  return { x: (p.x - v.x) / v.z, y: (p.y - v.y) / v.z };
}

export function toScreen(v: Viewport, p: Point): Point {
  return { x: p.x * v.z + v.x, y: p.y * v.z + v.y };
}

/** Зум к точке курсора: точка под курсором остаётся на месте. */
export function zoomAt(v: Viewport, cursor: Point, nextZ: number): Viewport {
  const z = clamp(nextZ, ZOOM_MIN, ZOOM_MAX);
  const world = toWorld(v, cursor);
  return { x: cursor.x - world.x * z, y: cursor.y - world.y * z, z };
}

/** Колесо: z *= exp(-deltaY * 0.0022). */
export function wheelZoom(z: number, deltaY: number): number {
  return clamp(z * Math.exp(-deltaY * 0.0022), ZOOM_MIN, ZOOM_MAX);
}

/** Вписать прямоугольник мира в окно размера w×h с отступом. */
export function fitRect(r: Rect, w: number, h: number, pad = 48): Viewport {
  const z = clamp(Math.min((w - pad * 2) / Math.max(1, r.w), (h - pad * 2) / Math.max(1, r.h)), ZOOM_MIN, 1.5);
  return { x: (w - r.w * z) / 2 - r.x * z, y: (h - r.h * z) / 2 - r.y * z, z };
}

/** Обратный масштаб подписей/ручек с ограничением, чтобы не раздувались. */
export function inverseScale(z: number): number {
  return clamp(1 / z, 0.5, 3);
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Изменение размера за ручку. keepRatio — с Shift. Минимум 1 px (линии могут быть 0 по высоте). */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, keepRatio = false, min = 4): Rect {
  let { x, y, w, h } = start;
  const east = handle.includes("e");
  const west = handle.includes("w");
  const north = handle.includes("n");
  const south = handle.includes("s");
  if (east) w = start.w + dx;
  if (west) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (south) h = start.h + dy;
  if (north) {
    h = start.h - dy;
    y = start.y + dy;
  }
  if (keepRatio && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    const horizontalOnly = (east || west) && !(north || south);
    const verticalOnly = (north || south) && !(east || west);
    if (verticalOnly) w = h * ratio;
    else if (horizontalOnly || Math.abs(w / start.w) > Math.abs(h / start.h)) h = w / ratio;
    else w = h * ratio;
    if (west) x = start.x + start.w - w;
    if (north) y = start.y + start.h - h;
    if (verticalOnly) x = start.x + (start.w - w) / 2;
    if (horizontalOnly) y = start.y + (start.h - h) / 2;
  }
  // Не даём вывернуть прямоугольник наизнанку.
  if (w < min) {
    if (west) x = start.x + start.w - min;
    w = min;
  }
  if (h < min) {
    if (north) y = start.y + start.h - min;
    h = min;
  }
  return { x, y, w, h };
}

export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Точка на границе прямоугольника по направлению к цели (для концов стрелок). */
export function edgePoint(r: Rect, toward: Point): Point {
  const c = rectCenter(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx !== 0 ? r.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? r.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}
