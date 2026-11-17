import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { emptyProject } from "../lib/defaults";
import { idbGet, idbSet, STORE_PROJECTS } from "./idb";
import {
  createProject,
  deleteProject,
  deleteVersion,
  listProjects,
  listVersions,
  loadProject,
  migrateLegacy,
  saveProject,
  saveVersion,
  versionProject,
} from "./projects";

describe("projects store", () => {
  it("создаёт, сохраняет, перечисляет и удаляет проекты", async () => {
    const a = await createProject({ ...emptyProject(), title: "A" });
    const b = await createProject({ ...emptyProject(), title: "B" });
    const p = (await loadProject(a))!.project;
    await new Promise((r) => setTimeout(r, 5));
    await saveProject(a, { ...p, title: "A2" });
    const list = await listProjects();
    expect(list[0]!.title).toBe("A2"); // свежие сверху
    expect(list.map((m) => m.id)).toContain(b);
    await deleteProject(b);
    expect((await listProjects()).map((m) => m.id)).not.toContain(b);
    expect(await loadProject(b)).toBeNull();
  });

  it("переносит старый одиночный проект", async () => {
    await idbSet(STORE_PROJECTS, "current", { ...emptyProject(), title: "Старый" });
    const id = await migrateLegacy();
    expect(id).toBeTruthy();
    expect((await loadProject(id!))!.project.title).toBe("Старый");
    expect(await idbGet(STORE_PROJECTS, "current")).toBeUndefined();
    expect(await migrateLegacy()).toBeNull();
  });

  it("версии: снимок не меняется вместе с проектом", async () => {
    const id = await createProject(emptyProject());
    const p = (await loadProject(id))!.project;
    const v = await saveVersion(id, "до правок", p);
    p.title = "изменён";
    const [stored] = await listVersions(id);
    expect(stored!.name).toBe("до правок");
    expect(versionProject(stored!)!.title).toBe("Новый проект");
    await deleteVersion(id, v.id);
    expect(await listVersions(id)).toEqual([]);
  });
});
