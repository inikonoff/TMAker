// Модель проекта. Один проект — один JSON. Всё остальное производно от него.

export const PROJECT_VERSION = 1;

export type DevicePreset = "phone" | "telegram" | "tablet";
export type Device = DevicePreset | { w: number; h: number };

/** Цвет: hex (#rrggbb / #rrggbbaa) или ссылка на токен темы ($accent, $surface …). */
export type Color = string;

export type ThemeMode = "light" | "dark";
export type Theme = {
  mode: ThemeMode;
  /** 0 — почти чёрный, 4 — светло-серый. Учитывается в тёмной теме. */
  darkLevel: number;
  accent: Color;
  /** Скругление по умолчанию для новых элементов. */
  radius: number;
  /** "standard" — кривая, "expressive" — пружины. */
  motion: "standard" | "expressive";
};

export type StrokeStyle = "solid" | "dashed" | "dotted" | "double" | "none";
export type Stroke = { style: StrokeStyle; width: number; color: Color };

export type Style = {
  fill: Color;
  stroke: Stroke;
  radius: number;
  shadow: number; // 0..3
  opacity: number; // 0..1
  textColor: Color;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  align: "left" | "center" | "right";
};

export type ShapeKind = "rect" | "ellipse" | "triangle" | "star" | "polygon";
export type ImageFit = "cover" | "contain" | "icon";

export type Content = {
  text?: string;
  /** "idb:<id>" — картинка в IndexedDB, иначе https/data URL. */
  image?: string;
  imageFit?: ImageFit;
  icon?: string;
  shape?: ShapeKind;
  sides?: number;
  /** Пункты для tabs / list / nav. */
  items?: string[];
  checked?: boolean;
  value?: number;
  placeholder?: string;
};

export type TransitionKind =
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "fade"
  | "expand"
  | "none";

export type Action =
  | { to: string; transition: TransitionKind }
  | { back: true }
  | { open: "link"; url: string };

/**
 * Привязка к данным. list — список записей; form — форма добавления; value — одно значение (поле последней
 * записи или их число); record — поле записи, выбранной на предыдущем экране (нажатие на строку списка,
 * у которого есть действие «перейти на экран», передаёт эту запись).
 */
export type BindMode = "list" | "form" | "value" | "record";
export type Binding = { table: string; mode: BindMode; field?: string };

/** Конец коннектора: привязан к элементу или свободная точка (координаты экрана). */
export type ArrowEnd = { el?: string; x: number; y: number };
export type ArrowData = {
  from: ArrowEnd;
  to: ArrowEnd;
  head: "none" | "end" | "both";
};

export const KINDS = [
  "button",
  "text",
  "image",
  "shape",
  "line",
  "arrow",
  "box",
  "card",
  "input",
  "list",
  "tabs",
  "nav",
  "divider",
  "badge",
  "switch",
  "checkbox",
  "slider",
  "mainButton",
  "backButton",
  "headerBar",
] as const;
export type Kind = (typeof KINDS)[number];

export type Element = {
  id: string;
  screenId: string;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** Группа: элементы с одинаковым group выделяются и двигаются вместе. */
  group?: string;
  locked?: boolean;
  hidden?: boolean;
  name?: string;
  style: Style;
  content?: Content;
  action?: Action;
  bind?: Binding;
  arrow?: ArrowData;
};

export type Swipe = { left?: string; right?: string; up?: string; down?: string };

export type Screen = {
  id: string;
  name: string;
  x: number;
  y: number;
  bg: Color;
  note: string;
  /** Своё устройство экрана; если нет — устройство проекта. */
  device?: Device;
  swipe?: Swipe;
};

export type FieldType = "text" | "number" | "boolean" | "date" | "image" | "ref";
export type Field = { name: string; type: FieldType; required: boolean; ref?: string };
export type Table = { name: string; fields: Field[] };
export type Command = { command: string; description: string };

export type Project = {
  version: number;
  title: string;
  brief: string;
  device: Device;
  theme: Theme;
  screens: Screen[];
  elements: Element[];
  data?: { tables: Table[] };
  bot?: { name: string; commands: Command[] };
};
