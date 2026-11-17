// ИИ (Groq, OpenAI-совместимый API): фиксированные промпты, фиксированная JSON-форма ответа.
// Модель не выдаёт координаты — раскладку делают правила (placeNew), результат применяется только после просмотра.
import { KIND_SPEC, makeElement } from "./defaults";
import { screenSize } from "./devices";
import { uid } from "./ids";
import type { BindMode, Element, FieldType, Kind, Project, Table } from "./model";
import { KINDS } from "./model";
import { addScreen, elementsOf, syncArrows } from "./ops";
import { placeNew } from "./placement";

export const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "moonshotai/kimi-k2-instruct",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
];

export type AiSettings = { key: string; model: string; baseUrl: string };
export type AiTask = "screen" | "schema" | "texts";
export type ChatMessage = { role: "system" | "user"; content: string };

const AI_KINDS = KINDS.filter((k) => k !== "line" && k !== "arrow" && k !== "shape");

const SYSTEM = `Ты помогаешь проектировать Telegram Mini App в визуальном конструкторе.
Отвечай ТОЛЬКО одним JSON-объектом без пояснений и без markdown.
Пиши тексты интерфейса на языке пользователя (по умолчанию русский), коротко и по делу.
Никогда не придумывай координаты и размеры — их расставит конструктор.`;

function compactProject(p: Project) {
  return {
    title: p.title,
    brief: p.brief,
    screens: p.screens.map((s) => ({
      name: s.name,
      note: s.note || undefined,
      elements: elementsOf(p, s.id)
        .filter((e) => e.kind !== "line" && e.kind !== "arrow")
        .map((e) => ({ kind: e.kind, text: e.content?.text, items: e.content?.items, bind: e.bind })),
    })),
    tables: p.data?.tables ?? [],
  };
}

export function buildMessages(task: AiTask, p: Project, input: { prompt: string; screenId?: string }): ChatMessage[] {
  const ctx = JSON.stringify(compactProject(p));
  if (task === "screen") {
    return [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Проект: ${ctx}

Собери НОВЫЙ экран по описанию: «${input.prompt}».
Форма ответа:
{"name": "Имя экрана", "elements": [ {"kind": "...", "text": "...", "items": ["..."], "placeholder": "...", "bind": {"table": "...", "mode": "list"|"form"|"value"|"record", "field": "..."}, "goTo": "имя существующего экрана или back"} ], "tables": [ {"name": "...", "fields": [ {"name": "...", "type": "text"|"number"|"boolean"|"date"|"image"|"ref", "required": true, "ref": "..."} ]} ]}
Допустимые kind: ${AI_KINDS.join(", ")}.
Элементы перечисляй сверху вниз. headerBar — шапка, nav — нижняя навигация, mainButton — главная кнопка Telegram внизу.
Для списка записей используй kind "list" с bind mode "list"; для формы добавления — kind "card" с bind mode "form".
Если у списка есть goTo, нажатие на строку открывает экран и передаёт выбранную запись; на экране деталей используй bind mode "record" с field — поле этой записи.
Если нужных таблиц нет в проекте — опиши их в "tables". Поля необязательны, лишнее не добавляй.`,
      },
    ];
  }
  if (task === "schema") {
    return [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Проект: ${ctx}

Предложи схему данных для этого приложения${input.prompt ? ` с учётом пожелания: «${input.prompt}»` : ""}.
Форма ответа: {"tables": [ {"name": "латиницей_snake_case", "fields": [ {"name": "...", "type": "text"|"number"|"boolean"|"date"|"image"|"ref", "required": true|false, "ref": "имя таблицы для type ref"} ]} ]}
Не добавляй поля id, user_id, created_at — они создаются автоматически.`,
      },
    ];
  }
  const screen = p.screens.find((s) => s.id === input.screenId) ?? p.screens[0]!;
  const els = elementsOf(p, screen.id)
    .filter((e) => e.content?.text !== undefined || e.content?.items || e.content?.placeholder !== undefined)
    .map((e) => ({ id: e.id, kind: e.kind, text: e.content?.text, items: e.content?.items, placeholder: e.content?.placeholder }));
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Проект: «${p.title}». ${p.brief}
Экран «${screen.name}». Его тексты: ${JSON.stringify(els)}

Перепиши подписи и тексты так, чтобы они были понятными и живыми${input.prompt ? `; пожелание: «${input.prompt}»` : ""}.
Форма ответа: {"texts": [ {"id": "тот же id", "text": "...", "items": ["..."], "placeholder": "..."} ]}
Возвращай только изменённые элементы и только те поля, что были у элемента. id не меняй.`,
    },
  ];
}

// ---------- Разбор ответа ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Достаёт JSON даже если модель обернула его в ```json … ``` или добавила текст. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced?.[1] ?? t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
    return JSON.parse(body);
  }
}

const FIELD_TYPES: FieldType[] = ["text", "number", "boolean", "date", "image", "ref"];

export function parseTables(v: unknown): Table[] {
  if (!Array.isArray(v)) return [];
  const out: Table[] = [];
  for (const t of v) {
    if (!isObj(t) || !str(t.name)) continue;
    const name = str(t.name, 48)!.trim();
    if (!name || out.some((x) => x.name === name)) continue;
    const fields = (Array.isArray(t.fields) ? t.fields : [])
      .filter(isObj)
      .map((f) => ({
        name: (str(f.name, 48) ?? "").trim(),
        type: FIELD_TYPES.includes(f.type as FieldType) ? (f.type as FieldType) : "text",
        required: f.required === true,
        ...(f.type === "ref" && str(f.ref) ? { ref: str(f.ref, 48)! } : {}),
      }))
      .filter((f, i, all) => f.name && !["id", "user_id", "created_at"].includes(f.name) && all.findIndex((x) => x.name === f.name) === i);
    out.push({ name, fields });
  }
  return out;
}

/** Добавить таблицы, которых нет; существующие не трогаем. ref на неизвестные таблицы снимаем. */
export function mergeTables(existing: Table[], incoming: Table[]): Table[] {
  const names = new Set(existing.map((t) => t.name));
  const added = incoming.filter((t) => !names.has(t.name));
  const all = new Set([...names, ...added.map((t) => t.name)]);
  return [
    ...existing,
    ...added.map((t) => ({
      ...t,
      fields: t.fields.map((f) => (f.type === "ref" && (!f.ref || !all.has(f.ref)) ? { name: f.name, type: "number" as const, required: f.required } : f)),
    })),
  ];
}

export type DraftResult = { project: Project; summary: string; focusScreen?: string };

export function applyScreenDraft(p: Project, raw: unknown): DraftResult {
  if (!isObj(raw) || !Array.isArray(raw.elements)) throw new Error("Ответ без списка элементов");
  const tables = mergeTables(p.data?.tables ?? [], parseTables(raw.tables));
  const name = str(raw.name, 80)?.trim() || "Новый экран";
  const r = addScreen({ ...p, data: { tables } }, name);
  let q = r.project;
  const screen = q.screens.find((s) => s.id === r.id)!;
  const size = screenSize(q, screen);
  const els: Element[] = [];
  const tableNames = new Set(tables.map((t) => t.name));
  for (const item of raw.elements.slice(0, 40)) {
    if (!isObj(item) || !(AI_KINDS as readonly string[]).includes(String(item.kind))) continue;
    const kind = item.kind as Kind;
    const pos = placeNew(kind, size, KIND_SPEC[kind], els);
    const el = makeElement(kind, screen.id, pos, els.length, q.theme);
    el.w = pos.w;
    const c = { ...el.content };
    if (str(item.text) !== undefined) c.text = str(item.text)!;
    if (Array.isArray(item.items)) c.items = item.items.filter((x): x is string => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 60));
    if (str(item.placeholder) !== undefined) c.placeholder = str(item.placeholder)!;
    if (Object.keys(c).length) el.content = c;
    if (isObj(item.bind) && tableNames.has(String(item.bind.table))) {
      const mode = ["list", "form", "value", "record"].includes(String(item.bind.mode)) ? (item.bind.mode as BindMode) : "list";
      el.bind = { table: String(item.bind.table), mode, ...(str(item.bind.field) ? { field: str(item.bind.field)! } : {}) };
      if (mode === "form") el.h = Math.max(el.h, 60 + 46 * (tables.find((t) => t.name === el.bind!.table)?.fields.length ?? 1));
    }
    const goTo = str(item.goTo);
    if (goTo === "back") el.action = { back: true };
    else if (goTo) {
      const target = q.screens.find((s) => s.name.toLowerCase() === goTo.toLowerCase() && s.id !== screen.id);
      if (target) el.action = { to: target.id, transition: "slideLeft" };
    }
    els.push(el);
  }
  if (els.length === 0) throw new Error("Модель не вернула ни одного подходящего элемента");
  q = syncArrows({ ...q, elements: [...q.elements, ...els] });
  const added = tables.length - (p.data?.tables.length ?? 0);
  return { project: q, summary: `экран «${name}», элементов: ${els.length}${added ? `, новых таблиц: ${added}` : ""}`, focusScreen: screen.id };
}

export function applySchemaDraft(p: Project, raw: unknown): DraftResult {
  if (!isObj(raw)) throw new Error("Ответ не JSON-объект");
  const incoming = parseTables(raw.tables);
  if (incoming.length === 0) throw new Error("Модель не предложила таблиц");
  const tables = mergeTables(p.data?.tables ?? [], incoming);
  const added = tables.length - (p.data?.tables.length ?? 0);
  if (added === 0) throw new Error("Все предложенные таблицы уже есть");
  return { project: { ...p, data: { tables } }, summary: `Добавлено таблиц: ${added} (${tables.slice(-added).map((t) => t.name).join(", ")})` };
}

/** Меняются только тексты существующих элементов экрана; координаты и стиль не трогаются. */
export function applyTextsDraft(p: Project, raw: unknown, screenId: string): DraftResult {
  if (!isObj(raw) || !Array.isArray(raw.texts)) throw new Error("Ответ без списка texts");
  const allowed = new Map(elementsOf(p, screenId).map((e) => [e.id, e]));
  let changed = 0;
  const patches = new Map<string, Element>();
  for (const t of raw.texts) {
    if (!isObj(t) || typeof t.id !== "string") continue;
    const el = allowed.get(t.id);
    if (!el) continue;
    const c = { ...el.content };
    if (c.text !== undefined && str(t.text, 500) !== undefined) c.text = str(t.text, 500)!;
    if (c.placeholder !== undefined && str(t.placeholder) !== undefined) c.placeholder = str(t.placeholder)!;
    if (c.items && Array.isArray(t.items)) c.items = t.items.filter((x): x is string => typeof x === "string").slice(0, c.items.length + 4);
    if (JSON.stringify(c) !== JSON.stringify(el.content)) {
      patches.set(el.id, { ...el, content: c });
      changed++;
    }
  }
  if (changed === 0) throw new Error("Модель ничего не изменила");
  return { project: { ...p, elements: p.elements.map((e) => patches.get(e.id) ?? e) }, summary: `Изменено текстов: ${changed}` };
}

// ---------- Сеть ----------

export class AiError extends Error {
  constructor(
    message: string,
    public kind: "cors" | "auth" | "http" | "parse",
  ) {
    super(message);
  }
}

export async function chat(s: AiSettings, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${s.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.key}` },
      body: JSON.stringify({ model: s.model, messages, temperature: 0.4, response_format: { type: "json_object" } }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AiError("Запрос не дошёл: вероятно, браузер блокирует CORS. Укажите адрес прокси в настройках ИИ.", "cors");
  }
  if (res.status === 401 || res.status === 403) throw new AiError("Ключ не подходит (401/403)", "auth");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError(`Ошибка ${res.status}: ${body.slice(0, 200)}`, "http");
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new AiError("Пустой ответ модели", "parse");
  return text;
}

export async function listModels(s: AiSettings): Promise<string[]> {
  const res = await fetch(`${s.baseUrl.replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${s.key}` } });
  if (!res.ok) throw new AiError(`Ошибка ${res.status}`, res.status === 401 ? "auth" : "http");
  const data = (await res.json()) as { data?: { id: string; active?: boolean }[] };
  return (data.data ?? [])
    .filter((m) => m.active !== false && !/whisper|tts|guard|playai/i.test(m.id))
    .map((m) => m.id)
    .sort();
}

export const newRequestId = () => uid("ai");
