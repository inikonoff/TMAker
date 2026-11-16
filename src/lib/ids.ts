let counter = 0;

/** Короткий уникальный id: префикс + время + счётчик + случайность. */
export function uid(prefix = "e"): string {
  counter = (counter + 1) % 1_000_000;
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}
