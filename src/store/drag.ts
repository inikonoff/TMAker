// Состояние текущего перетаскивания. Смещение — MotionValue, чтобы не перерисовывать React на каждый кадр.
import { motionValue } from "motion/react";
import { create } from "zustand";
import type { Rect } from "../lib/geometry";
import type { Guide } from "../lib/snap";

export const dragOX = motionValue(0);
export const dragOY = motionValue(0);

type DragState = {
  /** id перетаскиваемых элементов. */
  ids: Set<string>;
  /** Экран, к которому относятся направляющие (в его координатах). */
  screenId: string | null;
  guides: Guide[];
  /** Рамка выделения (в мировых координатах) во время жеста. */
  marquee: Rect | null;
  /** Размер во время resize — для подписи. */
  sizeTag: { w: number; h: number } | null;
  /** Элемент, текст которого правится прямо на холсте. */
  editingId: string | null;
};

export const useDrag = create<DragState>()(() => ({
  ids: new Set(),
  screenId: null,
  guides: [],
  marquee: null,
  sizeTag: null,
  editingId: null,
}));

export const EMPTY_IDS = new Set<string>();
