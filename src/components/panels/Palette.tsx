import type { ReactElement } from "react";
import { KIND_GROUPS, KIND_SPEC, makeElement } from "../../lib/defaults";
import { screenSize } from "../../lib/devices";
import type { Kind } from "../../lib/model";
import { KINDS } from "../../lib/model";
import { addElements, elementsOf, maxZ } from "../../lib/ops";
import { placeNew } from "../../lib/placement";
import { useEditor } from "../../store/editor";

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

/** Добавить элемент на активный экран: в видимую часть, со сдвигом, чтобы не ложились стопкой. */
export function addKind(kind: Kind) {
  const st = useEditor.getState();
  const p = st.project;
  const screen = p.screens.find((s) => s.id === st.activeScreen) ?? p.screens[0];
  if (!screen) return;
  const size = screenSize(p, screen);
  const pos = placeNew(kind, size, KIND_SPEC[kind], elementsOf(p, screen.id));
  const el = makeElement(kind, screen.id, pos, maxZ(p, screen.id) + 1, p.theme);
  el.w = pos.w;
  if (el.arrow) {
    el.arrow.from = { x: el.x, y: el.y + 12 };
    el.arrow.to = { x: el.x + pos.w, y: el.y + 12 };
  }
  st.commit((proj) => addElements(proj, [el]));
  st.select([el.id]);
}

export function Palette() {
  return (
    <div className="section">
      <h3>Элементы</h3>
      {KIND_GROUPS.map((g) => (
        <div key={g.id}>
          <div className="palette-group">{g.label}</div>
          <div className="palette">
            {KINDS.filter((k) => KIND_SPEC[k].group === g.id).map((k) => (
              <button key={k} onClick={() => addKind(k)} title={`Добавить: ${KIND_SPEC[k].label}`}>
                <KindGlyph kind={k} />
                {KIND_SPEC[k].label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
