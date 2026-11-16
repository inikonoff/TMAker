// «Упорядочить» экран. Повторное нажатие сразу после — отменяет.
import { tidy } from "../lib/arrange";
import { screenSize } from "../lib/devices";
import type { Element, Project } from "../lib/model";
import { elementsOf, updateElements } from "../lib/ops";
import { useEditor } from "../store/editor";

let lastTidied: Project | null = null;

export function runTidy() {
  const st = useEditor.getState();
  if (lastTidied && st.project === lastTidied) {
    lastTidied = null;
    st.undo();
    st.showToast("Порядок отменён");
    return;
  }
  const screen = st.project.screens.find((s) => s.id === st.activeScreen);
  if (!screen) return;
  const rects = tidy(elementsOf(st.project, screen.id), screenSize(st.project, screen));
  const patches = new Map<string, Partial<Element>>();
  for (const [id, r] of rects) patches.set(id, r);
  st.commit((p) => updateElements(p, patches));
  lastTidied = useEditor.getState().project;
  st.showToast("Экран упорядочен. Нажмите ещё раз, чтобы отменить");
}
