// Шаблоны новых проектов. Раскладка — те же правила, что и при добавлении элементов (placeNew).
import { DEFAULT_THEME, emptyProject, KIND_SPEC, makeElement } from "./defaults";
import { screenSize } from "./devices";
import type { Action, Binding, Content, Element, Kind, Project, Style, Table } from "./model";
import { addScreen, syncArrows } from "./ops";
import { placeNew } from "./placement";

export type TemplateId = "blank" | "tasks" | "shop" | "booking";

export const TEMPLATES: { id: TemplateId; title: string; description: string }[] = [
  { id: "blank", title: "Пустой проект", description: "Один экран Telegram" },
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
      if (spec.kind === "nav" || spec.kind === "mainButton") el.y = size.h - h - (spec.kind === "mainButton" ? 16 : 0);
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
