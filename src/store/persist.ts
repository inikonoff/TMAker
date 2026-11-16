// Автосохранение проекта и настроек редактора в IndexedDB с дебаунсом.
import { parseProject } from "../lib/validate";
import { idbGet, idbSet, STORE_PROJECTS } from "./idb";
import { resetHistory, useEditor } from "./editor";

const KEY = "current";
const PREFS_KEY = "prefs";
const DEBOUNCE_MS = 500;

type Prefs = { editorTheme: "light" | "dark"; snapOff: boolean };

export async function loadInitial(): Promise<void> {
  try {
    const [raw, prefs] = await Promise.all([
      idbGet<unknown>(STORE_PROJECTS, KEY),
      idbGet<Prefs>(STORE_PROJECTS, PREFS_KEY),
    ]);
    if (raw) {
      const r = parseProject(raw);
      if (r.ok) {
        useEditor.getState().replaceProject(r.project, { record: false });
        resetHistory();
      }
    }
    if (prefs) useEditor.setState({ editorTheme: prefs.editorTheme ?? "light", snapOff: !!prefs.snapOff });
  } catch (e) {
    console.warn("Не удалось загрузить проект", e);
  } finally {
    useEditor.setState({ loaded: true });
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function startAutosave(): () => void {
  const unsub = useEditor.subscribe((s, prev) => {
    if (!s.loaded) return;
    if (s.project !== prev.project) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        idbSet(STORE_PROJECTS, KEY, useEditor.getState().project).catch((e) =>
          console.warn("Автосохранение не удалось", e),
        );
      }, DEBOUNCE_MS);
    }
    if (s.editorTheme !== prev.editorTheme || s.snapOff !== prev.snapOff) {
      idbSet(STORE_PROJECTS, PREFS_KEY, { editorTheme: s.editorTheme, snapOff: s.snapOff } satisfies Prefs).catch(
        () => {},
      );
    }
  });
  const flush = () => {
    clearTimeout(timer);
    idbSet(STORE_PROJECTS, KEY, useEditor.getState().project).catch(() => {});
  };
  window.addEventListener("pagehide", flush);
  return () => {
    unsub();
    window.removeEventListener("pagehide", flush);
  };
}
