// Проекты (список, шаблоны) и именованные версии текущего проекта.
import { useCallback, useEffect, useState } from "react";
import { tr } from "../../lib/i18n";
import type { TemplateId } from "../../lib/templates";
import { makeTemplate, templateSample, TEMPLATES } from "../../lib/templates";
import { useEditor } from "../../store/editor";
import { flushSave, openAsNewProject, switchProject } from "../../store/persist";
import type { ProjectMeta, Version } from "../../store/projects";
import { sandboxKey, deleteProject, deleteVersion, listProjects, listVersions, loadProject, saveVersion, versionProject } from "../../store/projects";
import { fitAll } from "../canvas/Canvas";
import { Icon } from "../Icon";

export type ProjectsTab = "projects" | "new" | "versions";

const fmt = (t: number) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const refit = () => requestAnimationFrame(() => fitAll(document.querySelector(".canvas")));

export function ProjectsDialog({ onClose, initialTab = "projects" }: { onClose: () => void; initialTab?: ProjectsTab }) {
  const [tab, setTab] = useState<ProjectsTab>(initialTab);
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [name, setName] = useState("");
  const projectId = useEditor((s) => s.projectId);
  const showToast = useEditor((s) => s.showToast);

  const reload = useCallback(async () => {
    await flushSave();
    setList(await listProjects());
    if (projectId) setVersions(await listVersions(projectId));
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = async (id: string) => {
    if (id !== projectId) await switchProject(id);
    refit();
    onClose();
  };

  const create = async (t: TemplateId) => {
    const id = await openAsNewProject(makeTemplate(t));
    const sample = templateSample(t);
    if (Object.keys(sample).length) {
      try {
        localStorage.setItem(sandboxKey(id), JSON.stringify(sample));
      } catch {
        /* без localStorage пример просто будет пустым */
      }
    }
    refit();
    onClose();
  };

  const duplicate = async (m: ProjectMeta) => {
    const r = await loadProject(m.id);
    if (!r) return;
    await openAsNewProject({ ...r.project, title: `${r.project.title} ${tr("(копия)")}` });
    refit();
    onClose();
  };

  const remove = async (m: ProjectMeta) => {
    if (!confirm(tr("Удалить проект «{t}» вместе с версиями? Это нельзя отменить.", { t: m.title }))) return;
    await deleteProject(m.id);
    if (m.id === projectId) {
      const rest = await listProjects();
      if (rest[0]) await switchProject(rest[0].id);
      else await openAsNewProject(makeTemplate("blank"));
      refit();
    }
    await reload();
  };

  const snapshot = async () => {
    const st = useEditor.getState();
    await saveVersion(st.projectId, name, st.project);
    setName("");
    showToast(tr("Версия сохранена"));
    await reload();
  };

  const restore = (v: Version) => {
    const p = versionProject(v);
    if (!p) return showToast(tr("Версия повреждена"));
    // Возврат к версии — один шаг отмены.
    useEditor.getState().replaceProject(p);
    showToast(tr("Восстановлена версия «{n}». Ctrl+Z вернёт как было.", { n: v.name }));
    refit();
    onClose();
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="projects-title">
        <div className="modal-head">
          <h2 id="projects-title">{tr("Проекты")}</h2>
          <button className="btn sm" onClick={onClose} aria-label={tr("Закрыть")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="seg" style={{ maxWidth: 420, marginBottom: 12 }}>
          <button className={tab === "projects" ? "on" : ""} onClick={() => setTab("projects")}>
            {tr("Мои проекты")}
          </button>
          <button className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>
            {tr("Новый")}
          </button>
          <button className={tab === "versions" ? "on" : ""} onClick={() => setTab("versions")}>
            {tr("Версии")}
          </button>
        </div>

        {tab === "projects" && (
          <ul className="proj-list">
            {list.map((m) => (
              <li key={m.id} className={m.id === projectId ? "current" : ""}>
                <button className="proj-open" onClick={() => void open(m.id)}>
                  <b>{m.title}</b>
                  <span className="hint">
                    {fmt(m.updatedAt)} · {tr("экранов: {n}", { n: m.screens })} · {tr("элементов: {n}", { n: m.elements })}
                  </span>
                </button>
                {m.id === projectId && <span className="tag">{tr("открыт")}</span>}
                <button className="btn sm" title={tr("Дублировать")} aria-label={tr("Дублировать")} onClick={() => void duplicate(m)}>
                  <Icon name="copy" size={15} />
                </button>
                <button className="btn sm danger" title={tr("Удалить")} aria-label={tr("Удалить")} onClick={() => void remove(m)}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="empty">{tr("Проектов пока нет")}</li>}
          </ul>
        )}

        {tab === "new" && (
          <div className="tpl-grid">
            {TEMPLATES.map((t) => (
              <button key={t.id} className="tpl" onClick={() => void create(t.id)}>
                <b>{tr(t.title)}</b>
                <span className="hint">{tr(t.description)}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "versions" && (
          <>
            <div className="row">
              <input
                className="input"
                value={name}
                placeholder={tr("Название версии, например «до редизайна»")}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void snapshot()}
              />
              <button className="btn primary" onClick={() => void snapshot()}>
                {tr("Сохранить версию")}
              </button>
            </div>
            <ul className="proj-list">
              {versions.map((v) => (
                <li key={v.id}>
                  <div className="proj-open" style={{ cursor: "default" }}>
                    <b>{v.name}</b>
                    <span className="hint">
                      {fmt(v.at)} · {tr("экранов: {n}", { n: v.project.screens.length })}
                    </span>
                  </div>
                  <button className="btn sm ghost-line" onClick={() => restore(v)}>
                    {tr("Восстановить")}
                  </button>
                  <button
                    className="btn sm danger"
                    aria-label={tr("Удалить")}
                    onClick={async () => {
                      await deleteVersion(projectId, v.id);
                      await reload();
                    }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              ))}
              {versions.length === 0 && <li className="empty">{tr("Версий пока нет. Сохраните текущее состояние, чтобы вернуться к нему позже.")}</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
