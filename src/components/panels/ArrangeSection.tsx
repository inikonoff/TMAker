import type { AlignMode } from "../../lib/arrange";
import { alignRects, distributeRects } from "../../lib/arrange";
import { screenSize } from "../../lib/devices";
import { uid } from "../../lib/ids";
import type { Element } from "../../lib/model";
import { movedElement, updateElements } from "../../lib/ops";
import { useEditor } from "../../store/editor";
import { Icon } from "../Icon";

const ALIGN: { mode: AlignMode; label: string; title: string }[] = [
  { mode: "left", label: "⇤", title: "По левому краю" },
  { mode: "hcenter", label: "↔", title: "По центру" },
  { mode: "right", label: "⇥", title: "По правому краю" },
  { mode: "top", label: "⤒", title: "По верху" },
  { mode: "vcenter", label: "↕", title: "По середине" },
  { mode: "bottom", label: "⤓", title: "По низу" },
];

function applyRects(fn: (els: Element[], frame: { x: number; y: number; w: number; h: number }) => { x: number; y: number }[]) {
  const st = useEditor.getState();
  const ids = new Set(st.selection);
  st.commit((p) => {
    const els = p.elements.filter((e) => ids.has(e.id) && !e.locked);
    const first = els[0];
    if (!first) return p;
    const same = els.filter((e) => e.screenId === first.screenId);
    const screen = p.screens.find((s) => s.id === first.screenId)!;
    const { w, h } = screenSize(p, screen);
    const next = fn(same, { x: 0, y: 0, w, h });
    const patches = new Map<string, Partial<Element>>();
    same.forEach((e, i) => {
      const r = next[i]!;
      patches.set(e.id, movedElement(e, Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10));
    });
    return updateElements(p, patches);
  });
}

/** Выравнивание, распределение и группы. Для одного элемента выравнивание идёт по экрану. */
export function ArrangeSection() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const sel = project.elements.filter((e) => selection.includes(e.id));
  const grouped = sel.length > 1 && sel.every((e) => e.group && e.group === sel[0]!.group);
  const toggleGroup = () => {
    const ids = new Set(selection);
    const g = grouped ? undefined : uid("g");
    useEditor.getState().commit((p) => updateElements(p, new Map(p.elements.filter((e) => ids.has(e.id)).map((e) => [e.id, { group: g }]))));
  };
  return (
    <div className="section">
      <h3>Расположение</h3>
      <div className="row" style={{ gap: 2 }}>
        {ALIGN.map((a) => (
          <button key={a.mode} className="btn sm" title={a.title} onClick={() => applyRects((els, frame) => alignRects(els, a.mode, frame))}>
            {a.label}
          </button>
        ))}
      </div>
      {sel.length > 2 && (
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm ghost-line" onClick={() => applyRects((els) => distributeRects(els, "x"))}>
            Распределить ↔
          </button>
          <button className="btn sm ghost-line" onClick={() => applyRects((els) => distributeRects(els, "y"))}>
            Распределить ↕
          </button>
        </div>
      )}
      {sel.length > 1 && (
        <button className={`btn sm ghost-line${grouped ? " on" : ""}`} onClick={toggleGroup} title="Ctrl+G / Ctrl+Shift+G">
          <Icon name="group" size={15} /> {grouped ? "Разгруппировать" : "Сгруппировать"}
        </button>
      )}
    </div>
  );
}
