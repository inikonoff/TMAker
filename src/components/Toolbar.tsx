import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LANGS } from "../lib/i18n";
import { startTour } from "./onboarding/Tour";
import { resetHistory, useEditor } from "../store/editor";
import { pickJson, saveJson } from "./files";
import { HOTKEYS } from "./hotkeys";
import { Icon } from "./Icon";
import { runTidy } from "./tidyAction";
import { tr } from "../lib/i18n";

// Окна грузятся по требованию: fflate и html-to-image нужны только при экспорте.
const AiDialog = lazy(() => import("./ai/AiDialog").then((m) => ({ default: m.AiDialog })));
const DataDialog = lazy(() => import("./data/DataDialog").then((m) => ({ default: m.DataDialog })));
const ProjectsDialog = lazy(() => import("./projects/ProjectsDialog").then((m) => ({ default: m.ProjectsDialog })));
const ExportDialog = lazy(() => import("./export/ExportDialog").then((m) => ({ default: m.ExportDialog })));

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
  const [dataOpen, setDataOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [projects, setProjects] = useState<null | "projects" | "new" | "versions">(null);
  const close = () => setMenu(null);

  return (
    <header className="topbar">
      <div className="brand hide-mobile">
        TMA<span>·</span>Builder
      </div>
      <button
        className="btn proj-title"
        data-tour="projects"
        disabled={mode === "run"}
        onClick={() => setProjects("projects")}
        title={tr("Проекты, шаблоны и версии")}
      >
        <span>{title}</span> <Icon name="more" size={14} />
      </button>
      {projects && (
        <Suspense fallback={null}>
          <ProjectsDialog initialTab={projects} onClose={() => setProjects(null)} />
        </Suspense>
      )}
      <span className="sep" />
      <button className="btn" disabled={!canUndo || mode === "run"} onClick={() => st().undo()} title={tr("Отменить (Ctrl+Z)")} aria-label={tr("Отменить")}>
        <Icon name="undo" />
      </button>
      <button className="btn" disabled={!canRedo || mode === "run"} onClick={() => st().redo()} title={tr("Вернуть (Ctrl+Shift+Z)")} aria-label={tr("Вернуть")}>
        <Icon name="redo" />
      </button>
      <button className="btn hide-mobile" disabled={mode === "run"} onClick={runTidy} title={tr("Упорядочить экран (Shift+T). Повторное нажатие отменяет")}>
        <Icon name="tidy" /> {tr("Упорядочить")}
      </button>
      <button className="btn" data-tour="data" disabled={mode === "run"} onClick={() => setDataOpen(true)} title={tr("Таблицы данных и команды бота")}>
        <Icon name="db" /> <span className="hide-mobile">{tr("Данные")}</span>
      </button>
      {dataOpen && <Suspense fallback={null}><DataDialog onClose={() => setDataOpen(false)} /></Suspense>}
      <button className="btn" data-tour="ai" disabled={mode === "run"} onClick={() => setAiOpen(true)} title={tr("ИИ: экран по описанию, схема данных, тексты")}>
        <Icon name="ai" /> <span className="hide-mobile">{tr("ИИ")}</span>
      </button>
      {aiOpen && <Suspense fallback={null}><AiDialog onClose={() => setAiOpen(false)} /></Suspense>}
      {extra}
      <span className="spacer" />
      <button
        className={`btn ${mode === "run" ? "on" : "primary"}`}
        onClick={() => st().setMode(mode === "run" ? "edit" : "run")}
        data-tour="run"
        title={tr("Запустить сценарий (P)")}
      >
        <Icon name={mode === "run" ? "stop" : "play"} /> <span className="hide-mobile">{mode === "run" ? tr("Стоп") : tr("Запустить")}</span>
      </button>
      <button className="btn ghost-line" data-tour="export" onClick={() => setExporting(true)} title={tr("Экспорт: папка для VS Code, ZIP, ссылка")}>
        <Icon name="download" /> <span className="hide-mobile">{tr("Экспорт")}</span>
      </button>
      {exporting && <Suspense fallback={null}><ExportDialog onClose={() => setExporting(false)} /></Suspense>}
      <button className="btn" data-tour="help" onClick={startTour} title={tr("Пройти обучение")} aria-label={tr("Пройти обучение")}>
        <Icon name="help" />
      </button>
      <button
        className="btn"
        onClick={() => st().setEditorTheme(editorTheme === "light" ? "dark" : "light")}
        title={tr("Тема редактора")}
        aria-label={tr("Тема редактора")}
      >
        <Icon name={editorTheme === "light" ? "moon" : "sun"} />
      </button>
      <button className="btn" onClick={() => setMenu(menu === "file" ? null : "file")} aria-haspopup="menu" aria-label={tr("Меню")}>
        <Icon name="more" />
      </button>
      {menu === "file" && (
        <Menu onClose={close}>
          <button
            className="menu-item"
            onClick={() => {
              close();
              setProjects("new");
            }}
          >
            <Icon name="file" /> {tr("Новый проект")}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              setProjects("versions");
            }}
          >
            <Icon name="layers" /> {tr("Версии проекта")}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              pickJson();
            }}
          >
            <Icon name="upload" /> {tr("Открыть JSON…")}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              saveJson();
            }}
          >
            <Icon name="download" /> {tr("Сохранить JSON")}
          </button>
          <div className="menu-item" style={{ cursor: "default" }}>
            {tr("Язык")}
            <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
              {LANGS.map((l) => (
                <button key={l.id} className={`btn sm${useEditor.getState().lang === l.id ? " on" : ""}`} onClick={() => st().setLanguage(l.id)}>
                  {l.id.toUpperCase()}
                </button>
              ))}
            </span>
          </div>
          <button
            className="menu-item"
            onClick={() => {
              close();
              startTour();
            }}
          >
            <Icon name="help" /> {tr("Пройти обучение")}
          </button>
          <button className="menu-item" onClick={() => setMenu("keys")}>
            <Icon name="settings" /> {tr("Горячие клавиши")}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              resetHistory();
              st().showToast(tr("История очищена"));
            }}
          >
            <Icon name="trash" /> {tr("Очистить историю")}
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
                    <td style={{ padding: "4px 12px 4px 0", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{tr(k)}</td>
                    <td style={{ padding: "4px 0", color: "var(--muted)" }}>{tr(d)}</td>
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
