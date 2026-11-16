// Свойства проекта и тема приложения (когда ничего не выделено).
import { DEVICE_PRESETS } from "../../lib/devices";
import type { DevicePreset, Theme } from "../../lib/model";
import { useEditor } from "../../store/editor";
import { NumField, Row, Seg } from "./controls";

export function setTheme(patch: Partial<Theme>, key: string) {
  useEditor.getState().commit((p) => ({ ...p, theme: { ...p.theme, ...patch } }), key);
}

const DARK_NAMES = ["Почти чёрный", "Графит", "Тёмно-серый", "Серый", "Светло-серый"];

export function ProjectPanel() {
  const project = useEditor((s) => s.project);
  const commit = useEditor((s) => s.commit);
  const t = project.theme;
  const custom = typeof project.device === "object";
  return (
    <>
      <div className="section">
        <h3>Проект</h3>
        <input
          className="input"
          value={project.title}
          placeholder="Название"
          onChange={(e) => commit((p) => ({ ...p, title: e.target.value }), "title")}
          style={{ marginBottom: 8 }}
        />
        <textarea
          className="input"
          value={project.brief}
          rows={4}
          placeholder="Коротко: что за приложение, для кого, что делает бот"
          onChange={(e) => commit((p) => ({ ...p, brief: e.target.value }), "brief")}
        />
      </div>
      <div className="section">
        <h3>Устройство по умолчанию</h3>
        <select
          className="input"
          value={custom ? "custom" : (project.device as string)}
          style={{ marginBottom: 8 }}
          onChange={(e) => {
            const v = e.target.value;
            commit((p) => ({ ...p, device: v === "custom" ? { w: 390, h: 844 } : (v as DevicePreset) }));
          }}
        >
          {Object.values(DEVICE_PRESETS).map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} {d.w}×{d.h}
            </option>
          ))}
          <option value="custom">Свой размер</option>
        </select>
        {typeof project.device === "object" && (
          <div className="grid2">
            {(["w", "h"] as const).map((k) => (
              <NumField
                key={k}
                label={k === "w" ? "Ш" : "В"}
                min={120}
                max={4000}
                value={(project.device as { w: number; h: number })[k]}
                onChange={(v) => commit((p) => ({ ...p, device: { ...(p.device as { w: number; h: number }), [k]: v } }), `pdev-${k}`)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="section">
        <h3>Тема приложения</h3>
        <Row label="Режим">
          <Seg
            value={t.mode}
            options={[
              { value: "light", label: "Светлая" },
              { value: "dark", label: "Тёмная" },
            ]}
            onChange={(v) => setTheme({ mode: v }, "mode")}
          />
        </Row>
        {t.mode === "dark" && (
          <Row label="Серый">
            <div style={{ flex: 1 }}>
              <input
                type="range"
                min={0}
                max={4}
                step={0.05}
                value={t.darkLevel}
                aria-label="Уровень серого тёмной темы"
                onChange={(e) => setTheme({ darkLevel: Number(e.target.value) }, "darkLevel")}
              />
              <div className="hint">{DARK_NAMES[Math.round(t.darkLevel)]}</div>
            </div>
          </Row>
        )}
        <Row label="Акцент">
          <input type="color" value={t.accent.slice(0, 7)} onChange={(e) => setTheme({ accent: e.target.value }, "accent")} />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["#2f80ed", "#8774e1", "#24a148", "#f2994a", "#eb5757", "#111318"].map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setTheme({ accent: c }, "accent")}
                style={{ width: 22, height: 22, borderRadius: 7, border: t.accent === c ? "2px solid var(--text)" : "1px solid var(--line)", background: c, cursor: "pointer" }}
              />
            ))}
          </div>
        </Row>
        <Row label="Скругление">
          <input type="range" min={0} max={28} value={t.radius} onChange={(e) => setTheme({ radius: Number(e.target.value) }, "radius")} />
        </Row>
        <Row label="Движение">
          <Seg
            value={t.motion}
            options={[
              { value: "standard", label: "Спокойное" },
              { value: "expressive", label: "Пружины" },
            ]}
            onChange={(v) => setTheme({ motion: v }, "motion")}
          />
        </Row>
      </div>
    </>
  );
}
