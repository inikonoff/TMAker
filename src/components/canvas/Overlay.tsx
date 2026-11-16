// Слой поверх экранов: рамка выделения с ручками, концы стрелок, направляющие, рамка выбора.
import { motion } from "motion/react";
import { boundsOf, HANDLES } from "../../lib/geometry";
import type { Handle } from "../../lib/geometry";
import type { Project } from "../../lib/model";
import { dragOX, dragOY, useDrag } from "../../store/drag";
import { useEditor } from "../../store/editor";
import { startArrowEndDrag, startResize } from "./gestures";
import { tr } from "../../lib/i18n";

const HANDLE_POS: Record<Handle, [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};

const CURSOR: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export function SelectionOverlay({ project }: { project: Project }) {
  const selection = useEditor((s) => s.selection);
  const dragIds = useDrag((s) => s.ids);
  const sizeTag = useDrag((s) => s.sizeTag);
  const dragging = dragIds.size > 0;
  if (selection.length === 0) return null;
  const sel = project.elements.filter((e) => selection.includes(e.id));
  const first = sel[0];
  if (!first) return null;
  const screen = project.screens.find((s) => s.id === first.screenId);
  if (!screen) return null;
  const same = sel.filter((e) => e.screenId === first.screenId);
  const b = boundsOf(same)!;
  const single = same.length === 1 ? first : null;
  const arrow = single?.arrow ? single : null;
  const locked = same.every((e) => e.locked);

  if (arrow?.arrow) {
    const ends = [
      ["from", arrow.arrow.from],
      ["to", arrow.arrow.to],
    ] as const;
    return (
      <motion.div style={{ position: "absolute", left: screen.x, top: screen.y, x: dragging ? dragOX : 0, y: dragging ? dragOY : 0, zIndex: 2 }}>
        {!dragging &&
          ends.map(([key, pt]) => (
            <div
              key={key}
              className="handle"
              title={pt.el ? tr("Конец привязан к элементу") : tr("Перетащите на элемент, чтобы привязать")}
              style={{ left: pt.x, top: pt.y, borderRadius: "50%", cursor: "crosshair", background: pt.el ? "var(--accent)" : "#fff" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                startArrowEndDrag(e, arrow.id, key);
              }}
            />
          ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="sel-box"
      style={{
        left: screen.x + b.x,
        top: screen.y + b.y,
        width: Math.max(1, b.w),
        height: Math.max(1, b.h),
        x: dragging ? dragOX : 0,
        y: dragging ? dragOY : 0,
        zIndex: 2,
      }}
    >
      {!dragging &&
        !locked &&
        HANDLES.filter((h) => (b.h === 0 ? h === "e" || h === "w" : true)).map((h) => {
          const [fx, fy] = HANDLE_POS[h];
          return (
            <div
              key={h}
              className="handle"
              style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, cursor: CURSOR[h] }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                startResize(e, h);
              }}
            />
          );
        })}
      {sizeTag && <div className="size-tag">{`${sizeTag.w} × ${sizeTag.h}`}</div>}
    </motion.div>
  );
}

export function GuidesLayer({ project }: { project: Project }) {
  const guides = useDrag((s) => s.guides);
  const screenId = useDrag((s) => s.screenId);
  const marquee = useDrag((s) => s.marquee);
  const screen = project.screens.find((s) => s.id === screenId);
  return (
    <>
      {screen &&
        guides.map((g, i) =>
          g.axis === "x" ? (
            <div
              key={i}
              className="guide"
              style={{ left: screen.x + g.pos, top: screen.y + g.from, width: "calc(1px * var(--inv))", height: g.to - g.from, zIndex: 3 }}
            />
          ) : (
            <div
              key={i}
              className="guide"
              style={{ left: screen.x + g.from, top: screen.y + g.pos, height: "calc(1px * var(--inv))", width: g.to - g.from, zIndex: 3 }}
            />
          ),
        )}
      {marquee && (
        <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, zIndex: 3 }} />
      )}
    </>
  );
}
