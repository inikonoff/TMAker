// Работа с цветом и токены темы приложения (экранов, не редактора).
import type { Color, Theme } from "./model";

export type Rgb = { r: number; g: number; b: number; a: number };

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHex(c: string): boolean {
  return HEX_RE.test(c);
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

const to2 = (v: number) =>
  Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, "0");

export function rgbToHex({ r, g, b, a }: Rgb): string {
  const base = `#${to2(r)}${to2(g)}${to2(b)}`;
  return a >= 1 ? base : base + to2(a * 255);
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
    a: x.a + (y.a - x.a) * t,
  });
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: 1 });
}

/** Относительная яркость по WCAG. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Цвет текста на фоне. Белый, пока контраст ≥ 3 (кнопки — крупный жирный текст), иначе тёмный. */
export function readableOn(bg: string): string {
  return contrast(bg, "#ffffff") >= 3 ? "#ffffff" : "#111318";
}

export const TOKEN_NAMES = [
  "bg",
  "surface",
  "surface2",
  "border",
  "text",
  "textMuted",
  "accent",
  "onAccent",
  "danger",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Tokens = Record<TokenName, string>;

export const TOKEN_LABELS: Record<TokenName, string> = {
  bg: "Фон",
  surface: "Поверхность",
  surface2: "Поверхность 2",
  border: "Граница",
  text: "Текст",
  textMuted: "Текст тихий",
  accent: "Акцент",
  onAccent: "На акценте",
  danger: "Ошибка",
};

export const DARK_LEVEL_MIN = 0;
export const DARK_LEVEL_MAX = 4;

/** Светлота фона тёмной темы: от почти чёрного (0) до светло-серого (4). Плавная функция. */
export function darkBaseLightness(level: number): number {
  const t = Math.max(DARK_LEVEL_MIN, Math.min(DARK_LEVEL_MAX, level)) / DARK_LEVEL_MAX;
  return 5 + t * 27; // 5% … 32%
}

/** Токены темы приложения. darkLevel можно менять дробно — тона меняются плавно. */
export function themeTokens(theme: Theme): Tokens {
  const accent = isHex(theme.accent) ? theme.accent : "#2f80ed";
  if (theme.mode === "light") {
    return {
      bg: "#ffffff",
      surface: "#f4f5f8",
      surface2: "#e8eaf0",
      border: "#d8dbe3",
      text: "#15171c",
      textMuted: "#6b7180",
      accent,
      onAccent: readableOn(accent),
      danger: "#d93a3a",
    };
  }
  const L = darkBaseLightness(theme.darkLevel);
  const hue = 225;
  const sat = 8;
  // Чем светлее фон, тем меньше разница поверхностей и темнее «белый» текст не нужен.
  return {
    bg: hslToHex(hue, sat, L),
    surface: hslToHex(hue, sat, L + 5),
    surface2: hslToHex(hue, sat, L + 10),
    border: hslToHex(hue, sat, L + 17),
    text: hslToHex(hue, 10, L > 26 ? 98 : 94),
    textMuted: hslToHex(hue, 8, Math.min(78, L + 45)),
    accent,
    onAccent: readableOn(accent),
    danger: "#ff6b6b",
  };
}

/** Цвет из модели → CSS. "$accent" берётся из токенов. */
export function resolveColor(c: Color | undefined, tokens: Tokens, fallback = "transparent"): string {
  if (!c) return fallback;
  if (c === "transparent") return c;
  if (c.startsWith("$")) {
    const name = c.slice(1) as TokenName;
    return tokens[name] ?? fallback;
  }
  return c;
}

/** Параметры темы Telegram (themeParams) для имитации клиента. */
export type TelegramThemeParams = {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
  header_bg_color: string;
  section_separator_color: string;
};

export const TELEGRAM_THEMES: Record<"light" | "dark", TelegramThemeParams> = {
  light: {
    bg_color: "#ffffff",
    text_color: "#000000",
    hint_color: "#999999",
    link_color: "#2481cc",
    button_color: "#2481cc",
    button_text_color: "#ffffff",
    secondary_bg_color: "#efeff3",
    header_bg_color: "#ffffff",
    section_separator_color: "#e7e7e7",
  },
  dark: {
    bg_color: "#212121",
    text_color: "#ffffff",
    hint_color: "#aaaaaa",
    link_color: "#8774e1",
    button_color: "#8774e1",
    button_text_color: "#ffffff",
    secondary_bg_color: "#0f0f0f",
    header_bg_color: "#212121",
    section_separator_color: "#2f2f2f",
  },
};

export function telegramTokens(p: TelegramThemeParams): Tokens {
  return {
    bg: p.bg_color,
    surface: p.secondary_bg_color,
    surface2: mix(p.secondary_bg_color, p.text_color, 0.08),
    border: p.section_separator_color,
    text: p.text_color,
    textMuted: p.hint_color,
    accent: p.button_color,
    onAccent: p.button_text_color,
    danger: "#e53935",
  };
}
