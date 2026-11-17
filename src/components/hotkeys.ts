// Горячие клавиши редактора. Список дублируется в README и в окне «Клавиши».
import { useEffect } from "react";
import { uid } from "../lib/ids";
import type { Element } from "../lib/model";
import { deleteElements, duplicateElements, elementsOf, movedElement, reorderZ, updateElements } from "../lib/ops";
import { useEditor } from "../store/editor";
import { fitAll } from "./canvas/Canvas";
import { isTyping } from "./canvas/keys";
import { runTidy } from "./tidyAction";

export const HOTKEYS: [string, string][] = [
  ["Ctrl+Z / Ctrl+Shift+Z", "Отменить / вернуть"],
  ["Ctrl+Y", "Вернуть"],
  ["Delete / Backspace", "Удалить выделенное"],
  ["Ctrl+D", "Дублировать"],
  ["Ctrl+C / Ctrl+V", "Копировать / вставить элементы"],
  ["Ctrl+A", "Выделить всё на экране"],
  ["Ctrl+G / Ctrl+Shift+G", "Сгруппировать / разгруппировать"],
  ["] / [", "Выше / ниже по слоям (с Ctrl — на передний / задний план)"],
  ["Стрелки (Shift — по 10)", "Сдвинуть на 1 px"],
  ["Esc", "Снять выделение / выйти из запуска"],
  ["Правая кнопка мыши + перетаскивание", "Двигать холст"],
  ["Пробел + перетаскивание", "Двигать холст"],
  ["Колесо мыши", "Масштаб к курсору"],
  ["Shift + колесо", "Двигать холст (трекпад)"],
  ["Ctrl при перетаскивании", "Без привязки"],
  ["Shift при изменении размера", "Сохранять пропорции"],
  ["Shift+1", "Показать все экраны"],
  ["Ctrl+0", "Масштаб 100%"],
  ["Shift+T", "Упорядочить экран"],
  ["P", "Запустить / остановить"],
];

let clipboard: Element[] = [];

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const ids = new Set(st.selection);

      if (st.mode === "run") {
        if (k === "escape" || (k === "p" && !mod)) st.setMode("edit");
        return;
      }

      if (mod && k === "z") {
        e.preventDefault();
        return e.shiftKey ? st.redo() : st.undo();
      }
      if (mod && k === "y") {
        e.preventDefault();
        return st.redo();
      }
      if (mod && k === "a") {
        e.preventDefault();
        return st.select(elementsOf(st.project, st.activeScreen).filter((x) => !x.locked).map((x) => x.id));
      }
      if (mod && k === "0") {
        e.preventDefault();
        const c = document.querySelector<HTMLElement>(".canvas");
        if (!c) return;
        const v = st.viewport;
        const cx = c.clientWidth / 2;
        const cy = c.clientHeight / 2;
        return st.setViewport({ x: cx - ((cx - v.x) / v.z) * 1, y: cy - ((cy - v.y) / v.z) * 1, z: 1 });
      }
      if (e.shiftKey && e.code === "Digit1") return fitAll(document.querySelector<HTMLElement>(".canvas"));
      if (e.shiftKey && k === "t" && !mod) return runTidy();
      if (k === "p" && !mod) return st.setMode("run");

      if (ids.size === 0) return;

      if (k === "escape") return st.select([]);
      if (k === "delete" || k === "backspace") {
        e.preventDefault();
        return st.commit((p) => deleteElements(p, ids));
      }
      if (mod && k === "d") {
        e.preventDefault();
        let next: string[] = [];
        st.commit((p) => {
          const r = duplicateElements(p, st.selection);
          next = r.ids;
          return r.project;
        });
        return st.select(next);
      }
      if (mod && k === "c") {
        clipboard = st.project.elements.filter((x) => ids.has(x.id)).map((x) => structuredClone(x));
        return;
      }
      if (mod && k === "g") {
        e.preventDefault();
        const g = e.shiftKey ? undefined : uid("g");
        return st.commit((p) => updateElements(p, new Map([...ids].map((id) => [id, { group: g }]))));
      }
      if (k === "]" || k === "[") {
        const where = k === "]" ? (mod ? "front" : "forward") : mod ? "back" : "backward";
        return st.commit((p) => reorderZ(p, ids, where));
      }
      const arrows: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      const d = arrows[k];
      if (d) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        return st.commit((p) => {
          const patches = new Map<string, Partial<Element>>();
          for (const el of p.elements) if (ids.has(el.id) && !el.locked) patches.set(el.id, movedElement(el, el.x + d[0] * step, el.y + d[1] * step));
          return updateElements(p, patches);
        }, "nudge");
      }
    };

    // Вставка: элементы из буфера редактора или картинка из системного буфера.
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const st = useEditor.getState();
      if (st.mode !== "edit") return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void import("./pasteImage").then((m) => m.pasteImage(file));
        return;
      }
      if (clipboard.length === 0) return;
      e.preventDefault();
      const screenId = st.activeScreen;
      const sameScreen = clipboard.every((c) => c.screenId === screenId);
      const src = clipboard.map((c) => ({ ...structuredClone(c), screenId }));
      let next: string[] = [];
      st.commit((p) => {
        const withSrc = { ...p, elements: [...p.elements, ...src.map((s) => ({ ...s, id: `tmp_${s.id}` }))] };
        const r = duplicateElements(withSrc, src.map((s) => `tmp_${s.id}`), sameScreen ? 16 : 0);
        next = r.ids;
        return { ...r.project, elements: r.project.elements.filter((x) => !x.id.startsWith("tmp_")) };
      });
      st.select(next);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, []);
}
