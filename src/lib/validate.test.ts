import { describe, expect, it } from "vitest";
import { emptyProject, makeElement } from "./defaults";
import { parseProject } from "./validate";

describe("parseProject", () => {
  it("принимает новый проект без изменений", () => {
    const p = emptyProject();
    p.elements.push(makeElement("button", p.screens[0]!.id, { x: 10, y: 20 }, 0));
    const r = parseProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project).toEqual(p);
      expect(r.warnings).toEqual([]);
    }
  });

  it("отклоняет мусор", () => {
    expect(parseProject("not json").ok).toBe(false);
    expect(parseProject(42).ok).toBe(false);
    expect(parseProject({ version: 1, screens: [] }).ok).toBe(false);
    expect(parseProject({ version: 999, screens: [{ id: "a" }] }).ok).toBe(false);
  });

  it("мигрирует версию 0 (frames/items)", () => {
    const r = parseProject({ frames: [{ id: "s1", name: "A" }], items: [{ id: "e1", screenId: "s1", kind: "text" }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.version).toBe(1);
      expect(r.project.screens[0]!.name).toBe("A");
      expect(r.project.elements[0]!.kind).toBe("text");
    }
  });

  it("чистит битые ссылки, неизвестные виды и секреты", () => {
    const r = parseProject({
      version: 1,
      screens: [{ id: "s1", swipe: { left: "nope" } }],
      elements: [
        { id: "e1", screenId: "s1", kind: "button", action: { to: "ghost", transition: "fade" } },
        { id: "e2", screenId: "nowhere", kind: "text" },
        { id: "e3", screenId: "s1", kind: "blink" },
        { id: "e1", screenId: "s1", kind: "text" },
        { id: "e4", screenId: "s1", kind: "button", action: { open: "link", url: "javascript:alert(1)" } },
      ],
      bot: { name: "b", token: "123:abc", commands: [{ command: "/start", description: "go" }] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.elements.map((e) => e.id)).toEqual(["e1", "e4"]);
    expect(r.project.elements[0]!.action).toBeUndefined();
    expect(r.project.elements[1]!.action).toBeUndefined();
    expect(r.project.screens[0]!.swipe).toBeUndefined();
    expect(JSON.stringify(r.project)).not.toContain("123:abc");
    expect(r.project.bot!.commands[0]!.command).toBe("start");
    expect(r.warnings.length).toBeGreaterThan(3);
  });

  it("ограничивает числа и цвета", () => {
    const r = parseProject({
      version: 1,
      theme: { mode: "dark", darkLevel: 99, accent: "red" },
      device: { w: 5, h: 99999 },
      screens: [{ id: "s1", bg: "url(x)" }],
      elements: [{ id: "e", screenId: "s1", kind: "box", style: { opacity: 7, fill: "expression()", fontWeight: 600 } }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.theme.darkLevel).toBe(4);
    expect(r.project.theme.accent).toMatch(/^#/);
    expect(r.project.device).toEqual({ w: 120, h: 4000 });
    expect(r.project.screens[0]!.bg).toBe("$bg");
    expect(r.project.elements[0]!.style.opacity).toBe(1);
    expect(r.project.elements[0]!.style.fill).toBe("transparent");
    expect(r.project.elements[0]!.style.fontWeight).toBe(600);
  });
});
