import { describe, expect, it } from "vitest";
import { buildPrompt } from "./export/prompt";
import { flowEdges } from "./flow";
import { TEMPLATES, makeTemplate } from "./templates";
import { parseProject } from "./validate";

describe("templates", () => {
  for (const t of TEMPLATES) {
    it(`«${t.title}» — валидный проект без замечаний`, () => {
      const p = makeTemplate(t.id);
      const r = parseProject(JSON.parse(JSON.stringify(p)));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
      // элементы не вылезают за экран по ширине
      for (const e of p.elements) expect(e.x + e.w).toBeLessThanOrEqual(820);
    });
  }

  it("«Список задач»: список → деталь", () => {
    const p = makeTemplate("tasks");
    const list = p.elements.find((e) => e.kind === "list")!;
    expect(list.bind).toMatchObject({ table: "tasks", mode: "list" });
    expect(list.action && "to" in list.action).toBe(true);
    const detail = p.elements.filter((e) => e.bind?.mode === "record");
    expect(detail.length).toBeGreaterThanOrEqual(2);
    expect(flowEdges(p).length).toBe(2);
    expect(buildPrompt(p)).toContain("нажатие на строку передаёт выбранную запись `tasks`");
  });
});
