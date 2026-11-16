// Переходы между экранами: один набор поз для вперёд и назад. Назад — тот же переход в обратную сторону.
import type { Swipe, TransitionKind } from "./model";

/** Поза экрана: x/y — доля ширины/высоты, scale, opacity, radius — скругление рамки. */
export type Pose = { x: number; y: number; scale: number; opacity: number };

export const CENTER: Pose = { x: 0, y: 0, scale: 1, opacity: 1 };

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  slideLeft: "Сдвиг влево (новый справа)",
  slideRight: "Сдвиг вправо (новый слева)",
  slideUp: "Снизу вверх",
  slideDown: "Сверху вниз",
  fade: "Растворение",
  expand: "Раскрытие",
  none: "Без анимации",
};

export const TRANSITION_SHORT: Record<TransitionKind, string> = {
  slideLeft: "←",
  slideRight: "→",
  slideUp: "↑",
  slideDown: "↓",
  fade: "◌",
  expand: "⤢",
  none: "·",
};

const pose = (p: Partial<Pose>): Pose => ({ ...CENTER, ...p });

/** enterFrom — откуда входит новый экран; exitTo — куда уходит старый (при движении вперёд). */
export function transitionPoses(kind: TransitionKind): { enterFrom: Pose; exitTo: Pose } {
  switch (kind) {
    case "slideLeft":
      return { enterFrom: pose({ x: 1 }), exitTo: pose({ x: -0.3 }) };
    case "slideRight":
      return { enterFrom: pose({ x: -1 }), exitTo: pose({ x: 0.3 }) };
    case "slideUp":
      return { enterFrom: pose({ y: 1 }), exitTo: pose({ y: -0.12, scale: 0.97 }) };
    case "slideDown":
      return { enterFrom: pose({ y: -1 }), exitTo: pose({ y: 0.12, scale: 0.97 }) };
    case "fade":
      return { enterFrom: pose({ opacity: 0 }), exitTo: pose({ opacity: 0 }) };
    case "expand":
      return { enterFrom: pose({ scale: 0.86, opacity: 0 }), exitTo: pose({ scale: 1.06, opacity: 0 }) };
    case "none":
      return { enterFrom: CENTER, exitTo: CENTER };
  }
}

export type Direction = "forward" | "back";

/** Позы входящего и уходящего экранов для направления. Назад — зеркально вперёд. */
export function posesFor(kind: TransitionKind, dir: Direction) {
  const { enterFrom, exitTo } = transitionPoses(kind);
  return dir === "forward"
    ? { incoming: { from: enterFrom, to: CENTER }, outgoing: { from: CENTER, to: exitTo }, incomingOnTop: true }
    : { incoming: { from: exitTo, to: CENTER }, outgoing: { from: CENTER, to: enterFrom }, incomingOnTop: false };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), scale: lerp(a.scale, b.scale, t), opacity: lerp(a.opacity, b.opacity, t) };
}

export const EASE_STANDARD = [0.2, 0, 0, 1] as const;
export const DURATION_MS = 420;
export const EXPRESSIVE_SPRING = { type: "spring", stiffness: 360, damping: 26 } as const;

/** Свайп пальцем: направление жеста → переход. Палец влево — новый экран приходит справа. */
export const SWIPE_TRANSITION: Record<keyof Swipe, TransitionKind> = {
  left: "slideLeft",
  right: "slideRight",
  up: "slideUp",
  down: "slideDown",
};

/** Доля прогресса жеста по смещению пальца: 0..1. */
export function swipeProgress(dir: keyof Swipe, dx: number, dy: number, w: number, h: number): number {
  const v = dir === "left" ? -dx / w : dir === "right" ? dx / w : dir === "up" ? -dy / h : dy / h;
  return Math.max(0, Math.min(1, v));
}

/** Решение по отпусканию: порог 25% или быстрый жест. */
export function swipeCommits(progress: number, velocity: number, size: number): boolean {
  return progress > 0.25 || velocity / Math.max(1, size) > 0.9;
}

/** Направление жеста по первому заметному смещению. */
export function swipeDirection(dx: number, dy: number, threshold = 8): keyof Swipe | null {
  if (Math.hypot(dx, dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}
