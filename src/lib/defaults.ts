// Значения по умолчанию: новый проект, экран, элементы каждого вида.
import { uid } from "./ids";
import type { Content, Element, Kind, Project, Screen, Stroke, Style, Theme } from "./model";
import { PROJECT_VERSION } from "./model";

export const DEFAULT_THEME: Theme = {
  mode: "light",
  darkLevel: 1,
  accent: "#2f80ed",
  radius: 12,
  motion: "standard",
};

export const NO_STROKE: Stroke = { style: "none", width: 1, color: "$border" };

export const BASE_STYLE: Style = {
  fill: "transparent",
  stroke: NO_STROKE,
  radius: 0,
  shadow: 0,
  opacity: 1,
  textColor: "$text",
  fontSize: 15,
  fontWeight: 400,
  align: "left",
};

type KindSpec = {
  label: string;
  group: "basic" | "draw" | "form" | "layout" | "telegram";
  w: number;
  h: number;
  style?: Partial<Style>;
  content?: Content;
};

export const KIND_SPEC: Record<Kind, KindSpec> = {
  button: {
    label: "Кнопка",
    group: "basic",
    w: 160,
    h: 44,
    style: { fill: "$accent", textColor: "$onAccent", radius: 12, fontWeight: 600, align: "center" },
    content: { text: "Кнопка" },
  },
  text: { label: "Текст", group: "basic", w: 200, h: 24, content: { text: "Текст" } },
  image: {
    label: "Картинка",
    group: "basic",
    w: 160,
    h: 120,
    style: { fill: "$surface2", radius: 12 },
    content: { imageFit: "cover" },
  },
  shape: {
    label: "Фигура",
    group: "draw",
    w: 100,
    h: 100,
    style: { fill: "$surface2", stroke: { style: "solid", width: 2, color: "$border" } },
    content: { shape: "rect", sides: 6 },
  },
  line: {
    label: "Линия",
    group: "draw",
    w: 160,
    h: 0,
    style: { stroke: { style: "solid", width: 2, color: "$text" } },
  },
  arrow: {
    label: "Стрелка",
    group: "draw",
    w: 160,
    h: 0,
    style: { stroke: { style: "solid", width: 2, color: "$text" } },
  },
  box: {
    label: "Блок",
    group: "layout",
    w: 200,
    h: 120,
    style: { fill: "$surface", radius: 12 },
  },
  card: {
    label: "Карточка",
    group: "layout",
    w: 300,
    h: 140,
    style: { fill: "$bg", radius: 16, shadow: 1, stroke: { style: "solid", width: 1, color: "$border" } },
    content: { text: "Заголовок карточки" },
  },
  input: {
    label: "Поле ввода",
    group: "form",
    w: 300,
    h: 44,
    style: { fill: "$surface", radius: 10, stroke: { style: "solid", width: 1, color: "$border" } },
    content: { placeholder: "Введите текст" },
  },
  list: {
    label: "Список",
    group: "layout",
    w: 320,
    h: 168,
    style: { fill: "$bg", radius: 12 },
    content: { items: ["Первый пункт", "Второй пункт", "Третий пункт"] },
  },
  tabs: {
    label: "Вкладки",
    group: "layout",
    w: 320,
    h: 40,
    style: { fill: "$surface", radius: 10, fontWeight: 500, align: "center" },
    content: { items: ["Все", "Новые", "Мои"], value: 0 },
  },
  nav: {
    label: "Навигация",
    group: "layout",
    w: 390,
    h: 64,
    style: { fill: "$bg", stroke: { style: "solid", width: 1, color: "$border" }, fontSize: 12, align: "center" },
    content: { items: ["Главная", "Поиск", "Профиль"], value: 0 },
  },
  divider: {
    label: "Разделитель",
    group: "layout",
    w: 320,
    h: 1,
    style: { fill: "$border" },
  },
  badge: {
    label: "Бейдж",
    group: "basic",
    w: 56,
    h: 24,
    style: { fill: "$accent", textColor: "$onAccent", radius: 12, fontSize: 12, fontWeight: 600, align: "center" },
    content: { text: "Новое" },
  },
  switch: { label: "Переключатель", group: "form", w: 52, h: 32, content: { checked: true } },
  checkbox: {
    label: "Флажок",
    group: "form",
    w: 180,
    h: 24,
    content: { checked: true, text: "Согласен" },
  },
  slider: { label: "Ползунок", group: "form", w: 240, h: 24, content: { value: 0.4 } },
  mainButton: {
    label: "MainButton",
    group: "telegram",
    w: 358,
    h: 50,
    style: { fill: "$accent", textColor: "$onAccent", radius: 12, fontWeight: 600, align: "center" },
    content: { text: "Продолжить" },
  },
  backButton: {
    label: "BackButton",
    group: "telegram",
    w: 40,
    h: 40,
    style: { textColor: "$accent", fontSize: 22, align: "center" },
    content: { text: "‹" },
  },
  headerBar: {
    label: "Шапка",
    group: "telegram",
    w: 390,
    h: 56,
    style: { fill: "$bg", fontSize: 17, fontWeight: 600, align: "center" },
    content: { text: "Заголовок" },
  },
};

export const KIND_GROUPS: { id: KindSpec["group"]; label: string }[] = [
  { id: "basic", label: "Основное" },
  { id: "layout", label: "Раскладка" },
  { id: "form", label: "Формы" },
  { id: "draw", label: "Рисование" },
  { id: "telegram", label: "Telegram" },
];

export function makeStyle(kind: Kind, theme: Theme = DEFAULT_THEME): Style {
  const spec = KIND_SPEC[kind].style ?? {};
  const style: Style = { ...BASE_STYLE, ...spec, stroke: { ...(spec.stroke ?? NO_STROKE) } };
  // Скругление по умолчанию берётся из темы, если у вида оно есть.
  if (spec.radius !== undefined && spec.radius > 0 && kind !== "badge") style.radius = theme.radius;
  return style;
}

export function makeElement(
  kind: Kind,
  screenId: string,
  at: { x: number; y: number },
  z: number,
  theme: Theme = DEFAULT_THEME,
): Element {
  const spec = KIND_SPEC[kind];
  const el: Element = {
    id: uid("el"),
    screenId,
    kind,
    x: Math.round(at.x),
    y: Math.round(at.y),
    w: spec.w,
    h: spec.h,
    z,
    style: makeStyle(kind, theme),
  };
  if (spec.content) el.content = structuredClone(spec.content);
  if (kind === "line" || kind === "arrow") {
    el.arrow = {
      from: { x: el.x, y: el.y },
      to: { x: el.x + spec.w, y: el.y },
      head: kind === "arrow" ? "end" : "none",
    };
  }
  return el;
}

export function makeScreen(name: string, x: number, y: number): Screen {
  return { id: uid("scr"), name, x, y, bg: "$bg", note: "" };
}

export function emptyProject(): Project {
  const s1 = makeScreen("Главная", 0, 0);
  return {
    version: PROJECT_VERSION,
    title: "Новый проект",
    brief: "",
    device: "telegram",
    theme: { ...DEFAULT_THEME },
    screens: [s1],
    elements: [],
    data: { tables: [] },
    bot: { name: "", commands: [] },
  };
}
