// Вставка картинки из буфера: в выделенный элемент (если он умеет картинку) или новым элементом.
import { makeElement } from "../lib/defaults";
import { screenSize } from "../lib/devices";
import { addElements, maxZ, updateElements } from "../lib/ops";
import { useEditor } from "../store/editor";
import { putImage } from "../store/images";

const IMAGE_KINDS = new Set(["image", "button", "box", "card", "badge", "mainButton"]);

function imageSize(blob: Blob): Promise<{ w: number; h: number }> {
  return createImageBitmap(blob)
    .then((b) => {
      const r = { w: b.width, h: b.height };
      b.close();
      return r;
    })
    .catch(() => ({ w: 160, h: 120 }));
}

export async function pasteImage(blob: Blob) {
  const st = useEditor.getState();
  try {
    const ref = await putImage(blob);
    const target = st.project.elements.find((e) => st.selection.length === 1 && e.id === st.selection[0] && IMAGE_KINDS.has(e.kind));
    if (target) {
      st.commit((p) => updateElements(p, new Map([[target.id, { content: { ...target.content, image: ref, imageFit: target.content?.imageFit ?? "cover" } }]])));
      return;
    }
    const screen = st.project.screens.find((s) => s.id === st.activeScreen);
    if (!screen) return;
    const size = screenSize(st.project, screen);
    const nat = await imageSize(blob);
    const k = Math.min(1, (size.w - 32) / nat.w, (size.h / 2) / nat.h);
    const el = makeElement("image", screen.id, { x: 16, y: 16 }, maxZ(st.project, screen.id) + 1, st.project.theme);
    el.w = Math.round(nat.w * k);
    el.h = Math.round(nat.h * k);
    el.x = Math.round((size.w - el.w) / 2);
    el.content = { image: ref, imageFit: "cover" };
    st.commit((p) => addElements(p, [el]));
    st.select([el.id]);
  } catch (err) {
    st.showToast(err instanceof Error ? err.message : "Не удалось вставить картинку");
  }
}
