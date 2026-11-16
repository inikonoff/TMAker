import { useEffect, useRef, useState } from "react";
import { emptyProject } from "../lib/defaults";
import { resetHistory, useEditor } from "../store/editor";
import { ExportDialog } from "./export/ExportDialog";
import { pickJson, saveJson } from "./files";
import { HOTKEYS } from "./hotkeys";
import { Icon } from "./Icon";
import { runTidy } from "./tidyAction";

function Menu({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", h, true);
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("pointerdown", h, true);
      window.removeEventListener("keydown", k);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="popover" style={{ top: 48, right: 8, position: "fixed" }} role="menu">
      {children}
    </div>
  );
}

export function Toolbar({ extra }: { extra?: React.ReactNode }) {
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const mode = useEditor((s) => s.mode);
  const editorTheme = useEditor((s) => s.editorTheme);
  const title = useEditor((s) => s.project.title);
  const st = useEditor.getState;
  const [menu, setMenu] = useState<null | "file" | "keys">(null);
  const [exporting, setExporting] = useState(false);
  const close = () => setMenu(null);

  return (
    <header className="topbar">
      <div className="brand">
        TMA<span>·</span>Builder
      </div>
      <span className="hint hide-mobile" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
      <span className="sep" />
      <button className="btn" disabled={!canUndo || mode === "run"} onClick={() => st().undo()} title="Отменить (Ctrl+Z)" aria-label="Отменить">
        <Icon name="undo" />
      </button>
      <button className="btn" disabled={!canRedo || mode === "run"} onClick={() => st().redo()} title="Вернуть (Ctrl+Shift+Z)" aria-label="Вернуть">
        <Icon name="redo" />
      </button>
      <button className="btn hide-mobile" disabled={mode === "run"} onClick={runTidy} title="Упорядочить экран (Shift+T). Повторное нажатие отменяет">
        <Icon name="tidy" /> Упорядочить
      </button>
      {extra}
      <span className="spacer" />
      <button
        className={`btn ${mode === "run" ? "on" : "primary"}`}
        onClick={() => st().setMode(mode === "run" ? "edit" : "run")}
        title="Запустить сценарий (P)"
      >
        <Icon name={mode === "run" ? "stop" : "play"} /> {mode === "run" ? "Стоп" : "Запустить"}
      </button>
      <button className="btn ghost-line" onClick={() => setExporting(true)} title="Экспорт: папка для VS Code, ZIP, ссылка">
        <Icon name="download" /> <span className="hide-mobile">Экспорт</span>
      </button>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      <button
        className="btn"
        onClick={() => st().setEditorTheme(editorTheme === "light" ? "dark" : "light")}
        title="Тема редактора"
        aria-label="Тема редактора"
      >
        <Icon name={editorTheme === "light" ? "moon" : "sun"} />
      </button>
      <button className="btn" onClick={() => setMenu(menu === "file" ? null : "file")} aria-haspopup="menu" aria-label="Меню">
        <Icon name="more" />
      </button>
      {menu === "file" && (
        <Menu onClose={close}>
          <button
            className="menu-item"
            onClick={() => {
              close();
              if (!confirm("Начать новый проект? Текущий можно вернуть через Отменить.")) return;
              st().replaceProject(emptyProject());
            }}
          >
            <Icon name="file" /> Новый проект
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              pickJson();
            }}
          >
            <Icon name="upload" /> Открыть JSON…
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              saveJson();
            }}
          >
            <Icon name="download" /> Сохранить JSON
          </button>
          <button className="menu-item" onClick={() => setMenu("keys")}>
            <Icon name="settings" /> Горячие клавиши
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              resetHistory();
              st().showToast("История очищена");
            }}
          >
            <Icon name="trash" /> Очистить историю
          </button>
        </Menu>
      )}
      {menu === "keys" && (
        <Menu onClose={close}>
          <div style={{ padding: 8, maxHeight: "70vh", overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {HOTKEYS.map(([k, d]) => (
                  <tr key={k}>
                    <td style={{ padding: "4px 12px 4px 0", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{k}</td>
                    <td style={{ padding: "4px 0", color: "var(--muted)" }}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Menu>
      )}
    </header>
  );
}
