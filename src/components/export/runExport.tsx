// Сбор экспорта: картинки из IndexedDB, скриншоты экранов, ZIP или запись в папку.
import { zipSync } from "fflate";
import { toBlob } from "html-to-image";
import { createRoot } from "react-dom/client";
import { themeTokens } from "../../lib/color";
import { screenSize } from "../../lib/devices";
import type { ExportFiles, ExportOptions } from "../../lib/export/bundle";
import { buildExportFiles } from "../../lib/export/bundle";
import { slug } from "../../lib/export/prompt";
import type { Project } from "../../lib/model";
import { elementsOf } from "../../lib/ops";
import { getImageBlob } from "../../store/images";
import { RunScreen } from "../run/RunScreen";
import { tr } from "../../lib/i18n";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

async function collectImages(p: Project): Promise<ExportOptions["images"]> {
  const refs = new Set(p.elements.map((e) => e.content?.image).filter((r): r is string => !!r?.startsWith("idb:")));
  const out: ExportOptions["images"] = new Map();
  for (const ref of refs) {
    const blob = await getImageBlob(ref);
    if (blob) out.set(ref, { data: new Uint8Array(await blob.arrayBuffer()), ext: EXT[blob.type] ?? "png" });
  }
  return out;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/** Отрисовать экраны вне видимой области и снять PNG. */
export async function captureScreens(p: Project, onProgress?: (i: number, n: number) => void): Promise<Map<string, Uint8Array>> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  const tokens = themeTokens(p.theme);
  const noop = { onAction: () => {} };
  root.render(
    <div>
      {p.screens.map((s) => {
        const { w, h } = screenSize(p, s);
        return (
          <div key={s.id} data-shot={s.id} style={{ position: "relative", width: w, height: h, fontFamily: "var(--font)" }}>
            <RunScreen screen={s} elements={elementsOf(p, s.id)} tokens={tokens} w={w} h={h} highlight={false} handlers={noop} />
          </div>
        );
      })}
    </div>,
  );
  const out = new Map<string, Uint8Array>();
  try {
    await nextFrame();
    await nextFrame();
    await Promise.all([...host.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
    const nodes = [...host.querySelectorAll<HTMLElement>("[data-shot]")];
    for (let i = 0; i < nodes.length; i++) {
      onProgress?.(i + 1, nodes.length);
      const node = nodes[i]!;
      try {
        const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
        if (blob) out.set(node.dataset.shot!, new Uint8Array(await blob.arrayBuffer()));
      } catch (e) {
        console.warn("Скриншот не снят", e);
      }
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return out;
}

export async function prepareExport(
  p: Project,
  opts: { scaffold: boolean; dialect: ExportOptions["dialect"]; screenshots: boolean },
  onStatus: (s: string) => void,
): Promise<ExportFiles> {
  onStatus(tr("Картинки…"));
  const images = await collectImages(p);
  const shots = opts.screenshots ? await captureScreens(p, (i, n) => onStatus(tr("Скриншоты {i}/{n}…", { i, n }))) : new Map();
  onStatus(tr("Файлы…"));
  return buildExportFiles(p, { scaffold: opts.scaffold, dialect: opts.dialect, images, screenshots: shots });
}

export function folderName(p: Project): string {
  return slug(p.title, "tma-project");
}

export function zipFiles(files: ExportFiles, folder: string): Blob {
  const enc = new TextEncoder();
  const tree: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(files)) tree[`${folder}/${path}`] = typeof data === "string" ? enc.encode(data) : data;
  const zipped = zipSync(tree, { level: 6 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

type DirHandle = {
  name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: BlobPart): Promise<void>; close(): Promise<void> }> }>;
};

export const canWriteFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** Записать файлы в выбранную папку (Chromium). Внутри создаётся подпапка проекта. */
export async function writeToFolder(files: ExportFiles, folder: string): Promise<string> {
  const picker = (window as unknown as { showDirectoryPicker(o: { mode: "readwrite"; id?: string }): Promise<DirHandle> }).showDirectoryPicker;
  const parent = await picker({ mode: "readwrite", id: "tma-export" });
  const root = await parent.getDirectoryHandle(folder, { create: true });
  for (const [path, data] of Object.entries(files)) {
    const parts = path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
    const fh = await dir.getFileHandle(parts[parts.length - 1]!, { create: true });
    const w = await fh.createWritable();
    await w.write(typeof data === "string" ? data : (data as BlobPart));
    await w.close();
  }
  return parent.name;
}
