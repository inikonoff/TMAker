import { describe, expect, it } from "vitest";
import { CENTER, lerpPose, posesFor, swipeCommits, swipeDirection, swipeProgress, transitionPoses } from "./transitions";

describe("transitions", () => {
  it("назад — зеркало вперёд", () => {
    const f = posesFor("slideLeft", "forward");
    const b = posesFor("slideLeft", "back");
    expect(b.outgoing.to).toEqual(f.incoming.from);
    expect(b.incoming.from).toEqual(f.outgoing.to);
    expect(f.incomingOnTop).toBe(true);
    expect(b.incomingOnTop).toBe(false);
  });

  it("none стоит на месте", () => {
    expect(transitionPoses("none")).toEqual({ enterFrom: CENTER, exitTo: CENTER });
  });

  it("интерполяция позы", () => {
    const p = lerpPose(CENTER, { x: 1, y: 0, scale: 0.5, opacity: 0 }, 0.5);
    expect(p).toEqual({ x: 0.5, y: 0, scale: 0.75, opacity: 0.5 });
  });

  it("свайп: направление, прогресс и порог", () => {
    expect(swipeDirection(-30, 5)).toBe("left");
    expect(swipeDirection(2, 3)).toBeNull();
    expect(swipeDirection(4, 40)).toBe("down");
    expect(swipeProgress("left", -100, 0, 400, 800)).toBe(0.25);
    expect(swipeProgress("left", 100, 0, 400, 800)).toBe(0);
    expect(swipeCommits(0.3, 0, 400)).toBe(true);
    expect(swipeCommits(0.1, 0, 400)).toBe(false);
    expect(swipeCommits(0.1, 600, 400)).toBe(true);
  });
});
