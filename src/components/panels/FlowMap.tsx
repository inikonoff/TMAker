// Мини-карта связей: граф экранов со стрелками переходов. Клик по узлу открывает экран.
import { useMemo } from "react";
import { flowLayout } from "../../lib/flow";
import { useEditor } from "../../store/editor";
import { focusScreen } from "../canvas/Canvas";
import { requestJump, useRunBus } from "../run/runBus";

const NW = 96;
const NH = 34;
const CW = 128;
const RH = 50;
const PAD = 8;

export function FlowMap() {
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const active = useEditor((s) => s.activeScreen);
  const runCurrent = useRunBus((s) => s.current);
  const visited = useRunBus((s) => s.visited);
  const f = useMemo(() => flowLayout(project), [project]);
  const pos = new Map(f.nodes.map((n) => [n.id, { x: PAD + n.col * CW, y: PAD + n.row * RH }]));
  const w = PAD * 2 + (f.cols - 1) * CW + NW;
  const h = PAD * 2 + (f.rows - 1) * RH + NH;
  const current = mode === "run" ? runCurrent : active;

  return (
    <div className="section">
      <h3>Карта связей</h3>
      {f.edges.length === 0 && <p className="hint" style={{ margin: "0 0 8px" }}>Назначьте кнопке «Перейти на экран» — здесь появятся стрелки.</p>}
      <div style={{ overflow: "auto", maxHeight: 280 }}>
        <svg width={w} height={h} role="img" aria-label="Граф переходов" style={{ display: "block" }}>
          <defs>
            <marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--muted)" />
            </marker>
          </defs>
          {f.edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const forward = b.x > a.x;
            const x1 = forward ? a.x + NW : a.x + NW / 2;
            const y1 = forward ? a.y + NH / 2 : a.y + NH;
            const x2 = forward ? b.x : b.x + NW / 2;
            const y2 = forward ? b.y + NH / 2 : b.y + NH;
            const d = forward
              ? `M${x1} ${y1} C${x1 + 24} ${y1} ${x2 - 24} ${y2} ${x2} ${y2}`
              : `M${x1} ${y1} C${x1} ${y1 + 30} ${x2} ${y2 + 30} ${x2} ${y2}`;
            return (
              <path key={i} d={d} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeDasharray={e.kind === "swipe" ? "4 3" : undefined} markerEnd="url(#fm-arrow)">
                <title>{e.label}</title>
              </path>
            );
          })}
          {f.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const on = n.id === current;
            const seen = mode === "run" && visited.includes(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (mode === "run") requestJump(n.id);
                  else {
                    useEditor.getState().setActiveScreen(n.id);
                    focusScreen(n.id);
                  }
                }}
              >
                <rect width={NW} height={NH} rx={9} fill={on ? "var(--accent-soft)" : "var(--panel)"} stroke={on ? "var(--accent)" : seen ? "var(--accent)" : "var(--line-strong)"} strokeDasharray={seen && !on ? "3 2" : undefined} />
                <text x={NW / 2} y={NH / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">
                  {n.name.length > 13 ? n.name.slice(0, 12) + "…" : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
