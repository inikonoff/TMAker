// Локализация. Ключ — русская строка (язык по умолчанию), словари — переводы.
// Подстановки: t("Выбрано: {n}", { n: 3 }).
import { en } from "./i18n.en";

export type Lang = "ru" | "en";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

const DICTS: Record<Lang, Record<string, string> | null> = { ru: null, en };

let current: Lang = "ru";

export function setLang(l: Lang) {
  current = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function getLang(): Lang {
  return current;
}

export function tr(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[current];
  let s = dict?.[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
