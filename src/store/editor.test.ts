import { beforeEach, describe, expect, it } from "vitest";
import { emptyProject } from "../lib/defaults";
import { addScreen } from "../lib/ops";
import { resetHistory, useEditor } from "./editor";

describe("editor store", () => {
  beforeEach(() => {
    useEditor.getState().replaceProject(emptyProject(), { record: false });
    resetHistory();
  });

  it("commit/undo/redo и слияние правок поля", () => {
    const st = useEditor.getState();
    st.commit((p) => ({ ...p, title: "A" }), "title");
    st.commit((p) => ({ ...p, title: "AB" }), "title");
    expect(useEditor.getState().canUndo).toBe(true);
    useEditor.getState().undo();
    expect(useEditor.getState().project.title).toBe("Новый проект");
    useEditor.getState().redo();
    expect(useEditor.getState().project.title).toBe("AB");
  });

  it("черновик: отмена возвращает документ одним шагом и не оставляет redo", () => {
    const before = useEditor.getState().project;
    const draft = addScreen(before).project;
    useEditor.getState().replaceProject(draft, { draft: true });
    expect(useEditor.getState().pendingDraft).toBe(true);
    useEditor.getState().rejectDraft();
    const s = useEditor.getState();
    expect(s.project).toBe(before);
    expect(s.pendingDraft).toBe(false);
    expect(s.canRedo).toBe(false);
  });

  it("черновик: оставить — затем отмена одним шагом", () => {
    const before = useEditor.getState().project;
    useEditor.getState().replaceProject(addScreen(before).project, { draft: true });
    useEditor.getState().acceptDraft();
    useEditor.getState().undo();
    expect(useEditor.getState().project).toBe(before);
  });

  it("выделение группы целиком", async () => {
    const { makeElement } = await import("../lib/defaults");
    const sid = useEditor.getState().project.screens[0]!.id;
    const a = { ...makeElement("box", sid, { x: 0, y: 0 }, 0), group: "g1" };
    const b = { ...makeElement("text", sid, { x: 10, y: 10 }, 1), group: "g1" };
    const c = makeElement("button", sid, { x: 0, y: 100 }, 2);
    useEditor.getState().commit((p) => ({ ...p, elements: [a, b, c] }));
    useEditor.getState().select([a.id]);
    expect(useEditor.getState().selection.sort()).toEqual([a.id, b.id].sort());
    useEditor.getState().select([c.id], "add");
    expect(useEditor.getState().selection.length).toBe(3);
    useEditor.getState().select([b.id], "toggle");
    expect(useEditor.getState().selection).toEqual([c.id]);
  });
});
