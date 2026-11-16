// Шаблоны app/: Vite + React + TS, экраны рендерятся из project.json, Telegram WebApp SDK.
import { telegramTokens, TELEGRAM_THEMES, themeTokens } from "../color";
import type { Project } from "../model";

const PKG = JSON.stringify(
  {
    name: "app",
    private: true,
    type: "module",
    scripts: { dev: "vite", build: "tsc -p tsconfig.json --noEmit && vite build", preview: "vite preview", typecheck: "tsc -p tsconfig.json --noEmit" },
    dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
    devDependencies: { "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0", "@vitejs/plugin-react": "^6.0.0", typescript: "~5.9.0", vite: "^8.0.0" },
  },
  null,
  2,
);

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2023", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      isolatedModules: true,
      types: ["vite/client"],
    },
    include: ["src", "vite.config.ts"],
  },
  null,
  2,
);

const VITE = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Картинки проекта лежат в ../assets/images и отдаются как /images/…
  publicDir: "../assets",
  server: { fs: { allow: [".."] }, proxy: { "/api": "http://localhost:3000" } },
});
`;

const HTML = (title: string) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title.replace(/</g, "&lt;")}</title>
    <!-- Официальный SDK Telegram Mini Apps -->
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const TYPES = `// Типы project.json (см. AGENTS.md).
export type Stroke = { style: "solid" | "dashed" | "dotted" | "double" | "none"; width: number; color: string };
export type Style = {
  fill: string; stroke: Stroke; radius: number; shadow: number; opacity: number;
  textColor: string; fontSize: number; fontWeight: number; align: "left" | "center" | "right";
};
export type Action = { to: string; transition: string } | { back: true } | { open: "link"; url: string };
export type El = {
  id: string; screenId: string; kind: string; x: number; y: number; w: number; h: number; z: number;
  hidden?: boolean; style: Style; action?: Action;
  content?: { text?: string; image?: string; imageFit?: string; items?: string[]; checked?: boolean; value?: number; placeholder?: string; shape?: string };
  bind?: { table: string; mode: "list" | "form" | "value"; field?: string };
  arrow?: { from: { x: number; y: number }; to: { x: number; y: number }; head: string };
};
export type Screen = { id: string; name: string; bg: string; device?: unknown; swipe?: Record<string, string> };
export type Field = { name: string; type: string; required: boolean };
export type Project = {
  title: string; device: unknown; theme: { mode: "light" | "dark"; motion: string };
  screens: Screen[]; elements: El[]; data?: { tables: { name: string; fields: Field[] }[] };
};

type TgButton = { setText(t: string): void; show(): void; hide(): void; onClick(f: () => void): void; offClick(f: () => void): void };
export type TgWebApp = {
  initData: string; colorScheme: "light" | "dark"; themeParams: Record<string, string | undefined>;
  ready(): void; expand(): void; openLink(url: string): void;
  MainButton: TgButton; BackButton: Omit<TgButton, "setText">;
  onEvent(e: "themeChanged", f: () => void): void;
  HapticFeedback?: { impactOccurred(s: "light" | "medium"): void };
};
declare global {
  interface Window { Telegram?: { WebApp?: TgWebApp } }
}
`;

const API = `// Запросы к серверу. Каждый запрос несёт initData — сервер проверяет подпись.
const tg = () => window.Telegram?.WebApp;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(\`/api/\${path}\`, {
    method,
    headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": tg()?.initData ?? "" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? \`Ошибка \${res.status}\`);
  return data as T;
}

export type Row = Record<string, unknown> & { id: number };
export const listRows = (table: string) => call<Row[]>("GET", encodeURIComponent(table));
export const addRow = (table: string, values: Record<string, unknown>) => call<Row>("POST", encodeURIComponent(table), values);
`;

const MAIN = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

window.Telegram?.WebApp?.ready();
window.Telegram?.WebApp?.expand();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const STYLES = `* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
body { font: 15px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; overflow: hidden; -webkit-font-smoothing: antialiased; }
.stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
.screen { position: absolute; left: 0; top: 0; transform-origin: 0 0; overflow: hidden; }
.el { position: absolute; display: flex; align-items: center; overflow: hidden; white-space: pre-wrap; }
.el.tap { cursor: pointer; }
.el.tap:active { filter: brightness(0.94); }
.form { flex-direction: column; align-items: stretch; gap: 8px; padding: 8px; }
.form input { height: 36px; border-radius: 10px; border: 1px solid rgba(127,127,127,.35); padding: 0 10px; font: inherit; background: transparent; color: inherit; }
.form button { height: 38px; border: 0; border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer; }
.err { color: #e53935; font-size: 12px; }
@keyframes in-slideLeft { from { transform: translateX(100%); } }
@keyframes in-slideRight { from { transform: translateX(-100%); } }
@keyframes in-slideUp { from { transform: translateY(100%); } }
@keyframes in-slideDown { from { transform: translateY(-100%); } }
@keyframes in-fade { from { opacity: 0; } }
@keyframes in-expand { from { opacity: 0; transform: scale(.86); } }
.anim { animation-duration: 420ms; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); animation-fill-mode: both; }
@media (prefers-reduced-motion: reduce) { .anim { animation-name: in-fade !important; animation-duration: 120ms; } }
`;

const APP = `// Экраны из project.json. Позиции как в макете, масштаб — по ширине окна.
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import projectJson from "../../project.json";
import { addRow, listRows } from "./api";
import type { Row } from "./api";
import { tokensFor } from "./theme";
import type { El, Project } from "./types";

const project = projectJson as unknown as Project;
const SIZES: Record<string, { w: number; h: number }> = { phone: { w: 390, h: 844 }, telegram: { w: 390, h: 780 }, tablet: { w: 820, h: 1180 } };
const sizeOf = (d: unknown) => (typeof d === "string" ? SIZES[d] ?? SIZES.telegram : (d as { w: number; h: number }));
const SHADOWS = ["none", "0 1px 3px rgba(0,0,0,.1)", "0 4px 12px rgba(0,0,0,.12)", "0 12px 32px rgba(0,0,0,.18)"];
const tg = window.Telegram?.WebApp;
const inTelegram = !!tg?.initData;
const img = (src?: string) => (src?.startsWith("assets/") ? "/" + src.slice("assets/".length) : src);

function useTokens() {
  const [n, setN] = useState(0);
  useEffect(() => tg?.onEvent("themeChanged", () => setN((x) => x + 1)), []);
  return useMemo(() => tokensFor(tg, project.theme.mode), [n]);
}

function Form({ el, onSaved }: { el: El; onSaved: () => void }) {
  const table = project.data?.tables.find((t) => t.name === el.bind!.table);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState("");
  if (!table) return null;
  return (
    <form
      className="el form"
      style={{ left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z }}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await addRow(table.name, values);
          setValues({});
          setErr("");
          tg?.HapticFeedback?.impactOccurred("light");
          onSaved();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      {table.fields.map((f) =>
        f.type === "boolean" ? (
          <label key={f.name}>
            <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} /> {f.name}
          </label>
        ) : (
          <input key={f.name} placeholder={f.name + (f.required ? " *" : "")} value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
        ),
      )}
      {err && <div className="err">{err}</div>}
      <button type="submit" style={{ background: "var(--accent)", color: "var(--onAccent)" }}>{el.content?.text || "Добавить"}</button>
    </form>
  );
}

export function App() {
  const t = useTokens();
  const color = (c?: string) => (!c ? "transparent" : c.startsWith("$") ? t[c.slice(1)] ?? "transparent" : c);
  const [stack, setStack] = useState<{ id: string; via: string }[]>([{ id: project.screens[0]!.id, via: "none" }]);
  const [anim, setAnim] = useState("none");
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const [width, setWidth] = useState(window.innerWidth);
  const cur = stack[stack.length - 1]!;
  const screen = project.screens.find((s) => s.id === cur.id)!;
  const size = sizeOf((screen.device as unknown) ?? project.device);
  const scale = width / size.w;
  const els = project.elements.filter((e) => e.screenId === screen.id && !e.hidden).sort((a, b) => a.z - b.z);

  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const tables = [...new Set(els.filter((e) => e.bind && e.bind.mode !== "form").map((e) => e.bind!.table))];
  const reload = () => tables.forEach((name) => listRows(name).then((r) => setRows((s) => ({ ...s, [name]: r })), () => {}));
  useEffect(reload, [cur.id]);

  const go = (to: string, via: string) => {
    setAnim(via);
    setStack((s) => [...s, { id: to, via }]);
  };
  // «Назад» — зеркальный переход.
  const MIRROR: Record<string, string> = { slideLeft: "slideRight", slideRight: "slideLeft", none: "none" };
  const back = () => {
    if (stack.length < 2) return;
    setAnim(MIRROR[stack[stack.length - 1]!.via] ?? "fade");
    setStack((s) => s.slice(0, -1));
  };
  const act = (e: El) => {
    const a = e.action;
    if (!a) return e.kind === "backButton" ? back() : undefined;
    if ("back" in a) return back();
    if ("open" in a) return tg ? tg.openLink(a.url) : window.open(a.url, "_blank");
    go(a.to, a.transition);
  };

  // Нативные кнопки Telegram вместо нарисованных.
  const main = els.find((e) => e.kind === "mainButton");
  useEffect(() => {
    if (!inTelegram || !tg) return;
    const onBack = () => back();
    if (stack.length > 1) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.BackButton.onClick(onBack);
    const onMain = () => main && act(main);
    if (main) {
      tg.MainButton.setText(main.content?.text ?? "OK");
      tg.MainButton.show();
      tg.MainButton.onClick(onMain);
    } else tg.MainButton.hide();
    return () => {
      tg.BackButton.offClick(onBack);
      tg.MainButton.offClick(onMain);
    };
  });

  const vars = Object.fromEntries(Object.entries(t).map(([k, v]) => [\`--\${k}\`, v])) as CSSProperties;
  const field = (e: El, r: Row) => {
    const table = project.data?.tables.find((x) => x.name === e.bind!.table);
    const f = e.bind!.field ?? table?.fields.find((x) => x.type === "text")?.name ?? table?.fields[0]?.name;
    return String(f ? r[f] ?? "—" : r.id);
  };

  const render = (e: El) => {
    if (inTelegram && (e.kind === "mainButton" || e.kind === "backButton")) return null;
    if (e.bind?.mode === "form") return <Form key={e.id} el={e} onSaved={reload} />;
    const s = e.style;
    const css: CSSProperties = {
      left: e.x, top: e.y, width: e.w, height: e.h, zIndex: e.z,
      background: e.kind === "line" || e.kind === "arrow" ? undefined : color(s.fill),
      borderRadius: s.radius, boxShadow: SHADOWS[s.shadow], opacity: s.opacity,
      color: color(s.textColor), fontSize: s.fontSize, fontWeight: s.fontWeight,
      justifyContent: s.align === "center" ? "center" : s.align === "right" ? "flex-end" : "flex-start",
      padding: ["text", "list", "tabs", "nav", "image", "divider", "switch", "slider", "line", "arrow"].includes(e.kind) ? 0 : "0 12px",
      border: s.stroke.style !== "none" && e.kind !== "line" && e.kind !== "arrow" ? \`\${s.stroke.width}px \${s.stroke.style} \${color(s.stroke.color)}\` : undefined,
    };
    const c = e.content ?? {};
    let inner: React.ReactNode = c.text;
    if (e.kind === "image" && c.image) inner = <img src={img(c.image)} alt="" style={{ width: "100%", height: "100%", objectFit: c.imageFit === "contain" ? "contain" : "cover" }} />;
    if (e.kind === "input") inner = <input placeholder={c.placeholder} style={{ border: 0, background: "transparent", font: "inherit", color: "inherit", width: "100%", outline: 0 }} />;
    if (e.kind === "list" || e.kind === "tabs" || e.kind === "nav") {
      const items = e.bind?.mode === "list" ? (rows[e.bind.table] ?? []).map((r) => field(e, r)) : c.items ?? [];
      css.flexDirection = e.kind === "list" ? "column" : "row";
      css.alignItems = "stretch";
      inner = items.map((it, i) => (
        <div key={i} style={{ flex: e.kind === "list" ? "0 0 48px" : 1, display: "flex", alignItems: "center", justifyContent: e.kind === "list" ? "flex-start" : "center", padding: "0 16px", borderBottom: e.kind === "list" ? \`1px solid \${t.border}\` : undefined, color: e.kind !== "list" && i === (c.value ?? 0) ? t.accent : undefined }}>{it}</div>
      ));
    }
    if (e.bind?.mode === "value") inner = e.bind.field ? (rows[e.bind.table]?.[0] ? field(e, rows[e.bind.table]![0]!) : "—") : String(rows[e.bind.table]?.length ?? 0);
    if (e.kind === "switch" || e.kind === "checkbox") inner = <input type="checkbox" defaultChecked={c.checked} style={{ accentColor: t.accent }} />;
    if (e.kind === "slider") inner = <input type="range" min={0} max={1} step={0.01} defaultValue={c.value ?? 0} style={{ width: "100%", accentColor: t.accent }} />;
    if ((e.kind === "button" || e.kind === "card" || e.kind === "box") && c.image && c.imageFit !== "icon") {
      css.backgroundImage = \`url(\${img(c.image)})\`;
      css.backgroundSize = c.imageFit === "contain" ? "contain" : "cover";
      css.backgroundPosition = "center";
    }
    if (e.kind === "line" || e.kind === "arrow") {
      const a = e.arrow!;
      inner = (
        <svg width={Math.max(1, e.w)} height={Math.max(1, e.h)} style={{ overflow: "visible", position: "absolute", left: 0, top: 0 }}>
          <line x1={a.from.x - e.x} y1={a.from.y - e.y} x2={a.to.x - e.x} y2={a.to.y - e.y} stroke={color(s.stroke.color)} strokeWidth={s.stroke.width} />
        </svg>
      );
      css.overflow = "visible";
    }
    const tap = !!e.action || e.kind === "backButton";
    return (
      <div key={e.id} className={\`el\${tap ? " tap" : ""}\`} style={css} onClick={tap ? () => act(e) : undefined}>
        {inner}
      </div>
    );
  };

  return (
    <div className="stage" style={{ ...vars, background: t.bg, color: t.text }}>
      <div key={stack.length + cur.id} className={anim !== "none" ? "anim" : ""} style={{ position: "absolute", inset: 0, animationName: anim !== "none" ? \`in-\${anim}\` : undefined }}>
        <div className="screen" style={{ width: size.w, height: size.h, transform: \`scale(\${scale})\`, background: color(screen.bg) }}>
          {els.map(render)}
        </div>
      </div>
    </div>
  );
}
`;

function themeFile(p: Project): string {
  const light = themeTokens({ ...p.theme, mode: "light" });
  const dark = themeTokens({ ...p.theme, mode: "dark" });
  return `// Токены темы: из themeParams Telegram, иначе — значения проекта.
import type { TgWebApp } from "./types";

export type Tokens = Record<string, string>;
export const PROJECT_TOKENS: Record<"light" | "dark", Tokens> = ${JSON.stringify({ light, dark }, null, 2)};
export const TELEGRAM_FALLBACK: Record<"light" | "dark", Tokens> = ${JSON.stringify(
    { light: telegramTokens(TELEGRAM_THEMES.light), dark: telegramTokens(TELEGRAM_THEMES.dark) },
    null,
    2,
  )};

export function tokensFor(tg: TgWebApp | undefined, mode: "light" | "dark"): Tokens {
  if (!tg?.initData) return PROJECT_TOKENS[mode];
  const p = tg.themeParams;
  const base = TELEGRAM_FALLBACK[tg.colorScheme] ?? TELEGRAM_FALLBACK.light;
  return {
    ...PROJECT_TOKENS[tg.colorScheme],
    ...base,
    ...(p.bg_color && { bg: p.bg_color }),
    ...(p.secondary_bg_color && { surface: p.secondary_bg_color }),
    ...(p.text_color && { text: p.text_color }),
    ...(p.hint_color && { textMuted: p.hint_color }),
    ...(p.button_color && { accent: p.button_color }),
    ...(p.button_text_color && { onAccent: p.button_text_color }),
    ...(p.section_separator_color && { border: p.section_separator_color }),
  };
}
`;
}

export function appFiles(p: Project): Record<string, string> {
  return {
    "app/package.json": PKG,
    "app/tsconfig.json": TSCONFIG,
    "app/vite.config.ts": VITE,
    "app/index.html": HTML(p.title),
    "app/src/main.tsx": MAIN,
    "app/src/App.tsx": APP,
    "app/src/api.ts": API,
    "app/src/types.ts": TYPES,
    "app/src/theme.ts": themeFile(p),
    "app/src/styles.css": STYLES,
  };
}
