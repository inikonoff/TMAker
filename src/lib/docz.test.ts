import { describe, expect, it } from "vitest";
import { emptyProject, makeElement } from "./defaults";
import { decodeDocz, encodeDocz } from "./docz";

describe("docz", () => {
  it("кодирует и декодирует проект без потерь", async () => {
    const json = JSON.stringify({ ...emptyProject(), title: "Тест ✓ ссылки" });
    const z = await encodeDocz(json);
    expect(z).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeDocz(z)).toBe(json);
  });

  it("реально сжимает проект с элементами", async () => {
    const p = emptyProject();
    for (let i = 0; i < 40; i++) p.elements.push(makeElement("button", p.screens[0]!.id, { x: i, y: i * 10 }, i));
    const json = JSON.stringify(p);
    const z = await encodeDocz(json);
    expect(z.length).toBeLessThan(json.length / 3);
    expect(await decodeDocz(z)).toBe(json);
  });
});
