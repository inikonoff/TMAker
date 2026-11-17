// Хранилище редактора. Документ меняется только через commit/transient, история — снимками.
import { create } from "zustand";
import type { Viewport } from "../lib/geometry";
import type { History } from "../lib/history";
import { breakMerge, createHistory, record, redo as redoH, undo as undoH } from "../lib/history";
import { emptyProject } from "../lib/defaults";
import type { Lang } from "../lib/i18n";
import { setLang } from "../lib/i18n";
import type { Project } from "../lib/model";
import { expandGroups } from "../lib/ops";

export type EditorTheme = "light" | "dark";
export type Mode = "edit" | "run";

export type EditorState = {
  project: Project;
  /** id текущего проекта в IndexedDB. */
  projectId: string;
  selection: string[];
  activeScreen: string;
  viewport: Viewport;
  editorTheme: EditorTheme;
  lang: Lang;
  /** Переключатель привязки (на телефоне вместо Ctrl). */
  snapOff: boolean;
  mode: Mode;
  canUndo: boolean;
  canRedo: boolean;
  /** Растёт при undo/redo/замене документа: элементы встают без анимации. */
  instantTick: number;
  /** Черновик ИИ ждёт решения «оставить / отменить». */
  pendingDraft: boolean;
  draftNote: string | null;
  toast: string | null;
  loaded: boolean;
};

type Actions = {
  /** Правка документа с записью в историю. key — для слияния повторных правок поля. */
  commit: (fn: (p: Project) => Project, key?: string) => void;
  /** Начало непрерывной правки (resize): один снимок в историю. */
  beginTransient: () => void;
  /** Правка без записи в историю (во время жеста после beginTransient). */
  transient: (fn: (p: Project) => Project) => void;
  /** Замена всего документа — один шаг отмены. */
  replaceProject: (p: Project, opts?: { draft?: boolean; record?: boolean }) => void;
  acceptDraft: () => void;
  rejectDraft: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[], mode?: "set" | "add" | "toggle") => void;
  setActiveScreen: (id: string) => void;
  setViewport: (v: Viewport) => void;
  setEditorTheme: (t: EditorTheme) => void;
  setLanguage: (l: Lang) => void;
  setSnapOff: (v: boolean) => void;
  setMode: (m: Mode) => void;
  showToast: (msg: string) => void;
};

let history: History<Project> = createHistory<Project>();
let draftBase: Project | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function cleanSelection(p: Project, ids: string[]): string[] {
  const present = new Set(p.elements.map((e) => e.id));
  return ids.filter((id) => present.has(id));
}

function fixActive(p: Project, active: string): string {
  return p.screens.some((s) => s.id === active) ? active : (p.screens[0]?.id ?? "");
}

const initial = emptyProject();

export const useEditor = create<EditorState & Actions>()((set, get) => ({
  project: initial,
  projectId: "",
  selection: [],
  activeScreen: initial.screens[0]!.id,
  viewport: { x: 80, y: 80, z: 0.75 },
  editorTheme: "light",
  lang: "ru",
  snapOff: false,
  mode: "edit",
  canUndo: false,
  canRedo: false,
  instantTick: 0,
  pendingDraft: false,
  draftNote: null,
  toast: null,
  loaded: false,

  commit: (fn, key) => {
    const before = get().project;
    const next = fn(before);
    if (next === before) return;
    history = record(history, before, key ?? null);
    set((s) => ({
      project: next,
      selection: cleanSelection(next, s.selection),
      activeScreen: fixActive(next, s.activeScreen),
      canUndo: true,
      canRedo: false,
    }));
  },

  beginTransient: () => {
    history = record(history, get().project, null);
    set({ canUndo: true, canRedo: false });
  },

  transient: (fn) => {
    const next = fn(get().project);
    if (next !== get().project) set({ project: next });
  },

  replaceProject: (p, opts) => {
    const before = get().project;
    if (opts?.record !== false) history = breakMerge(record(history, before, null));
    if (opts?.draft) draftBase = before;
    set((s) => ({
      project: p,
      selection: [],
      activeScreen: fixActive(p, s.activeScreen),
      canUndo: history.past.length > 0,
      canRedo: false,
      instantTick: s.instantTick + 1,
      pendingDraft: !!opts?.draft,
    }));
  },

  acceptDraft: () => {
    draftBase = null;
    set({ pendingDraft: false, draftNote: null });
  },

  rejectDraft: () => {
    if (!draftBase) return set({ pendingDraft: false });
    const base = draftBase;
    draftBase = null;
    // Отмена черновика = шаг отмены, а не новый шаг.
    const r = undoH(history, get().project);
    // Отклонённый черновик не возвращается через «Вернуть».
    if (r && r.state === base) history = { ...r.history, future: [] };
    set((s) => ({
      project: base,
      selection: [],
      activeScreen: fixActive(base, s.activeScreen),
      pendingDraft: false,
      draftNote: null,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      instantTick: s.instantTick + 1,
    }));
  },

  undo: () => {
    const r = undoH(history, get().project);
    if (!r) return;
    history = r.history;
    draftBase = null;
    set((s) => ({
      project: r.state,
      selection: cleanSelection(r.state, s.selection),
      activeScreen: fixActive(r.state, s.activeScreen),
      canUndo: history.past.length > 0,
      canRedo: true,
      instantTick: s.instantTick + 1,
      pendingDraft: false,
    }));
  },

  redo: () => {
    const r = redoH(history, get().project);
    if (!r) return;
    history = r.history;
    set((s) => ({
      project: r.state,
      selection: cleanSelection(r.state, s.selection),
      activeScreen: fixActive(r.state, s.activeScreen),
      canUndo: true,
      canRedo: history.future.length > 0,
      instantTick: s.instantTick + 1,
    }));
  },

  select: (ids, mode = "set") => {
    const p = get().project;
    const full = expandGroups(p, ids);
    let next: string[];
    if (mode === "set") next = full;
    else if (mode === "add") next = [...new Set([...get().selection, ...full])];
    else {
      const cur = new Set(get().selection);
      const allIn = full.every((id) => cur.has(id));
      for (const id of full) allIn ? cur.delete(id) : cur.add(id);
      next = [...cur];
    }
    const first = p.elements.find((e) => e.id === next[0]);
    history = breakMerge(history);
    set({ selection: next, ...(first ? { activeScreen: first.screenId } : {}) });
  },

  setActiveScreen: (id) => set({ activeScreen: id }),
  setViewport: (v) => set({ viewport: v }),
  setEditorTheme: (t) => set({ editorTheme: t }),
  setLanguage: (l) => {
    setLang(l);
    set({ lang: l });
  },
  setSnapOff: (v) => set({ snapOff: v }),
  setMode: (m) => set({ mode: m, selection: [] }),
  showToast: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 3200);
  },
}));

/** Для тестов и открытия проекта «с чистого листа». */
export function resetHistory() {
  history = createHistory<Project>();
  draftBase = null;
  useEditor.setState({ canUndo: false, canRedo: false, pendingDraft: false });
}
