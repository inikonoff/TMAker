// Картинки хранятся отдельными записями IndexedDB; в проекте только ссылка "idb:<id>".
import { useEffect, useState } from "react";
import { uid } from "../lib/ids";
import { idbGet, idbSet, STORE_IMAGES } from "./idb";

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function putImage(blob: Blob): Promise<string> {
  if (blob.size > MAX_IMAGE_BYTES) throw new Error("Картинка больше 8 МБ");
  const id = uid("img");
  await idbSet(STORE_IMAGES, id, blob);
  urls.set(id, URL.createObjectURL(blob));
  return `idb:${id}`;
}

export async function getImageBlob(ref: string): Promise<Blob | null> {
  if (!ref.startsWith("idb:")) return null;
  return (await idbGet<Blob>(STORE_IMAGES, ref.slice(4))) ?? null;
}

function resolve(ref: string): Promise<string | null> {
  const id = ref.slice(4);
  const cached = urls.get(id);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(id);
  if (!p) {
    p = idbGet<Blob>(STORE_IMAGES, id)
      .then((blob) => {
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urls.set(id, url);
        return url;
      })
      .catch(() => null)
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

/** URL картинки для <img>: idb-ссылки превращаются в object URL. */
export function useImageSrc(ref: string | undefined): string | null {
  const sync = !ref ? null : ref.startsWith("idb:") ? (urls.get(ref.slice(4)) ?? null) : ref;
  const [src, setSrc] = useState<string | null>(sync);
  useEffect(() => {
    if (!ref) return setSrc(null);
    if (!ref.startsWith("idb:")) return setSrc(ref);
    let alive = true;
    resolve(ref).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [ref]);
  return sync ?? src;
}
