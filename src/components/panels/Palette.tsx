import type { PointerEvent as RPointerEvent, ReactElement } from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clientToWorld, screenAt } from "../canvas/gestures";
import { KIND_GROUPS, KIND_SPEC, makeElement } from "../../lib/defaults";
import { screenSize } from "../../lib/devices";
import type { Kind } from "../../lib/model";
import { KINDS } from "../../lib/model";
import { addElements, elementsOf, maxZ } from "../../lib/ops";
import { placeNew } from "../../lib/placement";
import { useEditor } from "../../store/editor";
import { tr } from "../../lib/i18n";

/** Миниатюры видов элементов в палитре. */
function KindGlyph({ kind }: { kind: Kind }) {
  const c = "currentColor";
  const box = (r = 3, fill = "none") => <rect x="4" y="7" width="16" height="10" rx={r} fill={fill} stroke={c} />;
  const glyphs: Partial<Record<Kind, ReactElement>> = {
    button: <rect x="3" y="8" width="18" height="8" rx="4" fill={c} opacity=".85" />,
    text: <path d="M5 7h14M12 7v11" stroke={c} />,
    image: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke={c} />
        <path d="M4 16l5-5 4 4 2-2 5 4" fill="none" stroke={c} />
      </>
    ),
    shape: <path d="M12 4l2.5 5.2 5.5.6-4.1 3.8 1.2 5.6L12 16.4 6.9 19.2l1.2-5.6L4 9.8l5.5-.6z" fill="none" stroke={c} />,
    line: <path d="M4 18L20 6" stroke={c} />,
    arrow: <path d="M4 18L19 7M13 7h6v6" fill="none" stroke={c} />,
    box: box(2),
    card: (
      <>
        {box(3)}
        <path d="M7 11h7" stroke={c} />
      </>
    ),
    input: (
      <>
        {box(2)}
        <path d="M7 10v4" stroke={c} />
      </>
    ),
    list: <path d="M5 7h14M5 12h14M5 17h14" stroke={c} />,
    tabs: (
      <>
        <rect x="3" y="8" width="18" height="8" rx="3" fill="none" stroke={c} />
        <rect x="4.5" y="9.5" width="6" height="5" rx="2" fill={c} />
      </>
    ),
    nav: <path d="M3 16h18M6 10h2M11 10h2M16 10h2" stroke={c} />,
    divider: <path d="M3 12h18" stroke={c} />,
    badge: <rect x="6" y="9" width="12" height="6" rx="3" fill={c} />,
    switch: (
      <>
        <rect x="4" y="8" width="16" height="8" rx="4" fill="none" stroke={c} />
        <circle cx="16" cy="12" r="2.5" fill={c} />
      </>
    ),
    checkbox: (
      <>
        <rect x="5" y="7" width="10" height="10" rx="2" fill="none" stroke={c} />
        <path d="M7.5 12l2 2 3.5-4" fill="none" stroke={c} />
      </>
    ),
    slider: (
      <>
        <path d="M3 12h18" stroke={c} />
        <circle cx="10" cy="12" r="3" fill={c} />
      </>
    ),
    mainButton: (
      <>
        <rect x="3" y="14" width="18" height="6" rx="2" fill={c} />
        <rect x="3" y="4" width="18" height="8" rx="2" fill="none" stroke={c} opacity=".4" />
      </>
    ),
    backButton: <path d="M14 6l-6 6 6 6" fill="none" stroke={c} />,
    headerBar: (
      <>
        <rect x="3" y="5" width="18" height="5" rx="1" fill={c} opacity=".85" />
        <rect x="3" y="12" width="18" height="7" rx="1" fill="none" stroke={c} opacity=".4" />
      </>
    ),
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      {glyphs[kind]}
    </svg>
  );
}

/** Добавить элемент. Без точки — под последним элементом активного экрана; с точкой — центром в неё. */
export function addKind(kind: Kind, at?: { screenId: string; x: number; y: number }) {
  const st = useEditor.getState();
  const p = st.project;
  const screen = p.screens.find((s) => s.id === (at?.screenId ?? st.activeScreen)) ?? p.screens[0];
  if (!screen) return;
  const size = screenSize(p, screen);
  const pos = placeNew(kind, size, KIND_SPEC[kind], elementsOf(p, screen.id));
  // Шапка, навигация и MainButton всегда на своих местах; остальное — куда бросили.
  if (at && !["headerBar", "nav", "mainButton"].includes(kind)) {
    const h = KIND_SPEC[kind].h;
    pos.x = Math.max(0, Math.min(size.w - pos.w, Math.round((at.x - pos.w / 2) / 4) * 4));
    pos.y = Math.max(0, Math.min(size.h - h, Math.round((at.y - h / 2) / 4) * 4));
  }
  const el = makeElement(kind, screen.id, pos, maxZ(p, screen.id) + 1, p.theme);
  el.w = pos.w;
  if (el.arrow) {
    el.arrow.from = { x: el.x, y: el.y + 12 };
    el.arrow.to = { x: el.x + pos.w, y: el.y + 12 };
  }
  st.commit((proj) => addElements(proj, [el]));
  st.setActiveScreen(screen.id);
  st.select([el.id]);
}

type Ghost = { kind: Kind; x: number; y: number; over: boolean };

export function Palette() {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const dragged = useRef(false);

  /** Перетаскивание из палитры: призрак следует за курсором, отпускание над экраном ставит элемент в точку. */
  const onPointerDown = (e: RPointerEvent, kind: Kind) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    dragged.current = false;
    const target = (ev: PointerEvent) => {
      const canvas = document.querySelector(".canvas");
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!canvas || !hit || !canvas.contains(hit)) return null;
      const w = clientToWorld(ev.clientX, ev.clientY);
      const p = useEditor.getState().project;
      const id = screenAt(p, w);
      const s = id && p.screens.find((x) => x.id === id);
      return s ? { screenId: s.id, x: w.x - s.x, y: w.y - s.y } : null;
    };
    const move = (ev: PointerEvent) => {
      if (!dragged.current && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      dragged.current = true;
      setGhost({ kind, x: ev.clientX, y: ev.clientY, over: !!target(ev) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setGhost(null);
      if (!dragged.current) return;
      const at = target(ev);
      if (at) addKind(kind, at);
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setGhost(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  return (
    <div className="section" data-tour="palette">
      <h3>{tr("Элементы")}</h3>
      <p className="hint" style={{ margin: "-4px 0 4px" }}>
        {tr("Нажмите, чтобы добавить, или перетащите на экран.")}
      </p>
      {KIND_GROUPS.map((g) => (
        <div key={g.id}>
          <div className="palette-group">{tr(g.label)}</div>
          <div className="palette">
            {KINDS.filter((k) => KIND_SPEC[k].group === g.id).map((k) => (
              <button
                key={k}
                onPointerDown={(e) => onPointerDown(e, k)}
                onClick={() => {
                  // Клик после перетаскивания не добавляет второй элемент.
                  if (!dragged.current) addKind(k);
                  dragged.current = false;
                }}
                title={tr("Добавить: {k}", { k: tr(KIND_SPEC[k].label) })}
              >
                <KindGlyph kind={k} />
                {tr(KIND_SPEC[k].label)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {ghost &&
        createPortal(
          <div className={`palette-ghost${ghost.over ? " over" : ""}`} style={{ left: ghost.x, top: ghost.y }}>
            <KindGlyph kind={ghost.kind} />
            {tr(KIND_SPEC[ghost.kind].label)}
          </div>,
          document.body,
        )}
    </div>
  );
}
