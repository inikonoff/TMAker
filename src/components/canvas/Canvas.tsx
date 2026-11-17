// Холст: панорама и зум одной CSS-трансформацией, рамка выбора, щипок.
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { themeTokens } from "../../lib/color";
import { screenDevice, screenSize } from "../../lib/devices";
import type { Viewport } from "../../lib/geometry";
import { boundsOf, clamp, fitRect, intersects, inverseScale, rectFromPoints, toWorld, wheelZoom, zoomAt, ZOOM_MAX, ZOOM_MIN } from "../../lib/geometry";
import type { Element } from "../../lib/model";
import { screenRect } from "../../lib/ops";
import { useDrag } from "../../store/drag";
import { useEditor } from "../../store/editor";
import { Icon } from "../Icon";
import { cancelGesture, screenAt, setCanvasElement } from "./gestures";
import { keys } from "./keys";
import { GuidesLayer, SelectionOverlay } from "./Overlay";
import { ScreenFrame } from "./ScreenFrame";
import { tr } from "../../lib/i18n";

export function fitAll(el: HTMLElement | null) {
  const st = useEditor.getState();
  const p = st.project;
  const b = boundsOf(p.screens.map((s) => screenRect(p, s)));
  if (!b || !el) return;
  st.setViewport(fitRect({ ...b, y: b.y - 30, h: b.h + 30 }, el.clientWidth, el.clientHeight));
}

export function focusScreen(id: string) {
  const el = document.querySelector<HTMLElement>(".canvas");
  const st = useEditor.getState();
  const s = st.project.screens.find((x) => x.id === id);
  if (!s || !el) return;
  const r = screenRect(st.project, s);
  st.setViewport(fitRect({ ...r, y: r.y - 30, h: r.h + 30 }, el.clientWidth, el.clientHeight, 40));
}

export function Canvas() {
  const ref = useRef<HTMLDivElement>(null);
  const project = useEditor((s) => s.project);
  const viewport = useEditor((s) => s.viewport);
  const activeScreen = useEditor((s) => s.activeScreen);
  const snapOff = useEditor((s) => s.snapOff);
  const dragging = useDrag((s) => s.ids.size > 0);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const tokens = useMemo(() => themeTokens(project.theme), [project.theme]);

  const byScreen = useMemo(() => {
    const m = new Map<string, Element[]>();
    for (const s of project.screens) m.set(s.id, []);
    for (const e of project.elements) m.get(e.screenId)?.push(e);
    for (const list of m.values()) list.sort((a, b) => a.z - b.z);
    return m;
  }, [project.screens, project.elements]);

  useEffect(() => {
    setCanvasElement(ref.current);
    return () => setCanvasElement(null);
  }, []);

  // Колесо — масштаб к курсору; Shift + колесо — панорама (для трекпада). Нативный слушатель, passive: false.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useEditor.getState();
      const v = st.viewport;
      const r = el.getBoundingClientRect();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (e.shiftKey) {
        // Shift+колесо у мыши даёт deltaY, у трекпада — обе оси.
        const dx = e.deltaX || e.deltaY;
        const dy = e.deltaX ? e.deltaY : 0;
        st.setViewport({ ...v, x: v.x - dx * k, y: v.y - dy * k });
      } else {
        st.setViewport(zoomAt(v, { x: e.clientX - r.left, y: e.clientY - r.top }, wheelZoom(v.z, e.deltaY * k)));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.code === "Space" && keys.space && setSpace(true);
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Щипок двумя пальцами — в фазе захвата, чтобы работал и поверх элементов.
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; v: Viewport } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDownCapture = (e: RPointerEvent) => {
    if (e.pointerType !== "touch") return;
    touches.current.set(e.pointerId, local(e));
    if (touches.current.size === 2) {
      cancelGesture();
      const [a, b] = [...touches.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        v: useEditor.getState().viewport,
      };
      e.stopPropagation();
    }
  };

  const onPointerMoveCapture = (e: RPointerEvent) => {
    if (e.pointerType !== "touch" || !touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, local(e));
    const pz = pinch.current;
    if (!pz || touches.current.size < 2) return;
    const [a, b] = [...touches.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const z = clamp((pz.v.z * dist) / Math.max(1, pz.dist), ZOOM_MIN, ZOOM_MAX);
    const zoomed = zoomAt(pz.v, pz.mid, z);
    useEditor.getState().setViewport({ ...zoomed, x: zoomed.x + mid.x - pz.mid.x, y: zoomed.y + mid.y - pz.mid.y });
  };

  const endTouch = (e: RPointerEvent) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
  };

  const startPan = (e: RPointerEvent) => {
    const start = { x: e.clientX, y: e.clientY };
    const v0 = useEditor.getState().viewport;
    setPanning(true);
    const move = (ev: PointerEvent) => {
      if (pinch.current) return;
      useEditor.getState().setViewport({ ...v0, x: v0.x + ev.clientX - start.x, y: v0.y + ev.clientY - start.y });
    };
    const up = () => {
      setPanning(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const startMarquee = (e: RPointerEvent) => {
    const st = useEditor.getState();
    const a = toWorld(st.viewport, local(e));
    const additive = e.shiftKey || e.metaKey;
    const before = additive ? st.selection : [];
    let moved = false;
    const move = (ev: PointerEvent) => {
      const b = toWorld(useEditor.getState().viewport, local(ev));
      if (!moved && Math.hypot(b.x - a.x, b.y - a.y) * st.viewport.z < 4) return;
      moved = true;
      useDrag.setState({ marquee: rectFromPoints(a, b) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const s = useEditor.getState();
      const p = s.project;
      if (!moved) {
        const id = screenAt(p, toWorld(s.viewport, local(ev)));
        if (id) s.setActiveScreen(id);
        if (!additive) s.select([]);
        return;
      }
      const m = useDrag.getState().marquee!;
      useDrag.setState({ marquee: null });
      const hit: string[] = [];
      for (const el of p.elements) {
        const sc = p.screens.find((x) => x.id === el.screenId);
        if (!sc || el.locked) continue;
        if (intersects(m, { x: sc.x + el.x, y: sc.y + el.y, w: Math.max(1, el.w), h: Math.max(1, el.h) })) hit.push(el.id);
      }
      s.select([...before, ...hit]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (pinch.current) return;
    // Правая или средняя кнопка — двигать холст; пробел + левая и касание пальцем — тоже.
    const panButton = e.button === 2 || e.button === 1 || (e.button === 0 && (keys.space || e.pointerType === "touch"));
    if (panButton) {
      e.preventDefault();
      startPan(e);
      if (e.pointerType === "touch") {
        // Касание по пустому месту экрана делает его активным и снимает выделение.
        const s = useEditor.getState();
        const id = screenAt(s.project, toWorld(s.viewport, local(e)));
        if (id) s.setActiveScreen(id);
        s.select([]);
      }
      return;
    }
    if (e.button === 0) startMarquee(e);
  };

  const zoomBy = (k: number) => {
    const el = ref.current;
    if (!el) return;
    const st = useEditor.getState();
    st.setViewport(zoomAt(st.viewport, { x: el.clientWidth / 2, y: el.clientHeight / 2 }, st.viewport.z * k));
  };

  const inv = inverseScale(viewport.z);
  const style = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.z})`,
    "--inv": inv,
  } as CSSProperties;
  const dot = 20 * viewport.z;

  return (
    <div
      ref={ref}
      data-tour="canvas"
      className={`canvas${panning ? " panning" : space ? " space" : ""}${dragging ? " dragging" : ""}`}
      style={{ backgroundSize: `${dot}px ${dot}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={endTouch}
      onPointerCancelCapture={endTouch}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="world" style={style}>
        {project.screens.map((s, i) => {
          const { w, h } = screenSize(project, s);
          return (
            <ScreenFrame
              key={s.id}
              screen={s}
              w={w}
              h={h}
              device={screenDevice(project, s)}
              elements={byScreen.get(s.id) ?? []}
              tokens={tokens}
              active={s.id === activeScreen}
              index={i}
            />
          );
        })}
        <SelectionOverlay project={project} />
        <GuidesLayer project={project} />
      </div>
      <div className="canvas-hud" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn sm" onClick={() => zoomBy(1 / 1.2)} aria-label={tr("Отдалить")}>
          <Icon name="minus" />
        </button>
        <button className="btn sm zoom-label" onClick={() => zoomBy(1 / viewport.z)} title={tr("Масштаб 100%")}>
          {Math.round(viewport.z * 100)}%
        </button>
        <button className="btn sm" onClick={() => zoomBy(1.2)} aria-label={tr("Приблизить")}>
          <Icon name="plus" />
        </button>
        <button className="btn sm" onClick={() => fitAll(ref.current)} title={tr("Показать все экраны (Shift+1)")}>
          <Icon name="fit" />
        </button>
        <button
          className={`btn sm${snapOff ? "" : " on"}`}
          onClick={() => useEditor.getState().setSnapOff(!snapOff)}
          title={tr("Привязка к направляющим (удерживайте Ctrl, чтобы временно отключить)")}
          aria-pressed={!snapOff}
        >
          <Icon name="magnet" />
        </button>
      </div>
    </div>
  );
}
