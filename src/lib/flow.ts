// Граф переходов между экранами: рёбра из действий элементов и свайпов, раскладка по уровням.
import type { Project, TransitionKind } from "./model";

export type FlowEdge = { from: string; to: string; label: string; kind: "tap" | "swipe" | "back"; transition: TransitionKind };
export type FlowNode = { id: string; name: string; col: number; row: number };

export function flowEdges(p: Project): FlowEdge[] {
  const out: FlowEdge[] = [];
  const seen = new Set<string>();
  const push = (e: FlowEdge) => {
    const k = `${e.from}>${e.to}>${e.kind}`;
    if (seen.has(k) || e.from === e.to) return;
    seen.add(k);
    out.push(e);
  };
  for (const el of p.elements) {
    const a = el.action;
    if (a && "to" in a) {
      push({ from: el.screenId, to: a.to, label: el.content?.text || el.name || el.kind, kind: "tap", transition: a.transition });
    }
  }
  const dirs = { left: "slideLeft", right: "slideRight", up: "slideUp", down: "slideDown" } as const;
  for (const s of p.screens) {
    for (const d of ["left", "right", "up", "down"] as const) {
      const t = s.swipe?.[d];
      if (t) push({ from: s.id, to: t, label: `свайп ${d === "left" ? "←" : d === "right" ? "→" : d === "up" ? "↑" : "↓"}`, kind: "swipe", transition: dirs[d] });
    }
  }
  return out;
}

/** Уровни — расстояние от первого экрана (BFS). Недостижимые — в последней колонке. */
export function flowLayout(p: Project): { nodes: FlowNode[]; edges: FlowEdge[]; cols: number; rows: number } {
  const edges = flowEdges(p);
  const depth = new Map<string, number>();
  const first = p.screens[0];
  if (first) {
    depth.set(first.id, 0);
    const queue = [first.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of edges) {
        if (e.from === id && !depth.has(e.to)) {
          depth.set(e.to, depth.get(id)! + 1);
          queue.push(e.to);
        }
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const rowsPerCol = new Map<number, number>();
  const nodes: FlowNode[] = p.screens.map((s) => {
    const col = depth.get(s.id) ?? maxDepth + 1;
    const row = rowsPerCol.get(col) ?? 0;
    rowsPerCol.set(col, row + 1);
    return { id: s.id, name: s.name, col, row };
  });
  return {
    nodes,
    edges,
    cols: Math.max(1, ...nodes.map((n) => n.col + 1)),
    rows: Math.max(1, ...rowsPerCol.values()),
  };
}
