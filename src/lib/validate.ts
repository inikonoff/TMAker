// Валидатор и миграции проекта. Любой вход (файл, ссылка, IndexedDB, ИИ) проходит через parseProject.
import { isHex } from "./color";
import { BASE_STYLE, DEFAULT_THEME, KIND_SPEC, NO_STROKE } from "./defaults";
import { MAX_DEVICE, MIN_DEVICE, isDevicePreset } from "./devices";
import type {
  Action,
  ArrowData,
  ArrowEnd,
  Binding,
  Command,
  Content,
  Device,
  Element,
  Field,
  FieldType,
  Kind,
  Project,
  Screen,
  Stroke,
  Style,
  Swipe,
  Table,
  Theme,
  TransitionKind,
} from "./model";
import { KINDS, PROJECT_VERSION } from "./model";

export type ParseResult = { ok: true; project: Project; warnings: string[] } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number, min = -1e6, max = 1e6): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d;
const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : d;

export const TRANSITIONS: readonly TransitionKind[] = [
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "fade",
  "expand",
  "none",
];
const STROKES = ["solid", "dashed", "dotted", "double", "none"] as const;
const SHAPES = ["rect", "ellipse", "triangle", "star", "polygon"] as const;
const FITS = ["cover", "contain", "icon"] as const;
const FIELD_TYPES: readonly FieldType[] = ["text", "number", "boolean", "date", "image", "ref"];
/** Ключи, которые никогда не сохраняются: секреты не попадают в проект. */
const SECRET_KEYS = /token|secret|password|apikey|api_key/i;

function color(v: unknown, d: string): string {
  if (typeof v !== "string") return d;
  if (v === "transparent" || isHex(v)) return v;
  if (/^\$[a-zA-Z0-9]+$/.test(v)) return v;
  return d;
}

function device(v: unknown, d: Device): Device {
  if (isDevicePreset(v)) return v;
  if (isObj(v)) {
    const w = num(v.w, NaN, MIN_DEVICE, MAX_DEVICE);
    const h = num(v.h, NaN, MIN_DEVICE, MAX_DEVICE);
    if (Number.isFinite(w) && Number.isFinite(h)) return { w: Math.round(w), h: Math.round(h) };
  }
  return d;
}

function theme(v: unknown): Theme {
  const t = isObj(v) ? v : {};
  return {
    mode: oneOf(t.mode, ["light", "dark"] as const, DEFAULT_THEME.mode),
    darkLevel: num(t.darkLevel, DEFAULT_THEME.darkLevel, 0, 4),
    accent: isHex(str(t.accent)) ? str(t.accent) : DEFAULT_THEME.accent,
    radius: num(t.radius, DEFAULT_THEME.radius, 0, 64),
    motion: oneOf(t.motion, ["standard", "expressive"] as const, DEFAULT_THEME.motion),
  };
}

function stroke(v: unknown): Stroke {
  if (!isObj(v)) return { ...NO_STROKE };
  return {
    style: oneOf(v.style, STROKES, "none"),
    width: num(v.width, 1, 0, 64),
    color: color(v.color, NO_STROKE.color),
  };
}

function style(v: unknown): Style {
  const s = isObj(v) ? v : {};
  return {
    fill: color(s.fill, BASE_STYLE.fill),
    stroke: stroke(s.stroke),
    radius: num(s.radius, 0, 0, 2000),
    shadow: Math.round(num(s.shadow, 0, 0, 3)),
    opacity: num(s.opacity, 1, 0, 1),
    textColor: color(s.textColor, BASE_STYLE.textColor),
    fontSize: num(s.fontSize, BASE_STYLE.fontSize, 6, 200),
    fontWeight: ([400, 500, 600, 700] as const).find((w) => w === Number(s.fontWeight)) ?? 400,
    align: oneOf(s.align, ["left", "center", "right"] as const, "left"),
  };
}

function content(v: unknown): Content | undefined {
  if (!isObj(v)) return undefined;
  const c: Content = {};
  if (typeof v.text === "string") c.text = v.text.slice(0, 5000);
  if (typeof v.image === "string" && /^(idb:|https?:|data:image\/)/.test(v.image)) c.image = v.image;
  if (v.imageFit !== undefined) c.imageFit = oneOf(v.imageFit, FITS, "cover");
  if (typeof v.icon === "string") c.icon = v.icon.slice(0, 64);
  if (v.shape !== undefined) c.shape = oneOf(v.shape, SHAPES, "rect");
  if (v.sides !== undefined) c.sides = Math.round(num(v.sides, 6, 3, 12));
  if (Array.isArray(v.items)) c.items = v.items.filter((i): i is string => typeof i === "string").slice(0, 50);
  if (typeof v.checked === "boolean") c.checked = v.checked;
  if (typeof v.value === "number") c.value = num(v.value, 0, -1e6, 1e6);
  if (typeof v.placeholder === "string") c.placeholder = v.placeholder.slice(0, 200);
  return Object.keys(c).length ? c : undefined;
}

function action(v: unknown, screenIds: Set<string>, warn: (m: string) => void): Action | undefined {
  if (!isObj(v)) return undefined;
  if (v.back === true) return { back: true };
  if (v.open === "link" && typeof v.url === "string") {
    if (/^(https?:|tg:|mailto:)/.test(v.url)) return { open: "link", url: v.url };
    warn(`Ссылка отклонена: ${v.url.slice(0, 40)}`);
    return undefined;
  }
  if (typeof v.to === "string") {
    if (!screenIds.has(v.to)) {
      warn(`Переход на несуществующий экран ${v.to} удалён`);
      return undefined;
    }
    return { to: v.to, transition: oneOf(v.transition, TRANSITIONS, "slideLeft") };
  }
  return undefined;
}

function binding(v: unknown): Binding | undefined {
  if (!isObj(v) || typeof v.table !== "string") return undefined;
  const b: Binding = { table: v.table, mode: oneOf(v.mode, ["list", "form", "value"] as const, "list") };
  if (typeof v.field === "string") b.field = v.field;
  return b;
}

function arrowEnd(v: unknown): ArrowEnd {
  const e = isObj(v) ? v : {};
  const out: ArrowEnd = { x: num(e.x, 0), y: num(e.y, 0) };
  if (typeof e.el === "string") out.el = e.el;
  return out;
}

function arrow(v: unknown): ArrowData | undefined {
  if (!isObj(v)) return undefined;
  return {
    from: arrowEnd(v.from),
    to: arrowEnd(v.to),
    head: oneOf(v.head, ["none", "end", "both"] as const, "end"),
  };
}

function swipe(v: unknown, screenIds: Set<string>): Swipe | undefined {
  if (!isObj(v)) return undefined;
  const s: Swipe = {};
  for (const dir of ["left", "right", "up", "down"] as const) {
    const t = v[dir];
    if (typeof t === "string" && screenIds.has(t)) s[dir] = t;
  }
  return Object.keys(s).length ? s : undefined;
}

function tables(v: unknown): Table[] {
  if (!isObj(v) || !Array.isArray(v.tables)) return [];
  const out: Table[] = [];
  const names = new Set<string>();
  for (const t of v.tables) {
    if (!isObj(t) || typeof t.name !== "string" || !t.name.trim() || names.has(t.name)) continue;
    names.add(t.name);
    const fields: Field[] = [];
    const fnames = new Set<string>();
    for (const f of Array.isArray(t.fields) ? t.fields : []) {
      if (!isObj(f) || typeof f.name !== "string" || !f.name.trim() || fnames.has(f.name)) continue;
      fnames.add(f.name);
      const field: Field = { name: f.name, type: oneOf(f.type, FIELD_TYPES, "text"), required: bool(f.required) };
      if (typeof f.ref === "string") field.ref = f.ref;
      fields.push(field);
    }
    out.push({ name: t.name, fields });
  }
  return out;
}

function bot(v: unknown): { name: string; commands: Command[] } {
  const b = isObj(v) ? v : {};
  const commands: Command[] = [];
  for (const c of Array.isArray(b.commands) ? b.commands : []) {
    if (!isObj(c) || typeof c.command !== "string") continue;
    commands.push({ command: c.command.replace(/^\//, "").slice(0, 32), description: str(c.description).slice(0, 256) });
  }
  return { name: str(b.name).slice(0, 64), commands };
}

/** Миграции: каждая поднимает версию на 1. Версия 0 — файлы без поля version. */
const MIGRATIONS: Record<number, (p: Obj) => Obj> = {
  0: (p) => {
    // Ранние черновики: frames/items вместо screens/elements.
    const out: Obj = { ...p, version: 1 };
    if (!Array.isArray(p.screens) && Array.isArray(p.frames)) out.screens = p.frames;
    if (!Array.isArray(p.elements) && Array.isArray(p.items)) out.elements = p.items;
    delete out.frames;
    delete out.items;
    return out;
  },
};

export function migrate(raw: Obj): Obj {
  let p = raw;
  let v = typeof p.version === "number" ? p.version : 0;
  while (v < PROJECT_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) break;
    p = m(p);
    v = typeof p.version === "number" ? p.version : v + 1;
  }
  return p;
}

function stripSecrets(v: unknown, warn: (m: string) => void, path = ""): unknown {
  if (Array.isArray(v)) return v.map((x, i) => stripSecrets(x, warn, `${path}[${i}]`));
  if (!isObj(v)) return v;
  const out: Obj = {};
  for (const [k, val] of Object.entries(v)) {
    if (SECRET_KEYS.test(k)) {
      warn(`Удалено секретное поле ${path ? path + "." : ""}${k}`);
      continue;
    }
    out[k] = stripSecrets(val, warn, path ? `${path}.${k}` : k);
  }
  return out;
}

export function parseProject(input: unknown): ParseResult {
  let data = input;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, error: "Файл не является JSON" };
    }
  }
  if (!isObj(data)) return { ok: false, error: "Ожидался объект проекта" };
  if (typeof data.version === "number" && data.version > PROJECT_VERSION) {
    return { ok: false, error: `Проект создан в более новой версии (${data.version})` };
  }
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const raw = migrate(stripSecrets(data, warn) as Obj);
  if (!Array.isArray(raw.screens)) return { ok: false, error: "В проекте нет списка экранов" };

  const screens: Screen[] = [];
  const screenIds = new Set<string>();
  for (const s of raw.screens) {
    if (!isObj(s) || typeof s.id !== "string" || screenIds.has(s.id)) {
      warn("Пропущен некорректный экран");
      continue;
    }
    screenIds.add(s.id);
    screens.push({
      id: s.id,
      name: str(s.name, "Экран").slice(0, 80),
      x: num(s.x, 0),
      y: num(s.y, 0),
      bg: color(s.bg, "$bg"),
      note: str(s.note).slice(0, 5000),
    });
  }
  // Второй проход: устройство и свайпы (свайпы ссылаются на экраны).
  raw.screens.forEach((s) => {
    if (!isObj(s) || typeof s.id !== "string") return;
    const target = screens.find((x) => x.id === s.id);
    if (!target) return;
    if (s.device !== undefined) target.device = device(s.device, "phone");
    const sw = swipe(s.swipe, screenIds);
    if (sw) target.swipe = sw;
  });
  if (screens.length === 0) return { ok: false, error: "В проекте нет ни одного экрана" };

  const elements: Element[] = [];
  const elIds = new Set<string>();
  for (const e of Array.isArray(raw.elements) ? raw.elements : []) {
    if (!isObj(e) || typeof e.id !== "string" || elIds.has(e.id)) {
      warn("Пропущен некорректный элемент");
      continue;
    }
    if (typeof e.screenId !== "string" || !screenIds.has(e.screenId)) {
      warn(`Элемент ${e.id} без экрана удалён`);
      continue;
    }
    if (!(KINDS as readonly string[]).includes(str(e.kind))) {
      warn(`Неизвестный вид элемента: ${str(e.kind)}`);
      continue;
    }
    const kind = e.kind as Kind;
    elIds.add(e.id);
    const spec = KIND_SPEC[kind];
    const el: Element = {
      id: e.id,
      screenId: e.screenId,
      kind,
      x: num(e.x, 0),
      y: num(e.y, 0),
      w: num(e.w, spec.w, 0, 10000),
      h: num(e.h, spec.h, 0, 10000),
      z: num(e.z, elements.length),
      style: style(e.style),
    };
    if (typeof e.group === "string") el.group = e.group;
    if (e.locked === true) el.locked = true;
    if (e.hidden === true) el.hidden = true;
    if (typeof e.name === "string") el.name = e.name.slice(0, 80);
    const c = content(e.content);
    if (c) el.content = c;
    const a = action(e.action, screenIds, warn);
    if (a) el.action = a;
    const b = binding(e.bind);
    if (b) el.bind = b;
    const ar = arrow(e.arrow);
    if (ar) el.arrow = ar;
    else if (kind === "line" || kind === "arrow") {
      el.arrow = { from: { x: el.x, y: el.y }, to: { x: el.x + el.w, y: el.y + el.h }, head: kind === "arrow" ? "end" : "none" };
    }
    elements.push(el);
  }
  // Концы стрелок, ссылающиеся на удалённые элементы, отвязываем.
  for (const el of elements) {
    if (!el.arrow) continue;
    for (const end of [el.arrow.from, el.arrow.to]) if (end.el && !elIds.has(end.el)) delete end.el;
  }

  const project: Project = {
    version: PROJECT_VERSION,
    title: str(raw.title, "Без названия").slice(0, 120),
    brief: str(raw.brief).slice(0, 20000),
    device: device(raw.device, "telegram"),
    theme: theme(raw.theme),
    screens,
    elements,
    data: { tables: tables(raw.data) },
    bot: bot(raw.bot),
  };
  return { ok: true, project, warnings };
}
