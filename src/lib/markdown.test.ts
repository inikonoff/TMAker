import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, slugify } from "./markdown";

describe("markdown", () => {
  it("инлайн: жирный, код, ссылки", () => {
    expect(parseInline("а **б** `в` [г](https://x.y) д")).toEqual([
      { t: "text", v: "а " },
      { t: "b", v: "б" },
      { t: "text", v: " " },
      { t: "code", v: "в" },
      { t: "text", v: " " },
      { t: "link", v: "г", href: "https://x.y" },
      { t: "text", v: " д" },
    ]);
  });

  it("курсив", () => {
    expect(parseInline("а *б в* г")).toEqual([
      { t: "text", v: "а " },
      { t: "i", v: "б в" },
      { t: "text", v: " г" },
    ]);
  });

  it("блоки", () => {
    const md = [
      "# Заголовок 1. Шаг",
      "",
      "Абзац в",
      "две строки.",
      "",
      "- раз",
      "- два",
      "  продолжение",
      "",
      "1. первый",
      "2. второй",
      "",
      "```bash",
      "npm i",
      "```",
      "",
      "> цитата",
      "",
      "![скрин](guide/01.png)",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | **2** |",
      "",
      "---",
    ].join("\n");
    const b = parseMarkdown(md);
    expect(b.map((x) => x.t)).toEqual(["h", "p", "list", "list", "code", "quote", "img", "table", "hr"]);
    expect(b[0]).toMatchObject({ level: 1, id: "заголовок-1-шаг" });
    expect(b[1]).toEqual({ t: "p", inl: [{ t: "text", v: "Абзац в две строки." }] });
    expect((b[2] as { items: unknown[] }).items.length).toBe(2);
    expect(b[3]).toMatchObject({ ordered: true });
    expect(b[4]).toEqual({ t: "code", lang: "bash", v: "npm i" });
    expect(b[6]).toEqual({ t: "img", alt: "скрин", src: "guide/01.png" });
    expect((b[7] as { rows: unknown[] }).rows.length).toBe(1);
  });

  it("якоря как у GitHub", () => {
    expect(slugify("3. Данные: таблицы и бот")).toBe("3-данные-таблицы-и-бот");
  });
});
