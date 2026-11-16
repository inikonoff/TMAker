// Окно экспорта: два клика от проекта до папки, которую открывает VS Code.
import { useState } from "react";
import type { Dialect } from "../../lib/export/sql";
import { useEditor } from "../../store/editor";
import { download } from "../files";
import { Icon } from "../Icon";
import { copyShareLink } from "../shareLink";
import { canWriteFolder, folderName, prepareExport, writeToFolder, zipFiles } from "./runExport";

const PATH_KEY = "tma-builder:export-path";
const OPTS_KEY = "tma-builder:export-opts";

type Opts = { scaffold: boolean; dialect: Dialect; screenshots: boolean };

function loadOpts(): Opts {
  try {
    return { scaffold: true, dialect: "sqlite", screenshots: true, ...JSON.parse(localStorage.getItem(OPTS_KEY) ?? "{}") };
  } catch {
    return { scaffold: true, dialect: "sqlite", screenshots: true };
  }
}

function vscodeUrl(base: string, folder: string) {
  const path = `${base.replace(/[\\/]+$/, "")}/${folder}`.replace(/\\/g, "/");
  return `vscode://file/${path.startsWith("/") ? path.slice(1) : path}`;
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const [opts, setOpts] = useState<Opts>(loadOpts);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState<{ where: string; folder: string } | null>(null);
  const [basePath, setBasePath] = useState(() => {
    try {
      return localStorage.getItem(PATH_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const folder = folderName(project);

  const set = (patch: Partial<Opts>) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(next));
    } catch {
      /* не критично */
    }
  };

  const run = async (target: "folder" | "zip") => {
    try {
      setDone(null);
      const files = await prepareExport(project, opts, setStatus);
      if (target === "folder") {
        setStatus("Выберите папку…");
        const where = await writeToFolder(files, folder);
        setDone({ where, folder });
      } else {
        download(`${folder}.zip`, zipFiles(files, folder), "application/zip");
        setDone({ where: "zip", folder });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") useEditor.getState().showToast(`Экспорт не удался: ${(e as Error).message}`);
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-head">
          <h2 id="export-title">Экспорт для VS Code и модели</h2>
          <button className="btn sm" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Папка <b>{folder}/</b>: project.json, PROMPT.md, AGENTS.md, CLAUDE.md, скриншоты экранов и картинки.
        </p>
        <label className="check">
          <input type="checkbox" checked={opts.screenshots} onChange={(e) => set({ screenshots: e.target.checked })} /> Скриншоты экранов (PNG)
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.scaffold} onChange={(e) => set({ scaffold: e.target.checked })} /> Заготовка приложения: фронтенд, бот, API, база, Dockerfile
        </label>
        {opts.scaffold && (
          <div className="row" style={{ paddingLeft: 24 }}>
            <label>База</label>
            <div className="seg" style={{ maxWidth: 240 }}>
              {(["sqlite", "postgres"] as const).map((d) => (
                <button key={d} className={opts.dialect === d ? "on" : ""} onClick={() => set({ dialect: d })}>
                  {d === "sqlite" ? "SQLite" : "Postgres"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <label title="Нужен только для ссылки «Открыть в VS Code»">Путь к папке</label>
          <input
            className="input"
            placeholder="/home/me/projects (необязательно)"
            value={basePath}
            onChange={(e) => {
              setBasePath(e.target.value);
              try {
                localStorage.setItem(PATH_KEY, e.target.value);
              } catch {
                /* не критично */
              }
            }}
          />
        </div>
        <div className="modal-actions">
          {canWriteFolder() && (
            <button className="btn primary" disabled={!!status} onClick={() => run("folder")}>
              <Icon name="file" /> Записать в папку…
            </button>
          )}
          <button className={`btn ${canWriteFolder() ? "ghost-line" : "primary"}`} disabled={!!status} onClick={() => run("zip")}>
            <Icon name="download" /> Скачать ZIP
          </button>
          <button className="btn ghost-line" disabled={!!status} onClick={() => void copyShareLink()} title="Проект в ссылке #docz= (без локальных картинок)">
            <Icon name="link" /> Ссылка
          </button>
        </div>
        {status && <p className="hint">{status}</p>}
        {done && (
          <div className="done">
            {done.where === "zip" ? (
              <>Архив скачан. Распакуйте его и откройте папку в VS Code.</>
            ) : (
              <>
                Записано в <b>{done.where}/{done.folder}</b>.{" "}
                {basePath ? (
                  <a href={vscodeUrl(basePath, done.folder)}>Открыть в VS Code</a>
                ) : (
                  <span className="hint">Укажите путь к папке выше — появится ссылка «Открыть в VS Code».</span>
                )}
              </>
            )}
            <div className="hint" style={{ marginTop: 6 }}>
              Дальше: <code>claude</code> в этой папке — агент прочитает AGENTS.md.
            </div>
          </div>
        )}
        {!canWriteFolder() && <p className="hint">Запись в папку доступна в Chrome и Edge; здесь — ZIP.</p>}
      </div>
    </div>
  );
}
