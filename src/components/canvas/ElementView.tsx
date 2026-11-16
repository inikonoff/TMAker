import { motion, useMotionValueEvent, useTransform } from "motion/react";
import type { PointerEvent as RPointerEvent } from "react";
import { memo, useRef, useState } from "react";
import type { Tokens } from "../../lib/color";
import type { Element } from "../../lib/model";
import { resolveArrow } from "../../lib/ops";
import { dragOX, dragOY, useDrag } from "../../store/drag";
import { useEditor } from "../../store/editor";
import { ArrowSvg, ElementBody } from "../ElementBody";
import { cancelGesture, startElementDrag } from "./gestures";
import { keys } from "./keys";

type Props = { el: Element; tokens: Tokens; dragging: boolean };

function onDown(e: RPointerEvent, el: Element) {
  if (e.button !== 0 || keys.space) return;
  e.stopPropagation();
  cancelGesture();
  const st = useEditor.getState();
  const multi = e.shiftKey || e.metaKey;
  if (multi) st.select([el.id], "toggle");
  else if (!st.selection.includes(el.id)) st.select([el.id]);
  if (!useEditor.getState().selection.includes(el.id)) return;
  startElementDrag(e, el);
}

/** Элемент на холсте. Во время перетаскивания позиция = база + общее смещение (MotionValue). */
export const ElementView = memo(function ElementView({ el, tokens, dragging }: Props) {
  const base = useRef({ x: el.x, y: el.y });
  base.current = { x: el.x, y: el.y };
  const dx = useTransform(dragOX, (v) => base.current.x + v);
  const dy = useTransform(dragOY, (v) => base.current.y + v);
  const lineLike = el.kind === "line" || el.kind === "arrow";
  return (
    <motion.div
      className={`el${el.hidden ? " hidden-el" : ""}`}
      data-id={el.id}
      style={{
        x: dragging ? dx : el.x,
        y: dragging ? dy : el.y,
        width: el.w,
        height: el.h,
        zIndex: el.z + (dragging ? 10000 : 0),
        pointerEvents: lineLike ? "none" : undefined,
      }}
      onPointerDown={(e) => onDown(e, el)}
    >
      {lineLike ? <ArrowSvg el={el} tokens={tokens} hit /> : <ElementBody el={el} tokens={tokens} />}
    </motion.div>
  );
});

/**
 * Стрелка, привязанная к перетаскиваемому элементу: пересчитывается каждый кадр,
 * чтобы конец следовал за элементом ещё до фиксации.
 */
export const LiveArrow = memo(function LiveArrow({
  el,
  tokens,
  byId,
}: {
  el: Element;
  tokens: Tokens;
  byId: Map<string, Element>;
}) {
  const ids = useDrag((s) => s.ids);
  const [off, setOff] = useState({ x: dragOX.get(), y: dragOY.get() });
  const update = () => setOff({ x: dragOX.get(), y: dragOY.get() });
  useMotionValueEvent(dragOX, "change", update);
  useMotionValueEvent(dragOY, "change", update);
  const shifted = new Map(byId);
  for (const id of ids) {
    const e = byId.get(id);
    if (e) shifted.set(id, { ...e, x: e.x + off.x, y: e.y + off.y });
  }
  const live = resolveArrow(el, shifted);
  return (
    <div className="el" style={{ transform: `translate(${live.x}px, ${live.y}px)`, width: live.w, height: live.h, zIndex: el.z, pointerEvents: "none" }}>
      <ArrowSvg el={live} tokens={tokens} />
    </div>
  );
});
