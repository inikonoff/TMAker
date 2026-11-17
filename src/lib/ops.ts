// Операции над проектом. Все функции чистые: принимают проект и возвращают новый.
import { makeScreen } from "./defaults";
import { screenSize } from "./devices";
import type { Rect } from "./geometry";
import { edgePoint, rectCenter } from "./geometry";
import { uid } from "./ids";
import type { Device, Element, Project, Screen } from "./model";

export const SCREEN_GAP = 120;

export function screenRect(p: Project, s: Screen): Rect {
  const { w, h } = screenSize(p, s);
  return { x: s.x, y: s.y, w, h };
}

export function elementsOf(p: Project, screenId: string): Element[] {
  return p.elements.filter((e) => e.screenId === screenId).sort((a, b) => a.z - b.z);
}

export function maxZ(p: Project, screenId: string): number {
  let z = -1;
  for (const e of p.elements) if (e.screenId === screenId && e.z > z) z = e.z;
  return z;
}

/** Место для нового экрана — справа от самого правого. */
export function nextScreenPos(p: Project): { x: number; y: number } {
  if (p.screens.length === 0) return { x: 0, y: 0 };
  let right = -Infinity;
  let top = Infinity;
  for (const s of p.screens) {
    const r = screenRect(p, s);
    right = Math.max(right, r.x + r.w);
    top = Math.min(top, r.y);
  }
  return { x: right + SCREEN_GAP, y: top };
}

export function addScreen(p: Project, name?: string): { project: Project; id: string } {
  const pos = nextScreenPos(p);
  const s = makeScreen(name ?? `Экран ${p.screens.length + 1}`, pos.x, pos.y);
  return { project: { ...p, screens: [...p.screens, s] }, id: s.id };
}

export function updateScreen(p: Project, id: string, patch: Partial<Screen>): Project {
  return { ...p, screens: p.screens.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function setScreenDevice(p: Project, id: string, device: Device | undefined): Project {
  return {
    ...p,
    screens: p.screens.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s };
      if (device === undefined) delete next.device;
      else next.device = device;
      return next;
    }),
  };
}

/** Дублирование экрана со всеми элементами; переходы внутри экрана перенаправляются на копии. */
export function duplicateScreen(p: Project, id: string): { project: Project; id: string } | null {
  const src = p.screens.find((s) => s.id === id);
  if (!src) return null;
  const pos = nextScreenPos(p);
  const copy: Screen = { ...structuredClone(src), id: uid("scr"), name: `${src.name} (копия)`, x: pos.x, y: pos.y };
  const idMap = new Map<string, string>();
  const els = elementsOf(p, id);
  for (const e of els) idMap.set(e.id, uid("el"));
  const groupMap = new Map<string, string>();
  const copies = els.map((e) => {
    const c = structuredClone(e);
    c.id = idMap.get(e.id)!;
    c.screenId = copy.id;
    if (c.group) {
      if (!groupMap.has(c.group)) groupMap.set(c.group, uid("g"));
      c.group = groupMap.get(c.group);
    }
    if (c.arrow) for (const end of [c.arrow.from, c.arrow.to]) if (end.el) end.el = idMap.get(end.el);
    return c;
  });
  const idx = p.screens.findIndex((s) => s.id === id);
  const screens = [...p.screens];
  screens.splice(idx + 1, 0, copy);
  return { project: { ...p, screens, elements: [...p.elements, ...copies] }, id: copy.id };
}

/** Удаление экрана: его элементы удаляются, переходы и свайпы на него снимаются. */
export function deleteScreen(p: Project, id: string): Project {
  if (p.screens.length <= 1) return p;
  const screens = p.screens
    .filter((s) => s.id !== id)
    .map((s) => {
      if (!s.swipe) return s;
      const sw = { ...s.swipe };
      for (const k of ["left", "right", "up", "down"] as const) if (sw[k] === id) delete sw[k];
      const next: Screen = { ...s, swipe: sw };
      if (Object.keys(sw).length === 0) delete next.swipe;
      return next;
    });
  const elements = p.elements
    .filter((e) => e.screenId !== id)
    .map((e) => {
      let next = e;
      if (e.action && "to" in e.action && e.action.to === id) {
        next = { ...e };
        delete next.action;
      }
      if (e.content?.links?.includes(id)) {
        next = { ...next, content: { ...e.content, links: e.content.links.map((l) => (l === id ? "" : l)) } };
      }
      return next;
    });
  return { ...p, screens, elements };
}

/** Перестановка экранов в списке (порядок сценария). */
export function reorderScreens(p: Project, orderedIds: string[]): Project {
  const byId = new Map(p.screens.map((s) => [s.id, s]));
  const screens = orderedIds.map((id) => byId.get(id)).filter((s): s is Screen => !!s);
  if (screens.length !== p.screens.length) return p;
  return { ...p, screens };
}

export function updateElements(p: Project, patches: Map<string, Partial<Element>>): Project {
  if (patches.size === 0) return p;
  const elements = p.elements.map((e) => {
    const patch = patches.get(e.id);
    return patch ? { ...e, ...patch } : e;
  });
  return syncArrows({ ...p, elements });
}

export function addElements(p: Project, els: Element[]): Project {
  return syncArrows({ ...p, elements: [...p.elements, ...els] });
}

/** Удаление элементов; стрелки, привязанные к ним, отвязываются и остаются на месте. */
export function deleteElements(p: Project, ids: Set<string>): Project {
  const elements = p.elements
    .filter((e) => !ids.has(e.id))
    .map((e) => {
      if (!e.arrow) return e;
      const from = { ...e.arrow.from };
      const to = { ...e.arrow.to };
      if (from.el && ids.has(from.el)) delete from.el;
      if (to.el && ids.has(to.el)) delete to.el;
      return { ...e, arrow: { ...e.arrow, from, to } };
    });
  return { ...p, elements };
}

/** Копии элементов со сдвигом. Возвращает новые id. */
export function duplicateElements(p: Project, ids: string[], offset = 16): { project: Project; ids: string[] } {
  const src = p.elements.filter((e) => ids.includes(e.id));
  const idMap = new Map(src.map((e) => [e.id, uid("el")]));
  const groupMap = new Map<string, string>();
  const zBase = new Map<string, number>();
  const copies = src
    .sort((a, b) => a.z - b.z)
    .map((e) => {
      const c = structuredClone(e);
      c.id = idMap.get(e.id)!;
      c.x += offset;
      c.y += offset;
      const z = (zBase.get(e.screenId) ?? maxZ(p, e.screenId)) + 1;
      zBase.set(e.screenId, z);
      c.z = z;
      if (c.group) {
        if (!groupMap.has(c.group)) groupMap.set(c.group, uid("g"));
        c.group = groupMap.get(c.group);
      }
      if (c.arrow) {
        for (const end of [c.arrow.from, c.arrow.to]) {
          end.x += offset;
          end.y += offset;
          if (end.el) {
            if (idMap.has(end.el)) end.el = idMap.get(end.el);
            else delete end.el;
          }
        }
      }
      return c;
    });
  return { project: syncArrows({ ...p, elements: [...p.elements, ...copies] }), ids: copies.map((c) => c.id) };
}

/** Порядок слоёв: перенумеровать z внутри экрана 0..n-1. */
function renumber(els: Element[]): Map<string, number> {
  const m = new Map<string, number>();
  els.forEach((e, i) => m.set(e.id, i));
  return m;
}

export function reorderZ(p: Project, ids: Set<string>, where: "front" | "back" | "forward" | "backward"): Project {
  const screenIds = new Set(p.elements.filter((e) => ids.has(e.id)).map((e) => e.screenId));
  const zs = new Map<string, number>();
  for (const sid of screenIds) {
    const list = elementsOf(p, sid);
    let ordered: Element[];
    if (where === "front") ordered = [...list.filter((e) => !ids.has(e.id)), ...list.filter((e) => ids.has(e.id))];
    else if (where === "back") ordered = [...list.filter((e) => ids.has(e.id)), ...list.filter((e) => !ids.has(e.id))];
    else {
      ordered = [...list];
      const step = where === "forward" ? 1 : -1;
      const idxs = ordered.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
      if (step > 0) idxs.reverse();
      for (const i of idxs) {
        const j = i + step;
        const a = ordered[i];
        const b = ordered[j];
        if (!a || !b || ids.has(b.id)) continue;
        ordered[i] = b;
        ordered[j] = a;
      }
    }
    for (const [id, z] of renumber(ordered)) zs.set(id, z);
  }
  return { ...p, elements: p.elements.map((e) => (zs.has(e.id) ? { ...e, z: zs.get(e.id)! } : e)) };
}

/** Перенос элементов на другой экран с сохранением положения в мире. */
export function moveToScreen(p: Project, ids: Set<string>, targetId: string): Project {
  const target = p.screens.find((s) => s.id === targetId);
  if (!target) return p;
  let z = maxZ(p, targetId);
  const elements = p.elements.map((e) => {
    if (!ids.has(e.id) || e.screenId === targetId) return e;
    const from = p.screens.find((s) => s.id === e.screenId);
    if (!from) return e;
    const dx = from.x - target.x;
    const dy = from.y - target.y;
    const next: Element = { ...e, screenId: targetId, x: e.x + dx, y: e.y + dy, z: ++z };
    if (e.arrow) {
      next.arrow = {
        ...e.arrow,
        from: { ...e.arrow.from, x: e.arrow.from.x + dx, y: e.arrow.from.y + dy },
        to: { ...e.arrow.to, x: e.arrow.to.x + dx, y: e.arrow.to.y + dy },
      };
    }
    return next;
  });
  return syncArrows({ ...p, elements });
}

/** Стрелки: концы, привязанные к элементам, следуют за ними; рамка стрелки = её концы. */
export function syncArrows(p: Project): Project {
  if (!p.elements.some((e) => e.arrow)) return p;
  const byId = new Map(p.elements.map((e) => [e.id, e]));
  let changed = false;
  const elements = p.elements.map((e) => {
    if (!e.arrow) return e;
    const next = resolveArrow(e, byId);
    if (next !== e) changed = true;
    return next;
  });
  return changed ? { ...p, elements } : p;
}

export function resolveArrow(e: Element, byId: Map<string, Element>): Element {
  if (!e.arrow) return e;
  const a = e.arrow;
  const fromEl = a.from.el ? byId.get(a.from.el) : undefined;
  const toEl = a.to.el ? byId.get(a.to.el) : undefined;
  const valid = (x: Element | undefined) => (x && x.screenId === e.screenId ? x : undefined);
  const fe = valid(fromEl);
  const te = valid(toEl);
  let from = { x: a.from.x, y: a.from.y };
  let to = { x: a.to.x, y: a.to.y };
  if (fe && te) {
    from = edgePoint(fe, rectCenter(te));
    to = edgePoint(te, rectCenter(fe));
  } else if (fe) from = edgePoint(fe, to);
  else if (te) to = edgePoint(te, from);
  const round = (v: number) => Math.round(v * 10) / 10;
  from = { x: round(from.x), y: round(from.y) };
  to = { x: round(to.x), y: round(to.y) };
  const box = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) };
  if (
    from.x === a.from.x &&
    from.y === a.from.y &&
    to.x === a.to.x &&
    to.y === a.to.y &&
    box.x === e.x &&
    box.y === e.y &&
    box.w === e.w &&
    box.h === e.h
  )
    return e;
  return { ...e, ...box, arrow: { ...a, from: { ...a.from, ...from }, to: { ...a.to, ...to } } };
}

/** Сдвиг элемента; у стрелки сдвигаются свободные концы. */
export function movedElement(e: Element, x: number, y: number): Partial<Element> {
  if (!e.arrow) return { x, y };
  const dx = x - e.x;
  const dy = y - e.y;
  return {
    x,
    y,
    arrow: {
      ...e.arrow,
      from: { ...e.arrow.from, x: e.arrow.from.x + dx, y: e.arrow.from.y + dy },
      to: { ...e.arrow.to, x: e.arrow.to.x + dx, y: e.arrow.to.y + dy },
    },
  };
}

/** Все id группы, к которой относятся элементы (для выделения группы целиком). */
export function expandGroups(p: Project, ids: string[]): string[] {
  const groups = new Set(p.elements.filter((e) => ids.includes(e.id) && e.group).map((e) => e.group!));
  if (groups.size === 0) return ids;
  const out = new Set(ids);
  for (const e of p.elements) if (e.group && groups.has(e.group)) out.add(e.id);
  return [...out];
}
