// Сжатие проекта для ссылки: CompressionStream("deflate-raw") + base64url.

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = blob.stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeDocz(json: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return toBase64Url(packed);
}

export async function decodeDocz(z: string): Promise<string> {
  const raw = await pipe(fromBase64Url(z), new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(raw);
}
