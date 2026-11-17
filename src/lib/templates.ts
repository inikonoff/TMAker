// Шаблоны новых проектов. Раскладка — те же правила, что и при добавлении элементов (placeNew).
import { DEFAULT_THEME, emptyProject, KIND_SPEC, makeElement } from "./defaults";
import { screenSize } from "./devices";
import type { Action, Binding, Content, Element, Kind, Project, Style, Table } from "./model";
import { addScreen, syncArrows } from "./ops";
import { placeNew } from "./placement";
import type { SandboxData } from "./sandbox";

export type TemplateId = "blank" | "dailyten" | "tasks" | "shop" | "booking";

export const TEMPLATES: { id: TemplateId; title: string; description: string }[] = [
  { id: "blank", title: "Пустой проект", description: "Один экран Telegram" },
  { id: "dailyten", title: "Пример: Daily Ten", description: "Дневник к боту-репетитору: сессии, разбор, ошибки. Готовый результат инструкции" },
  { id: "tasks", title: "Список задач", description: "Список, карточка задачи, форма добавления, таблица tasks" },
  { id: "shop", title: "Магазин", description: "Каталог, карточка товара, корзина и MainButton" },
  { id: "booking", title: "Запись на приём", description: "Выбор услуги, форма записи, подтверждение" },
];

type Spec = {
  kind: Kind;
  text?: string;
  items?: string[];
  placeholder?: string;
  h?: number;
  style?: Partial<Style>;
  content?: Content;
  action?: Action | { goto: string; transition?: "slideLeft" | "slideUp" | "fade" };
  bind?: Binding;
  /** Для nav/tabs: ключи экранов для пунктов ("" — без перехода). */
  links?: string[];
  value?: number;
};

type ScreenSpec = { key: string; name: string; note?: string; elements: Spec[] };

function build(title: string, brief: string, screens: ScreenSpec[], tables: Table[] = [], bot?: Project["bot"]): Project {
  let p = emptyProject();
  p = { ...p, title, brief, theme: { ...DEFAULT_THEME }, data: { tables }, bot: bot ?? { name: "", commands: [{ command: "start", description: "Открыть приложение" }] } };
  const ids = new Map<string, string>();
  // Первый экран уже есть в пустом проекте.
  p.screens[0] = { ...p.screens[0]!, name: screens[0]!.name, note: screens[0]!.note ?? "" };
  ids.set(screens[0]!.key, p.screens[0]!.id);
  for (const s of screens.slice(1)) {
    const r = addScreen(p, s.name);
    p = { ...r.project, screens: r.project.screens.map((x) => (x.id === r.id ? { ...x, note: s.note ?? "" } : x)) };
    ids.set(s.key, r.id);
  }
  const elements: Element[] = [];
  for (const s of screens) {
    const screen = p.screens.find((x) => x.id === ids.get(s.key))!;
    const size = screenSize(p, screen);
    const placed: Element[] = [];
    for (const spec of s.elements) {
      const h = spec.h ?? KIND_SPEC[spec.kind].h;
      const pos = placeNew(spec.kind, size, { w: KIND_SPEC[spec.kind].w, h }, placed);
      const el = makeElement(spec.kind, screen.id, pos, placed.length, p.theme);
      el.w = pos.w;
      el.h = h;
      if (spec.kind === "nav") el.y = size.h - h;
      if (spec.kind === "mainButton") el.y = pos.y; // placeNew уже учёл навигацию
      // «Назад» — в шапке слева, вне потока.
      if (spec.kind === "backButton") {
        el.x = 4;
        el.y = 8;
      }
      // Текстовые блоки, списки и карточки — во всю ширину с полями.
      if (["text", "list", "card", "divider", "tabs", "image"].includes(spec.kind)) {
        el.x = 16;
        el.w = size.w - 32;
      }
      if (spec.style) el.style = { ...el.style, ...spec.style };
      const c: Content = { ...el.content, ...spec.content };
      if (spec.text !== undefined) c.text = spec.text;
      if (spec.items) c.items = spec.items;
      if (spec.placeholder) c.placeholder = spec.placeholder;
      el.content = c;
      if (spec.bind) el.bind = spec.bind;
      if (spec.value !== undefined) c.value = spec.value;
      if (spec.links) c.links = spec.links.map((k) => (k ? (ids.get(k) ?? "") : ""));
      if (spec.action) {
        el.action =
          "goto" in spec.action ? { to: ids.get(spec.action.goto)!, transition: spec.action.transition ?? "slideLeft" } : spec.action;
      }
      placed.push(el);
    }
    elements.push(...placed);
  }
  return syncArrows({ ...p, elements });
}

const BACK: Spec = { kind: "backButton", action: { back: true } };

export function makeTemplate(id: TemplateId): Project {
  switch (id) {
    case "blank":
      return emptyProject();
    case "dailyten":
      return dailyTen();
    case "tasks":
      return build(
        "Список задач",
        "Личный список дел в Telegram: добавить задачу, отметить выполненной, посмотреть подробности.",
        [
          {
            key: "list",
            name: "Задачи",
            note: "Список задач пользователя, новые сверху. Нажатие на задачу открывает её карточку.",
            elements: [
              { kind: "headerBar", text: "Мои задачи" },
              { kind: "list", h: 360, bind: { table: "tasks", mode: "list", field: "title" }, action: { goto: "detail" } },
              { kind: "mainButton", text: "Новая задача", action: { goto: "add", transition: "slideUp" } },
            ],
          },
          {
            key: "detail",
            name: "Задача",
            note: "Подробности выбранной задачи.",
            elements: [
              { kind: "headerBar", text: "Задача" },
              BACK,
              { kind: "text", h: 32, style: { fontSize: 22, fontWeight: 600 }, bind: { table: "tasks", mode: "record", field: "title" } },
              { kind: "text", h: 60, style: { textColor: "$textMuted" }, bind: { table: "tasks", mode: "record", field: "note" } },
              { kind: "text", h: 24, bind: { table: "tasks", mode: "record", field: "done" } },
            ],
          },
          {
            key: "add",
            name: "Новая задача",
            note: "Форма добавления. После сохранения — назад к списку.",
            elements: [
              { kind: "headerBar", text: "Новая задача" },
              BACK,
              { kind: "card", text: "Что нужно сделать?", h: 240, bind: { table: "tasks", mode: "form" } },
            ],
          },
        ],
        [
          {
            name: "tasks",
            fields: [
              { name: "title", type: "text", required: true },
              { name: "note", type: "text", required: false },
              { name: "done", type: "boolean", required: false },
            ],
          },
        ],
        { name: "", commands: [{ command: "start", description: "Открыть задачи" }] },
      );
    case "shop":
      return build(
        "Магазин",
        "Небольшой магазин в Telegram: каталог, карточка товара, корзина и оформление заказа.",
        [
          {
            key: "catalog",
            name: "Каталог",
            elements: [
              { kind: "headerBar", text: "Магазин" },
              { kind: "tabs", items: ["Все", "Новинки", "Скидки"] },
              { kind: "list", h: 320, bind: { table: "products", mode: "list", field: "name" }, action: { goto: "product" } },
              { kind: "mainButton", text: "Корзина", action: { goto: "cart", transition: "slideUp" } },
            ],
          },
          {
            key: "product",
            name: "Товар",
            elements: [
              { kind: "headerBar", text: "Товар" },
              BACK,
              { kind: "image", h: 220 },
              { kind: "text", h: 30, style: { fontSize: 20, fontWeight: 600 }, bind: { table: "products", mode: "record", field: "name" } },
              { kind: "text", h: 26, style: { textColor: "$accent", fontWeight: 600 }, bind: { table: "products", mode: "record", field: "price" } },
              { kind: "mainButton", text: "В корзину", action: { goto: "cart", transition: "slideUp" } },
            ],
          },
          {
            key: "cart",
            name: "Корзина",
            elements: [
              { kind: "headerBar", text: "Корзина" },
              BACK,
              { kind: "list", h: 200, items: ["Товар 1 — 990 ₽", "Товар 2 — 1 490 ₽"] },
              { kind: "divider" },
              { kind: "text", text: "Итого: 2 480 ₽", style: { fontWeight: 600, align: "right" } },
              { kind: "mainButton", text: "Оформить заказ" },
            ],
          },
        ],
        [
          {
            name: "products",
            fields: [
              { name: "name", type: "text", required: true },
              { name: "price", type: "number", required: true },
              { name: "photo", type: "image", required: false },
            ],
          },
        ],
      );
    case "booking":
      return build(
        "Запись на приём",
        "Запись к специалисту через Telegram: выбрать услугу, оставить контакты, получить подтверждение от бота.",
        [
          {
            key: "services",
            name: "Услуги",
            elements: [
              { kind: "headerBar", text: "Запись" },
              { kind: "text", text: "Выберите услугу", style: { fontSize: 20, fontWeight: 600 } },
              { kind: "list", h: 200, items: ["Консультация — 30 мин", "Стрижка — 60 мин", "Окрашивание — 120 мин"], action: { goto: "form" } },
            ],
          },
          {
            key: "form",
            name: "Форма записи",
            elements: [
              { kind: "headerBar", text: "Ваши данные" },
              BACK,
              { kind: "card", text: "Когда вам удобно?", h: 280, bind: { table: "bookings", mode: "form" } },
              { kind: "button", text: "Готово", action: { goto: "done", transition: "fade" } },
            ],
          },
          {
            key: "done",
            name: "Готово",
            elements: [
              { kind: "headerBar", text: "Готово" },
              { kind: "text", text: "Вы записаны! Бот пришлёт напоминание.", h: 60, style: { align: "center", fontSize: 18 } },
              { kind: "button", text: "На главную", action: { goto: "services", transition: "fade" } },
            ],
          },
        ],
        [
          {
            name: "bookings",
            fields: [
              { name: "name", type: "text", required: true },
              { name: "phone", type: "text", required: true },
              { name: "date", type: "date", required: true },
            ],
          },
        ],
        { name: "", commands: [{ command: "start", description: "Записаться" }, { command: "my", description: "Мои записи" }] },
      );
  }
}

/**
 * Пример из инструкции: мини-приложение к боту Daily Ten (github.com/inikonoff/Daily-Ten) —
 * ежедневная десятка реплик с Mrs. Smith и Session Summary. Приложение — дневник прогресса.
 */
function dailyTen(): Project {
  const NAV = ["Сегодня", "Сессии", "Ошибки"];
  const muted: Partial<Style> = { textColor: "$textMuted", fontSize: 13 };
  const h2: Partial<Style> = { fontSize: 15, fontWeight: 600 };
  const p = build(
    "Daily Ten",
    "Мини-приложение к Telegram-боту Daily Ten: каждый день 10 реплик с учительницей Mrs. Smith, потом Session Summary. " +
      "Приложение — дневник прогресса: сколько сессий пройдено, разбор каждой сессии, ошибки, которые стоит повторить. " +
      "Сам разговор остаётся в чате бота.",
    [
      {
        key: "home",
        name: "Сегодня",
        note: "Главный экран. MainButton «Начать десятку» вызывает POST /api/ten (бот начинает новую десятку и присылает первую реплику в чат), затем Telegram.WebApp.close().",
        elements: [
          { kind: "headerBar", text: "Daily Ten" },
          { kind: "text", text: "Hi! Ready for today's ten?", h: 34, style: { fontSize: 22, fontWeight: 700 } },
          { kind: "text", text: "Десять реплик с Mrs. Smith — и разбор вашего английского.", h: 44, style: { textColor: "$textMuted" } },
          { kind: "card", text: "Сессий пройдено", h: 96 },
          { kind: "badge", h: 28, bind: { table: "sessions", mode: "value" }, style: { fontSize: 15 } },
          { kind: "nav", items: NAV, value: 0, links: ["", "sessions", "mistakes"] },
          { kind: "mainButton", text: "Начать десятку" },
        ],
      },
      {
        key: "sessions",
        name: "Сессии",
        note: "Все прошлые сессии, новые сверху. Нажатие открывает Session Summary этой сессии.",
        elements: [
          { kind: "headerBar", text: "Мои сессии" },
          { kind: "list", h: 420, bind: { table: "sessions", mode: "list", field: "date" }, action: { goto: "summary" } },
          { kind: "nav", items: NAV, value: 1, links: ["home", "", "mistakes"] },
        ],
      },
      {
        key: "summary",
        name: "Разбор сессии",
        note: "Session Summary выбранной сессии: лучший момент, уровень, на чём сосредоточиться.",
        elements: [
          { kind: "headerBar", text: "Session Summary" },
          { kind: "backButton", action: { back: true } },
          { kind: "text", h: 20, style: muted, bind: { table: "sessions", mode: "record", field: "date" } },
          { kind: "text", text: "⭐ Best moment", h: 22, style: h2 },
          { kind: "text", h: 60, bind: { table: "sessions", mode: "record", field: "best_moment" } },
          { kind: "text", text: "📈 Level", h: 22, style: h2 },
          { kind: "text", h: 24, bind: { table: "sessions", mode: "record", field: "level_cefr" } },
          { kind: "text", text: "🎯 Next time", h: 22, style: h2 },
          { kind: "text", h: 60, bind: { table: "sessions", mode: "record", field: "focus" } },
        ],
      },
      {
        key: "mistakes",
        name: "Ошибки",
        note: "Ошибки из всех Session Summary: как было и как правильно. Нажатие открывает объяснение.",
        elements: [
          { kind: "headerBar", text: "Worth a second look" },
          { kind: "list", h: 420, bind: { table: "mistakes", mode: "list", field: "was" }, action: { goto: "mistake" } },
          { kind: "nav", items: NAV, value: 2, links: ["home", "sessions", ""] },
        ],
      },
      {
        key: "mistake",
        name: "Ошибка",
        elements: [
          { kind: "headerBar", text: "Ошибка" },
          { kind: "backButton", action: { back: true } },
          { kind: "text", text: "Было", h: 20, style: muted },
          { kind: "text", h: 30, style: { fontSize: 17, textColor: "$danger" }, bind: { table: "mistakes", mode: "record", field: "was" } },
          { kind: "text", text: "Правильно", h: 20, style: muted },
          { kind: "text", h: 30, style: { fontSize: 17, fontWeight: 600 }, bind: { table: "mistakes", mode: "record", field: "correct" } },
          { kind: "text", text: "Почему", h: 20, style: muted },
          { kind: "text", h: 80, bind: { table: "mistakes", mode: "record", field: "why" } },
        ],
      },
    ],
    [
      {
        name: "sessions",
        fields: [
          { name: "date", type: "date", required: true },
          { name: "best_moment", type: "text", required: false },
          { name: "level_cefr", type: "text", required: false },
          { name: "focus", type: "text", required: false },
        ],
      },
      {
        name: "mistakes",
        fields: [
          { name: "was", type: "text", required: true },
          { name: "correct", type: "text", required: true },
          { name: "why", type: "text", required: false },
          { name: "category", type: "text", required: false },
        ],
      },
    ],
    {
      name: "",
      commands: [
        { command: "ten", description: "Start today's ten" },
        { command: "summary", description: "My last Session Summary" },
        { command: "finish", description: "Wrap up the session" },
        { command: "start", description: "Where are we? (status)" },
      ],
    },
  );
  // Тёплый акцент и счётчик сессий внутри карточки.
  const theme = { ...p.theme, accent: "#e8743b" };
  const card = p.elements.find((e) => e.kind === "card")!;
  const elements = p.elements.map((e) =>
    e.kind === "badge" ? { ...e, x: card.x + 16, y: card.y + card.h - 28 - 16, w: 84, z: card.z + 1 } : e,
  );
  return { ...p, theme, elements };
}

/** Примерные записи для песочницы режима «Запустить» (в настоящем приложении данные придут из базы бота). */
export function templateSample(id: TemplateId): SandboxData {
  const rows = (table: string, list: Record<string, string | null>[]) =>
    list.map((r, i) => ({ ...r, _id: `${table}_${i + 1}`, _at: i + 1 }));
  if (id === "dailyten") {
    return {
      sessions: rows("sessions", [
        { date: "2026-11-15", best_moment: "You told the story about your trip to Minsk very naturally.", level_cefr: "B1", focus: "Past Simple vs Present Perfect" },
        { date: "2026-11-16", best_moment: "Great use of “I'd rather…” when talking about weekends.", level_cefr: "B1+", focus: "Articles with countable nouns" },
      ]),
      mistakes: rows("mistakes", [
        { was: "I have been there yesterday", correct: "I was there yesterday", why: "With a finished time (yesterday) use Past Simple.", category: "grammar" },
        { was: "She is good in cooking", correct: "She is good at cooking", why: "“Good at” + activity.", category: "prepositions" },
      ]),
    };
  }
  if (id === "tasks") {
    return { tasks: rows("tasks", [{ title: "Купить хлеб", note: "Бородинский", done: null }]) };
  }
  return {};
}
