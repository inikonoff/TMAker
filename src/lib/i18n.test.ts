import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setLang, tr } from "./i18n";
import { en } from "./i18n.en";
import { dynamicKeys } from "./i18n.keys";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.includes(".test.") ? [p] : [];
  });
}

describe("i18n", () => {
  it("у каждого tr(\"…\") в коде есть английский перевод", () => {
    const missing: string[] = [];
    for (const f of files(join(import.meta.dirname, ".."))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\btr\("((?:[^"\\]|\\.)*)"/g)) {
        const key = m[1]!.replace(/\\"/g, '"');
        if (/[А-Яа-яЁё]/.test(key) && !(key in en)) missing.push(`${f.split("src/")[1]}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("подписи из констант переведены", () => {
    expect(dynamicKeys().filter((k) => /[А-Яа-яЁё]/.test(k) && !(k in en))).toEqual([]);
  });

  it("подстановки и переключение языка", () => {
    setLang("en");
    expect(tr("Выбрано: {n}", { n: 3 })).toBe("Selected: 3");
    expect(tr("Неизвестная строка")).toBe("Неизвестная строка");
    setLang("ru");
    expect(tr("Выбрано: {n}", { n: 3 })).toBe("Выбрано: 3");
  });

  it("в английском словаре нет кириллицы", () => {
    expect(Object.entries(en).filter(([, v]) => /[А-Яа-яЁё]/.test(v))).toEqual([]);
  });
});

describe("i18n: ошибки ИИ", () => {
  it("все сообщения AiError из lib/ai.ts переведены", async () => {
    const src = readFileSync(join(import.meta.dirname, "ai.ts"), "utf8");
    const msgs = [...src.matchAll(/(?:new AiError|new Error)\("([^"]+)"/g)].map((m) => m[1]!);
    expect(msgs.length).toBeGreaterThan(5);
    expect(msgs.filter((m) => !(m in en))).toEqual([]);
  });
});
