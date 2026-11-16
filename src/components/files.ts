// Открытие и сохранение проекта как JSON-файла.
import { parseProject } from "../lib/validate";
import { resetHistory, useEditor } from "../store/editor";
import { tr } from "../lib/i18n";

export function download(name: string, data: Blob | string, type = "application/json") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(title: string): string {
  const s = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return s || "project";
}

export function saveJson() {
  const p = useEditor.getState().project;
  download(`${safeFileName(p.title)}.json`, JSON.stringify(p, null, 2));
}

/** Открыть JSON: проходит через валидатор; замена документа — один шаг отмены. */
export function openJsonText(text: string, opts: { fresh?: boolean } = {}) {
  const st = useEditor.getState();
  const r = parseProject(text);
  if (!r.ok) {
    st.showToast(tr("Не удалось открыть: {e}", { e: tr(r.error) }));
    return false;
  }
  st.replaceProject(r.project);
  if (opts.fresh) resetHistory();
  st.showToast(r.warnings.length ? tr("Открыто с замечаниями: {n}", { n: r.warnings.length }) : tr("Проект открыт"));
  if (r.warnings.length) console.info("Замечания валидатора:", r.warnings);
  return true;
}

export function pickJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (f) openJsonText(await f.text());
  };
  input.click();
}
