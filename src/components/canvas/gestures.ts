// Жесты холста: перетаскивание элементов (пружина + магнит + посадка), изменение размера, перенос экрана.
import { animate } from "motion/react";
import type { Handle, Rect } from "../../lib/geometry";
import { boundsOf, contains, resizeRect, roundTo, toWorld } from "../../lib/geometry";
import type { Element, Project } from "../../lib/model";
import { elementsOf, moveToScreen, movedElement, screenRect, updateElements } from "../../lib/ops";
import { collectTargets, GRID, snapMove, snapResize, SNAP_PX } from "../../lib/snap";
import { dragOX, dragOY, EMPTY_IDS, useDrag } from "../../store/drag";
import { useEditor } from "../../store/editor";

export const FOLLOW_SPRING = { type: "spring", stiffness: 620, damping: 38, mass: 0.7 } as const;
export const LAND = { duration: 0.34, ease: [0.2, 0, 0, 1] } as const;
const DRAG_THRESHOLD = 3;

export const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Текущий жест; второй палец или новый жест прерывает его. */
let cancelActive: (() => void) | null = null;
export function cancelGesture() {
  cancelActive?.();
  cancelActive = null;
}

/** Завершить незаконченную посадку мгновенно (если пользователь хватает снова). */
let finishLanding: (() => void) | null = null;

/** Канвас-элемент, чтобы переводить координаты клиента в координаты холста. */
let canvasEl: HTMLElement | null = null;
export function setCanvasElement(el: HTMLElement | null) {
  canvasEl = el;
}
export function clientToWorld(cx: number, cy: number) {
  const r = canvasEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return toWorld(useEditor.getState().viewport, { x: cx - r.left, y: cy - r.top });
}

export function screenAt(p: Project, world: { x: number; y: number }): string | null {
  for (let i = p.screens.length - 1; i >= 0; i--) {
    const s = p.screens[i]!;
    if (contains(screenRect(p, s), world)) return s.id;
  }
  return null;
}

const elRect = (e: Element): Rect => ({ x: e.x, y: e.y, w: e.w, h: e.h });

function snapTargetsFor(p: Project, screenId: string, exclude: Set<string>) {
  const s = p.screens.find((x) => x.id === screenId)!;
  const frame = screenRect(p, s);
  const others = elementsOf(p, screenId)
    .filter((e) => !exclude.has(e.id) && !e.hidden && e.kind !== "line" && e.kind !== "arrow")
    .map(elRect);
  return collectTargets(others, { x: 0, y: 0, w: frame.w, h: frame.h });
}

type PointerLike = { clientX: number; clientY: number; pointerId: number; shiftKey: boolean };

function listen(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void, onCancel: () => void) {
  const move = (e: PointerEvent) => onMove(e);
  const up = (e: PointerEvent) => {
    cleanup();
    onUp(e);
  };
  const cancel = () => {
    cleanup();
    onCancel();
  };
  function cleanup() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    if (cancelActive === cancel) cancelActive = null;
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  cancelActive = cancel;
}

const snapDisabled = (e: { ctrlKey: boolean; metaKey: boolean }) =>
  e.ctrlKey || e.metaKey || useEditor.getState().snapOff;

/** Перетаскивание выделенных элементов. Пружинное следование, магнит, посадка 340 мс. */
export function startElementDrag(start: PointerLike, anchor: Element) {
  finishLanding?.();
  const st = useEditor.getState();
  const p = st.project;
  const ids = new Set(
    st.selection.filter((id) => {
      const e = p.elements.find((x) => x.id === id);
      return e && !e.locked && e.screenId === anchor.screenId;
    }),
  );
  if (!ids.has(anchor.id)) return;
  const els = p.elements.filter((e) => ids.has(e.id));
  const bounds = boundsOf(els.map(elRect))!;
  const targets = snapTargetsFor(p, anchor.screenId, ids);
  const z = st.viewport.z;
  const tol = SNAP_PX / z;
  const reduced = prefersReducedMotion();
  let moved = false;
  let last = { x: start.clientX, y: start.clientY };

  const offsetFor = (e: { clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean }, mode: "magnet" | "exact") => {
    const dx = (e.clientX - start.clientX) / z;
    const dy = (e.clientY - start.clientY) / z;
    const disabled = snapDisabled(e);
    const r = snapMove({ ...bounds, x: bounds.x + dx, y: bounds.y + dy }, targets, tol, mode, disabled);
    const fx = disabled && mode === "exact" ? Math.round(r.x) : r.x;
    const fy = disabled && mode === "exact" ? Math.round(r.y) : r.y;
    return { x: fx - bounds.x, y: fy - bounds.y, guides: r.guides };
  };

  listen(
    (e) => {
      last = { x: e.clientX, y: e.clientY };
      if (!moved) {
        if (Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < DRAG_THRESHOLD) return;
        moved = true;
        dragOX.jump(0);
        dragOY.jump(0);
        useDrag.setState({ ids, screenId: anchor.screenId, guides: [] });
      }
      const o = offsetFor(e, "magnet");
      if (reduced) {
        dragOX.set(o.x);
        dragOY.set(o.y);
      } else {
        animate(dragOX, o.x, FOLLOW_SPRING);
        animate(dragOY, o.y, FOLLOW_SPRING);
      }
      useDrag.setState({ guides: o.guides });
    },
    (e) => {
      if (!moved) return;
      const o = offsetFor(e, "exact");
      useDrag.setState({ guides: [] });
      let done = false;
      const commit = () => {
        if (done) return;
        done = true;
        finishLanding = null;
        dragOX.stop();
        dragOY.stop();
        const world = clientToWorld(last.x, last.y);
        const cur = useEditor.getState().project;
        const target = screenAt(cur, world);
        useEditor.getState().commit((proj) => {
          const patches = new Map<string, Partial<Element>>();
          for (const el of proj.elements) {
            if (!ids.has(el.id)) continue;
            const patch = movedElement(el, el.x + o.x, el.y + o.y);
            // Стрелка, которую тащат за тело, отцепляется от элементов, оставшихся на месте.
            if (patch.arrow) {
              for (const end of [patch.arrow.from, patch.arrow.to]) if (end.el && !ids.has(end.el)) delete end.el;
            }
            patches.set(el.id, patch);
          }
          let q = updateElements(proj, patches);
          if (target && target !== anchor.screenId) q = moveToScreen(q, ids, target);
          return q;
        });
        if (target && target !== anchor.screenId) useEditor.getState().setActiveScreen(target);
        useDrag.setState({ ids: EMPTY_IDS });
      };
      if (reduced) return commit();
      finishLanding = commit;
      Promise.all([animate(dragOX, o.x, LAND), animate(dragOY, o.y, LAND)]).then(commit, commit);
    },
    () => {
      dragOX.jump(0);
      dragOY.jump(0);
      useDrag.setState({ ids: EMPTY_IDS, guides: [] });
    },
  );
}

/** Изменение размера выделения за ручку. Несколько элементов масштабируются пропорционально. */
export function startResize(start: PointerLike, handle: Handle) {
  finishLanding?.();
  const st = useEditor.getState();
  const p = st.project;
  const els = p.elements.filter((e) => st.selection.includes(e.id) && !e.locked);
  const first = els[0];
  if (!first) return;
  const screenId = first.screenId;
  const same = els.filter((e) => e.screenId === screenId);
  const ids = new Set(same.map((e) => e.id));
  const startBounds = boundsOf(same.map(elRect))!;
  const targets = snapTargetsFor(p, screenId, ids);
  const z = st.viewport.z;
  const tol = SNAP_PX / z;
  const edges = { n: handle.includes("n"), s: handle.includes("s"), e: handle.includes("e"), w: handle.includes("w") };
  let began = false;

  const apply = (e: PointerEvent) => {
    const dx = (e.clientX - start.clientX) / z;
    const dy = (e.clientY - start.clientY) / z;
    const keep = e.shiftKey || (same.length === 1 && first.kind === "image" && !!first.content?.image);
    let r = resizeRect(startBounds, handle, dx, dy, keep, 1);
    let guides: ReturnType<typeof snapResize>["guides"] = [];
    if (!keep) {
      const s = snapResize(r, edges, targets, tol, snapDisabled(e));
      r = s.rect;
      guides = s.guides;
    } else if (!snapDisabled(e)) {
      r = { x: roundTo(r.x, 1), y: roundTo(r.y, 1), w: roundTo(r.w, 1), h: roundTo(r.h, 1) };
    }
    const sx = startBounds.w ? r.w / startBounds.w : 1;
    const sy = startBounds.h ? r.h / startBounds.h : 1;
    const patches = new Map<string, Partial<Element>>();
    for (const el of same) {
      const nx = r.x + (el.x - startBounds.x) * sx;
      const ny = r.y + (el.y - startBounds.y) * sy;
      const nw = Math.max(1, el.w * sx);
      const nh = el.h === 0 ? 0 : Math.max(1, el.h * sy);
      const rr = (v: number) => Math.round(v * 10) / 10;
      const patch: Partial<Element> = { x: rr(nx), y: rr(ny), w: rr(nw), h: rr(nh) };
      if (el.arrow) {
        const map = (pt: { x: number; y: number }) => ({ x: rr(r.x + (pt.x - startBounds.x) * sx), y: rr(r.y + (pt.y - startBounds.y) * sy) });
        patch.arrow = { ...el.arrow, from: { ...el.arrow.from, ...map(el.arrow.from) }, to: { ...el.arrow.to, ...map(el.arrow.to) } };
      }
      patches.set(el.id, patch);
    }
    useEditor.getState().transient((proj) => updateElements(proj, patches));
    useDrag.setState({ guides, screenId, sizeTag: { w: Math.round(r.w), h: Math.round(r.h) } });
  };

  listen(
    (e) => {
      if (!began) {
        began = true;
        useEditor.getState().beginTransient();
      }
      apply(e);
    },
    () => useDrag.setState({ guides: [], sizeTag: null }),
    () => useDrag.setState({ guides: [], sizeTag: null }),
  );
}

/** Перетаскивание конца стрелки; отпускание над элементом привязывает конец к нему. */
export function startArrowEndDrag(_start: PointerLike, arrowId: string, end: "from" | "to") {
  const st = useEditor.getState();
  const el = st.project.elements.find((e) => e.id === arrowId);
  const screen = el && st.project.screens.find((s) => s.id === el.screenId);
  if (!el?.arrow || !screen) return;
  let began = false;
  const local = (e: PointerEvent) => {
    const w = clientToWorld(e.clientX, e.clientY);
    return { x: w.x - screen.x, y: w.y - screen.y };
  };
  const hitElement = (pt: { x: number; y: number }) => {
    const list = elementsOf(useEditor.getState().project, screen.id).filter(
      (x) => x.id !== arrowId && x.kind !== "line" && x.kind !== "arrow" && !x.hidden,
    );
    for (let i = list.length - 1; i >= 0; i--) if (contains(elRect(list[i]!), pt)) return list[i]!.id;
    return undefined;
  };
  listen(
    (e) => {
      if (!began) {
        began = true;
        useEditor.getState().beginTransient();
      }
      const pt = local(e);
      const snapPt = snapDisabled(e) ? pt : { x: roundTo(pt.x, GRID), y: roundTo(pt.y, GRID) };
      useEditor.getState().transient((proj) => {
        const cur = proj.elements.find((x) => x.id === arrowId);
        if (!cur?.arrow) return proj;
        const nextEnd = { x: snapPt.x, y: snapPt.y };
        return updateElements(proj, new Map([[arrowId, { arrow: { ...cur.arrow, [end]: nextEnd } }]]));
      });
    },
    (e) => {
      if (!began) return;
      const pt = local(e);
      const target = hitElement(pt);
      if (!target) return;
      useEditor.getState().transient((proj) => {
        const cur = proj.elements.find((x) => x.id === arrowId);
        if (!cur?.arrow) return proj;
        return updateElements(proj, new Map([[arrowId, { arrow: { ...cur.arrow, [end]: { ...cur.arrow[end], el: target } } }]]));
      });
    },
    () => {},
  );
}

/** Перенос экрана за подпись. */
export function startScreenDrag(start: PointerLike, screenId: string) {
  const st = useEditor.getState();
  const s = st.project.screens.find((x) => x.id === screenId);
  if (!s) return;
  const z = st.viewport.z;
  const origin = { x: s.x, y: s.y };
  let began = false;
  st.setActiveScreen(screenId);
  listen(
    (e) => {
      const dx = (e.clientX - start.clientX) / z;
      const dy = (e.clientY - start.clientY) / z;
      if (!began) {
        if (Math.hypot(dx * z, dy * z) < DRAG_THRESHOLD) return;
        began = true;
        useEditor.getState().beginTransient();
      }
      const x = snapDisabled(e) ? origin.x + dx : roundTo(origin.x + dx, GRID * 2);
      const y = snapDisabled(e) ? origin.y + dy : roundTo(origin.y + dy, GRID * 2);
      useEditor.getState().transient((proj) => ({
        ...proj,
        screens: proj.screens.map((sc) => (sc.id === screenId ? { ...sc, x, y } : sc)),
      }));
    },
    () => {},
    () => {},
  );
}
