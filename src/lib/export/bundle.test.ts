import { describe, expect, it } from "vitest";
import { emptyProject, makeElement } from "../defaults";
import { addScreen } from "../ops";
import { parseProject } from "../validate";
import { buildExportFiles } from "./bundle";

function sample() {
  let p = emptyProject();
  p.title = "Задачник";
  const s1 = p.screens[0]!.id;
  const r = addScreen(p, "Добавить задачу");
  p = r.project;
  const btn = makeElement("button", s1, { x: 16, y: 100 }, 0);
  btn.action = { to: r.id, transition: "slideLeft" };
  const pic = makeElement("image", s1, { x: 16, y: 200 }, 1);
  pic.content = { image: "idb:img_1", imageFit: "cover" };
  const list = makeElement("list", s1, { x: 16, y: 400 }, 2);
  list.bind = { table: "tasks", mode: "list" };
  p.elements = [btn, pic, list];
  p.data = { tables: [{ name: "tasks", fields: [{ name: "title", type: "text", required: true }] }] };
  p.bot = { name: "todo_bot", commands: [{ command: "start", description: "Открыть" }] };
  return { p, s1 };
}

describe("export bundle", () => {
  it("минимальный экспорт для модели", () => {
    const { p, s1 } = sample();
    const files = buildExportFiles(p, {
      scaffold: false,
      dialect: "sqlite",
      images: new Map([["idb:img_1", { data: new Uint8Array([1, 2, 3]), ext: "png" }]]),
      screenshots: new Map([[s1, new Uint8Array([9])]]),
    });
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["project.json", "PROMPT.md", "AGENTS.md", "CLAUDE.md", "README.md", "assets/images/img_1.png", "screens/01-glavnaya.png"]),
    );
    expect(files["server/package.json"]).toBeUndefined();
    const proj = JSON.parse(files["project.json"] as string);
    expect(proj.elements[1].content.image).toBe("assets/images/img_1.png");
    // экспортированный project.json снова открывается
    expect(parseProject(proj).ok).toBe(true);
    const prompt = files["PROMPT.md"] as string;
    expect(prompt).toContain("# Задачник");
    expect(prompt).toContain("«Главная» → «Добавить задачу»");
    expect(prompt).toContain("Таблица `tasks`");
  });

  it("заготовка: фронтенд, сервер, миграции, без секретов", () => {
    const { p } = sample();
    const files = buildExportFiles(p, { scaffold: true, dialect: "postgres", images: new Map(), screenshots: new Map() });
    for (const f of ["app/src/App.tsx", "server/src/index.ts", "server/src/initData.ts", "server/drizzle/0000_init.sql", "Dockerfile", ".env.example"]) {
      expect(files[f], f).toBeTruthy();
    }
    expect(files["server/package.json"]).toContain('"pg"');
    expect(files[".env.example"]).toMatch(/BOT_TOKEN=\n/);
    // Фронтенд можно выложить отдельно от API (GitHub Pages + API бота): адрес API, относительные пути, туннели.
    expect(files["app/src/api.ts"]).toContain("VITE_API_URL");
    expect(files["app/vite.config.ts"]).toContain('base: "./"');
    expect(files["app/vite.config.ts"]).toContain("API_PROXY");
    expect(files["app/vite.config.ts"]).toContain(".trycloudflare.com");
    expect(files["app/.env.example"]).toContain("VITE_API_URL=");
    expect(files["server/src/index.ts"]).toContain("cors(");
    // картинка без байтов не попадает в проект висячей ссылкой
    expect(JSON.parse(files["project.json"] as string).elements[1].content.image).toBeUndefined();
  });
});
