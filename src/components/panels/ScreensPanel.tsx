import { Reorder, useDragControls } from "motion/react";
import { useEffect, useState } from "react";
import { DEVICE_PRESETS, deviceLabel } from "../../lib/devices";
import type { Screen } from "../../lib/model";
import { addScreen, deleteScreen, duplicateScreen, reorderScreens, setScreenDevice, updateScreen } from "../../lib/ops";
import { useEditor } from "../../store/editor";
import { focusScreen } from "../canvas/Canvas";
import { Icon } from "../Icon";

/** Пружина раскрытия места: одинаковая у обеих сторон, чтобы сдвиги гасили друг друга. */
const REORDER_SPRING = { type: "spring", stiffness: 700, damping: 42, mass: 0.55 } as const;

function ScreenRow({ s, index, active, onDragEnd }: { s: Screen; index: number; active: boolean; onDragEnd: () => void }) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const project = useEditor((st) => st.project);
  const device = s.device ?? project.device;

  const save = () => {
    setEditing(false);
    const v = name.trim();
    if (v && v !== s.name) useEditor.getState().commit((p) => updateScreen(p, s.id, { name: v }));
    else setName(s.name);
  };

  return (
    <Reorder.Item
      value={s.id}
      dragListener={false}
      dragControls={controls}
      transition={REORDER_SPRING}
      onDragEnd={onDragEnd}
      className={`screen-item${active ? " active" : ""}`}
      onClick={() => {
        useEditor.getState().setActiveScreen(s.id);
        focusScreen(s.id);
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <span className="grip" onPointerDown={(e) => controls.start(e)} aria-label="Перетащить">
        <Icon name="grip" size={16} />
      </span>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setName(s.name);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="name" title="Двойной клик — переименовать">
          {index + 1}. {s.name}
        </span>
      )}
      <span className="meta">{deviceLabel(device)}</span>
    </Reorder.Item>
  );
}

export function ScreensPanel() {
  const project = useEditor((s) => s.project);
  const active = useEditor((s) => s.activeScreen);
  const ids = project.screens.map((s) => s.id);
  const [order, setOrder] = useState(ids);
  const key = ids.join(",");
  useEffect(() => setOrder(key.split(",")), [key]);
  const activeScreen = project.screens.find((s) => s.id === active);
  const commit = useEditor((s) => s.commit);

  const add = () => {
    let id = "";
    commit((p) => {
      const r = addScreen(p);
      id = r.id;
      return r.project;
    });
    useEditor.getState().setActiveScreen(id);
    requestAnimationFrame(() => focusScreen(id));
  };

  const duplicate = () => {
    let id = "";
    commit((p) => {
      const r = duplicateScreen(p, active);
      if (!r) return p;
      id = r.id;
      return r.project;
    });
    if (id) useEditor.getState().setActiveScreen(id);
  };

  const remove = () => {
    if (project.screens.length <= 1) return useEditor.getState().showToast("Последний экран удалить нельзя");
    commit((p) => deleteScreen(p, active));
  };

  const byId = new Map(project.screens.map((s) => [s.id, s]));
  return (
    <>
      <div className="section">
        <h3>
          Экраны
          <button className="btn sm" onClick={add} title="Добавить экран">
            <Icon name="plus" />
          </button>
        </h3>
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="screen-list" as="ul">
          {order.map((id, i) => {
            const s = byId.get(id);
            return s ? (
              <ScreenRow
                key={id}
                s={s}
                index={i}
                active={id === active}
                onDragEnd={() => commit((p) => reorderScreens(p, order))}
              />
            ) : null;
          })}
        </Reorder.Group>
      </div>
      {activeScreen && (
        <div className="section">
          <h3>Экран</h3>
          <div className="row">
            <label>Устройство</label>
            <select
              className="input"
              value={typeof activeScreen.device === "string" ? activeScreen.device : activeScreen.device ? "custom" : ""}
              onChange={(e) => {
                const v = e.target.value;
                commit((p) =>
                  setScreenDevice(p, activeScreen.id, v === "" ? undefined : v === "custom" ? { w: 390, h: 844 } : (v as keyof typeof DEVICE_PRESETS)),
                );
              }}
            >
              <option value="">Как у проекта ({deviceLabel(project.device)})</option>
              {Object.values(DEVICE_PRESETS).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} {d.w}×{d.h}
                </option>
              ))}
              <option value="custom">Свой размер</option>
            </select>
          </div>
          {typeof activeScreen.device === "object" && (
            <div className="grid2">
              {(["w", "h"] as const).map((k) => (
                <label className="field" key={k}>
                  <span>{k === "w" ? "Ш" : "В"}</span>
                  <input
                    type="number"
                    min={120}
                    max={4000}
                    value={(activeScreen.device as { w: number; h: number })[k]}
                    onChange={(e) => {
                      const d = activeScreen.device as { w: number; h: number };
                      const n = Math.max(120, Math.min(4000, Number(e.target.value) || 0));
                      commit((p) => setScreenDevice(p, activeScreen.id, { ...d, [k]: n }), `dev-${k}`);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 4 }}>
            <button className="btn sm ghost-line" onClick={duplicate}>
              <Icon name="copy" size={15} /> Дублировать
            </button>
            <button className="btn sm ghost-line danger" onClick={remove}>
              <Icon name="trash" size={15} /> Удалить
            </button>
          </div>
          <label className="hint" htmlFor="screen-note">
            Заметка для модели
          </label>
          <textarea
            id="screen-note"
            className="input"
            value={activeScreen.note}
            placeholder="Что происходит на экране, откуда приходят данные…"
            onChange={(e) => commit((p) => updateScreen(p, activeScreen.id, { note: e.target.value }), `note-${activeScreen.id}`)}
          />
        </div>
      )}
    </>
  );
}
