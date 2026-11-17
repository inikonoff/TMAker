// Загрузка, автосохранение и переключение проектов. Настройки редактора — отдельной записью.
import { emptyProject } from "../lib/defaults";
import type { Project } from "../lib/model";
import { idbGet, idbSet, STORE_PROJECTS } from "./idb";
import { resetHistory, useEditor } from "./editor";
import { createProject, listProjects, loadProject, migrateLegacy, saveProject } from "./projects";

const PREFS_KEY = "prefs";
const DEBOUNCE_MS = 500;

type Prefs = { editorTheme: "light" | "dark"; snapOff: boolean; lang?: "ru" | "en"; currentId?: string; onboarded?: boolean };

let prefs: Prefs = { editorTheme: "light", snapOff: false };

function savePrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  idbSet(STORE_PROJECTS, PREFS_KEY, prefs).catch(() => {});
}

export function getPrefs(): Prefs {
  return prefs;
}

export function setOnboarded(v: boolean) {
  savePrefs({ onboarded: v });
}

function applyProject(id: string, project: Project) {
  const st = useEditor.getState();
  st.replaceProject(project, { record: false });
  resetHistory();
  useEditor.setState({ projectId: id, selection: [], activeScreen: project.screens[0]?.id ?? "" });
  savePrefs({ currentId: id });
}

export async function loadInitial(): Promise<void> {
  try {
    prefs = { ...prefs, ...((await idbGet<Prefs>(STORE_PROJECTS, PREFS_KEY)) ?? {}) };
    useEditor.setState({ editorTheme: prefs.editorTheme ?? "light", snapOff: !!prefs.snapOff });
    if (prefs.lang) useEditor.getState().setLanguage(prefs.lang);
    const migrated = await migrateLegacy();
    const list = await listProjects();
    const id = (prefs.currentId && list.some((m) => m.id === prefs.currentId) ? prefs.currentId : null) ?? migrated ?? list[0]?.id;
    const loaded = id ? await loadProject(id) : null;
    if (id && loaded) applyProject(id, loaded.project);
    else {
      const p = emptyProject();
      applyProject(await createProject(p), p);
    }
  } catch (e) {
    // IndexedDB недоступна (приватный режим): работаем в памяти.
    console.warn("Не удалось загрузить проект", e);
  } finally {
    useEditor.setState({ loaded: true });
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;

/** Немедленно сохранить текущий проект (перед переключением или уходом со страницы). */
export async function flushSave(): Promise<void> {
  clearTimeout(timer);
  if (!pending) return;
  pending = false;
  const { projectId, project } = useEditor.getState();
  if (projectId) await saveProject(projectId, project).catch((e) => console.warn("Сохранение не удалось", e));
}

export async function switchProject(id: string): Promise<boolean> {
  await flushSave();
  const r = await loadProject(id);
  if (!r) return false;
  applyProject(id, r.project);
  return true;
}

/** Новый проект (пустой, из шаблона или из файла) — сразу становится текущим. */
export async function openAsNewProject(p: Project): Promise<string> {
  await flushSave();
  const id = await createProject(p);
  applyProject(id, p);
  return id;
}

export function startAutosave(): () => void {
  const unsub = useEditor.subscribe((s, prev) => {
    if (!s.loaded) return;
    if (s.project !== prev.project && s.projectId === prev.projectId) {
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flushSave(), DEBOUNCE_MS);
    }
    if (s.editorTheme !== prev.editorTheme || s.snapOff !== prev.snapOff || s.lang !== prev.lang) {
      savePrefs({ editorTheme: s.editorTheme, snapOff: s.snapOff, lang: s.lang });
    }
  });
  const flush = () => void flushSave();
  window.addEventListener("pagehide", flush);
  return () => {
    unsub();
    window.removeEventListener("pagehide", flush);
  };
}
