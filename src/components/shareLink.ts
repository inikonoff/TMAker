// Ссылка на проект: JSON, сжатый deflate-raw, в хэше #docz=. Сервер не нужен.
import { decodeDocz, encodeDocz } from "../lib/docz";
import { useEditor } from "../store/editor";
import { openJsonText } from "./files";
import { tr } from "../lib/i18n";

export async function openFromHash() {
  const m = location.hash.match(/^#docz=(.+)$/);
  if (!m) return;
  try {
    const json = await decodeDocz(m[1]!);
    if (openJsonText(json)) history.replaceState(null, "", location.pathname + location.search);
  } catch {
    useEditor.getState().showToast(tr("Ссылка повреждена"));
  }
}

/** Копирует ссылку. Картинки из IndexedDB в ссылку не попадают (остаются только внешние URL). */
export async function copyShareLink() {
  const st = useEditor.getState();
  const p = structuredClone(st.project);
  let dropped = 0;
  for (const e of p.elements) {
    if (e.content?.image?.startsWith("idb:")) {
      delete e.content.image;
      dropped++;
    }
  }
  const z = await encodeDocz(JSON.stringify(p));
  const url = `${location.origin}${location.pathname}#docz=${z}`;
  try {
    await navigator.clipboard.writeText(url);
    st.showToast(dropped ? tr("Ссылка скопирована (без {n} локальных картинок)", { n: dropped }) : tr("Ссылка скопирована"));
  } catch {
    prompt(tr("Скопируйте ссылку:"), url);
  }
  return url;
}
