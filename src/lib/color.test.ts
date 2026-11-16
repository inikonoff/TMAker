import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "./defaults";
import { contrast, luminance, resolveColor, themeTokens } from "./color";

describe("color", () => {
  it("darkLevel плавно светлеет", () => {
    const l = [0, 1, 2, 3, 4].map((d) => luminance(themeTokens({ ...DEFAULT_THEME, mode: "dark", darkLevel: d }).bg));
    for (let i = 1; i < l.length; i++) expect(l[i]!).toBeGreaterThan(l[i - 1]!);
  });

  it("текст читается на любом уровне", () => {
    for (let d = 0; d <= 4; d += 0.5) {
      const t = themeTokens({ ...DEFAULT_THEME, mode: "dark", darkLevel: d });
      expect(contrast(t.text, t.bg)).toBeGreaterThan(4.5);
    }
  });

  it("токены разрешаются", () => {
    const t = themeTokens(DEFAULT_THEME);
    expect(resolveColor("$accent", t)).toBe(DEFAULT_THEME.accent);
    expect(resolveColor("#123456", t)).toBe("#123456");
    expect(resolveColor(undefined, t)).toBe("transparent");
  });
});

describe("readableOn", () => {
  it("белый на насыщенном акценте, тёмный на светлом", async () => {
    const { readableOn } = await import("./color");
    expect(readableOn("#2f80ed")).toBe("#ffffff");
    expect(readableOn("#ffe066")).toBe("#111318");
  });
});
