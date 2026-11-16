import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, createHistory, record, redo, undo } from "./history";

describe("history", () => {
  it("отмена и возврат", () => {
    let h = createHistory<number>();
    h = record(h, 1, null, 0);
    h = record(h, 2, null, 10);
    const u = undo(h, 3)!;
    expect(u.state).toBe(2);
    const u2 = undo(u.history, u.state)!;
    expect(u2.state).toBe(1);
    expect(undo(u2.history, u2.state)).toBeNull();
    const r = redo(u2.history, u2.state)!;
    expect(r.state).toBe(2);
    const r2 = redo(r.history, r.state)!;
    expect(r2.state).toBe(3);
    expect(redo(r2.history, r2.state)).toBeNull();
  });

  it("сливает правки одного поля за 800 мс", () => {
    let h = createHistory<string>();
    h = record(h, "a", "title", 0);
    h = record(h, "ab", "title", 300);
    h = record(h, "abc", "title", 900);
    expect(h.past).toEqual(["a"]);
    h = record(h, "abcd", "title", 2000);
    expect(h.past).toEqual(["a", "abcd"]);
    h = record(h, "x", "other", 2100);
    expect(h.past.length).toBe(3);
  });

  it("новая правка очищает future и держит лимит", () => {
    let h = createHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, i, null, i * 1000);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
    const u = undo(h, 999)!;
    expect(u.history.future.length).toBe(1);
    expect(record(u.history, 5).future).toEqual([]);
  });
});
