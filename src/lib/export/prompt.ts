// PROMPT.md: человекочитаемое описание проекта для языковой модели.
import { KIND_SPEC } from "../defaults";
import { deviceLabel, deviceSize, screenDevice } from "../devices";
import { themeTokens, TOKEN_NAMES } from "../color";
import { flowEdges } from "../flow";
import type { Element, Project, Screen } from "../model";
import { elementsOf } from "../ops";
import { TRANSITION_LABELS } from "../transitions";

export function slug(s: string, fallback = "screen"): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  const out = [...s.toLowerCase()]
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return out || fallback;
}

/** Уникальные имена файлов экранов: 01-glavnaya, 02-profil … */
export function screenSlugs(p: Project): Map<string, string> {
  const m = new Map<string, string>();
  p.screens.forEach((s, i) => m.set(s.id, `${String(i + 1).padStart(2, "0")}-${slug(s.name)}`));
  return m;
}

function color(c: string): string {
  return c.startsWith("$") ? `токен ${c.slice(1)}` : c === "transparent" ? "нет" : c;
}

function describeElement(e: Element, p: Project): string {
  const parts: string[] = [];
  const label = e.name ? `${KIND_SPEC[e.kind].label} «${e.name}»` : KIND_SPEC[e.kind].label;
  parts.push(`**${label}** (\`${e.kind}\`) x=${Math.round(e.x)} y=${Math.round(e.y)} ${Math.round(e.w)}×${Math.round(e.h)}`);
  const c = e.content;
  if (c?.text) parts.push(`текст «${c.text.replace(/\n/g, " / ")}»`);
  if (c?.placeholder) parts.push(`подсказка «${c.placeholder}»`);
  if (c?.items?.length) parts.push(`пункты: ${c.items.map((i) => `«${i}»`).join(", ")}`);
  if (c?.shape) parts.push(`фигура ${c.shape}${c.shape === "polygon" ? ` (${c.sides} углов)` : ""}`);
  if (c?.image) parts.push(`картинка ${c.image.startsWith("idb:") ? "(файл в images/)" : c.image} [${c.imageFit ?? "cover"}]`);
  if (c?.checked !== undefined && (e.kind === "switch" || e.kind === "checkbox")) parts.push(c.checked ? "включён" : "выключен");
  const s = e.style;
  const style: string[] = [];
  if (s.fill !== "transparent" && e.kind !== "line" && e.kind !== "arrow") style.push(`заливка ${color(s.fill)}`);
  if (s.stroke.style !== "none") style.push(`рамка ${s.stroke.style} ${s.stroke.width}px ${color(s.stroke.color)}`);
  if (s.radius) style.push(`скругление ${s.radius}`);
  if (s.shadow) style.push(`тень ${s.shadow}`);
  if (s.opacity < 1) style.push(`прозрачность ${s.opacity}`);
  if (style.length) parts.push(style.join(", "));
  if (e.arrow) {
    const end = (x: { el?: string }) => {
      const t = x.el && p.elements.find((o) => o.id === x.el);
      return t ? `«${t.content?.text || t.name || KIND_SPEC[t.kind].label}»` : "точка";
    };
    parts.push(`соединяет ${end(e.arrow.from)} → ${end(e.arrow.to)}`);
  }
  const a = e.action;
  if (a) {
    if ("to" in a) parts.push(`**нажатие → экран «${p.screens.find((s) => s.id === a.to)?.name ?? "?"}»** (${TRANSITION_LABELS[a.transition]})`);
    else if ("back" in a) parts.push("**нажатие → назад**");
    else parts.push(`**нажатие → ссылка ${a.url}**`);
  }
  if (e.bind) parts.push(`данные: таблица \`${e.bind.table}\`, режим ${e.bind.mode}${e.bind.field ? `, поле \`${e.bind.field}\`` : ""}`);
  if (e.hidden) parts.push("(скрыт)");
  return "- " + parts.join("; ");
}

function describeScreen(s: Screen, p: Project, index: number, slugs: Map<string, string>): string {
  const dev = screenDevice(p, s);
  const { w, h } = deviceSize(dev);
  const lines = [`### ${index + 1}. ${s.name}`, "", `Устройство: ${deviceLabel(dev)} (${w}×${h}). Фон: ${color(s.bg)}. Скриншот: \`screens/${slugs.get(s.id)}.png\`.`];
  if (s.note.trim()) lines.push("", `> ${s.note.trim().replace(/\n/g, "\n> ")}`);
  if (s.swipe) {
    const names = Object.entries(s.swipe).map(([d, to]) => `${d} → «${p.screens.find((x) => x.id === to)?.name}»`);
    lines.push("", `Свайпы: ${names.join(", ")}.`);
  }
  const els = elementsOf(p, s.id);
  lines.push("", els.length ? "Элементы (снизу вверх по слоям):" : "Элементов нет.");
  for (const e of els) lines.push(describeElement(e, p));
  return lines.join("\n");
}

export function buildPrompt(p: Project): string {
  const slugs = screenSlugs(p);
  const tokens = themeTokens(p.theme);
  const out: string[] = [];
  out.push(`# ${p.title}`, "");
  out.push("Telegram Mini App, нарисованное в TMA Builder. Исходник — `project.json` (он главнее этого текста).", "");
  if (p.brief.trim()) out.push("## Задача", "", p.brief.trim(), "");
  out.push("## Тема", "");
  out.push(
    `Режим: ${p.theme.mode === "dark" ? `тёмная (уровень серого ${p.theme.darkLevel.toFixed(2)} из 4)` : "светлая"}. Акцент ${p.theme.accent}. Скругление по умолчанию ${p.theme.radius}px. Движение: ${p.theme.motion === "expressive" ? "пружины" : "спокойные кривые"}.`,
    "",
    "Токены (цвета вида `$name` в project.json ссылаются на них). В Telegram используйте `themeParams`, токены — запасные значения:",
    "",
    "| токен | цвет |",
    "|---|---|",
    ...TOKEN_NAMES.map((t) => `| ${t} | ${tokens[t]} |`),
    "",
  );
  out.push("## Экраны", "");
  p.screens.forEach((s, i) => out.push(describeScreen(s, p, i, slugs), ""));
  const edges = flowEdges(p);
  out.push("## Переходы", "");
  if (edges.length === 0) out.push("Переходов пока нет.", "");
  for (const e of edges) {
    const from = p.screens.find((s) => s.id === e.from)?.name;
    const to = p.screens.find((s) => s.id === e.to)?.name;
    out.push(`- «${from}» → «${to}»: ${e.kind === "swipe" ? e.label : `нажатие на «${e.label}»`} (${TRANSITION_LABELS[e.transition]})`);
  }
  out.push("");
  const tables = p.data?.tables ?? [];
  if (tables.length) {
    out.push("## Данные", "");
    for (const t of tables) {
      out.push(`### Таблица \`${t.name}\``, "", "| поле | тип | обязательное |", "|---|---|---|");
      for (const f of t.fields) out.push(`| ${f.name} | ${f.type}${f.ref ? ` → ${f.ref}` : ""} | ${f.required ? "да" : "нет"} |`);
      out.push("");
    }
  }
  if (p.bot && (p.bot.name || p.bot.commands.length)) {
    out.push("## Бот", "");
    if (p.bot.name) out.push(`Имя: @${p.bot.name.replace(/^@/, "")}`);
    for (const c of p.bot.commands) out.push(`- /${c.command} — ${c.description}`);
    out.push("", "Токен бота в проект не входит: он задаётся в `.env` (`BOT_TOKEN`).", "");
  }
  return out.join("\n");
}
