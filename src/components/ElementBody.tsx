// Внешний вид элемента. Используется на холсте, в режиме «Запустить» и для скриншотов.
import type { CSSProperties, ReactNode } from "react";
import { memo } from "react";
import type { Tokens } from "../lib/color";
import { resolveColor } from "../lib/color";
import type { Element, Stroke } from "../lib/model";
import { shapePath, strokeDash } from "../lib/shapes";
import { useImageSrc } from "../store/images";
import { Icon } from "./Icon";
import { tr } from "../lib/i18n";

const SHADOWS = [
  "none",
  "0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)",
  "0 4px 12px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.06)",
  "0 12px 32px rgba(0,0,0,.18), 0 4px 8px rgba(0,0,0,.08)",
];

export type BodyProps = {
  el: Element;
  tokens: Tokens;
  /** Данные из песочницы для привязанных списков. */
  rows?: string[];
};

function borderCss(s: Stroke, tokens: Tokens): CSSProperties {
  if (s.style === "none" || s.width <= 0) return {};
  const width = s.style === "double" ? Math.max(3, s.width) : s.width;
  return { border: `${width}px ${s.style} ${resolveColor(s.color, tokens)}` };
}

function textCss(el: Element, tokens: Tokens): CSSProperties {
  const s = el.style;
  return {
    color: resolveColor(s.textColor, tokens),
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    justifyContent: s.align === "center" ? "center" : s.align === "right" ? "flex-end" : "flex-start",
    textAlign: s.align,
  };
}

function Img({ src, fit, radius }: { src: string | undefined; fit: "cover" | "contain"; radius?: number }) {
  const url = useImageSrc(src);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, borderRadius: radius }}
    />
  );
}

function InlineIcon({ src, size }: { src: string; size: number }) {
  const url = useImageSrc(src);
  if (!url) return null;
  return <img src={url} alt="" draggable={false} style={{ width: size, height: size, objectFit: "contain", flex: "none" }} />;
}

function Text({ el, tokens, children, pad = 12 }: BodyProps & { children?: ReactNode; pad?: number }) {
  const c = el.content;
  const icon = c?.image && c.imageFit === "icon";
  return (
    <div className="el-text" style={{ ...textCss(el, tokens), padding: `0 ${pad}px`, gap: 8, position: "relative" }}>
      {icon && <InlineIcon src={c!.image!} size={Math.min(el.h - 8, el.style.fontSize * 1.5)} />}
      {children ?? c?.text}
    </div>
  );
}

function ShapeSvg({ el, tokens }: BodyProps) {
  const s = el.style;
  const sw = s.stroke.style === "none" ? 0 : s.stroke.width;
  const d = shapePath(el.content?.shape ?? "rect", el.w, el.h, sw, s.radius, el.content?.sides ?? 6);
  const fill = resolveColor(s.fill, tokens);
  const stroke = resolveColor(s.stroke.color, tokens);
  const double = s.stroke.style === "double";
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(1, el.w)} ${Math.max(1, el.h)}`} style={{ overflow: "visible", display: "block" }}>
      <path d={d} fill={fill} />
      {sw > 0 && (
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={double ? sw * 3 : sw}
          strokeDasharray={strokeDash(s.stroke.style, sw)}
          strokeLinecap={s.stroke.style === "dotted" ? "round" : "butt"}
          strokeLinejoin="round"
        />
      )}
      {double && sw > 0 && <path d={d} fill="none" stroke={fill === "transparent" ? tokens.bg : fill} strokeWidth={sw} />}
    </svg>
  );
}

export function ArrowSvg({ el, tokens, hit = false }: BodyProps & { hit?: boolean }) {
  const a = el.arrow;
  if (!a) return null;
  const s = el.style.stroke;
  const sw = Math.max(1, s.width);
  const color = resolveColor(s.style === "none" ? "$text" : s.color, tokens);
  const x1 = a.from.x - el.x;
  const y1 = a.from.y - el.y;
  const x2 = a.to.x - el.x;
  const y2 = a.to.y - el.y;
  const head = (hx: number, hy: number, fx: number, fy: number) => {
    const ang = Math.atan2(hy - fy, hx - fx);
    const L = 6 + sw * 3;
    const p = (da: number) => `${hx - L * Math.cos(ang + da)},${hy - L * Math.sin(ang + da)}`;
    return <polygon points={`${hx},${hy} ${p(0.45)} ${p(-0.45)}`} fill={color} />;
  };
  const double = s.style === "double";
  return (
    <svg
      width={Math.max(1, el.w)}
      height={Math.max(1, el.h)}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {hit && (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(14, sw + 10)} style={{ pointerEvents: "stroke" }} />
      )}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={double ? sw * 3 : sw}
        strokeDasharray={strokeDash(s.style, sw)}
        strokeLinecap={s.style === "dotted" ? "round" : "butt"}
      />
      {double && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tokens.bg} strokeWidth={sw} />}
      {a.head !== "none" && head(x2, y2, x1, y1)}
      {a.head === "both" && head(x1, y1, x2, y2)}
    </svg>
  );
}

function Body({ el, tokens, rows }: BodyProps) {
  const s = el.style;
  const c = el.content ?? {};
  const accent = tokens.accent;
  const muted = tokens.textMuted;
  const bgImage = c.image && c.imageFit !== "icon" ? <Img src={c.image} fit={c.imageFit === "contain" ? "contain" : "cover"} /> : null;

  switch (el.kind) {
    case "shape":
      return <ShapeSvg el={el} tokens={tokens} />;
    case "line":
    case "arrow":
      return <ArrowSvg el={el} tokens={tokens} />;
    case "image":
      return c.image ? (
        <Img src={c.image} fit={c.imageFit === "contain" ? "contain" : "cover"} />
      ) : (
        <div style={{ display: "grid", placeItems: "center", height: "100%", color: muted }}>
          <Icon name="image" size={Math.max(16, Math.min(48, el.w / 4, el.h / 3))} />
        </div>
      );
    case "card":
      return (
        <>
          {bgImage}
          <div style={{ ...textCss(el, tokens), padding: 16, fontWeight: 600, position: "relative" }}>{c.text}</div>
        </>
      );
    case "input":
      return (
        <Text el={el} tokens={tokens}>
          <span style={{ color: c.text ? undefined : muted }}>{c.text || c.placeholder}</span>
        </Text>
      );
    case "list": {
      const items = rows ?? c.items ?? [];
      const n = Math.max(1, items.length);
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {items.map((t, i) => (
            <div
              key={i}
              data-row={i}
              style={{
                ...textCss(el, tokens),
                flex: `0 0 ${Math.max(28, el.h / Math.max(n, rows ? 1 : n))}px`,
                maxHeight: 64,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                borderBottom: i < items.length - 1 ? `1px solid ${tokens.border}` : undefined,
              }}
            >
              {t}
            </div>
          ))}
          {items.length === 0 && <div style={{ padding: 16, color: muted }}>{tr("Пусто")}</div>}
        </div>
      );
    }
    case "tabs":
    case "nav": {
      const items = c.items ?? [];
      const active = Math.round(c.value ?? 0);
      return (
        <div style={{ display: "flex", height: "100%", padding: el.kind === "tabs" ? 3 : 0, gap: 3 }}>
          {items.map((t, i) => (
            <div
              key={i}
              data-row={i}
              style={{
                ...textCss(el, tokens),
                flex: 1,
                display: "flex",
                flexDirection: el.kind === "nav" ? "column" : "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                borderRadius: Math.max(0, s.radius - 3),
                background: el.kind === "tabs" && i === active ? tokens.bg : undefined,
                boxShadow: el.kind === "tabs" && i === active ? SHADOWS[1] : undefined,
                color: el.kind === "nav" && i === active ? accent : resolveColor(s.textColor, tokens),
              }}
            >
              {el.kind === "nav" && (
                <span style={{ width: 22, height: 22, borderRadius: 7, background: i === active ? accent : tokens.surface2, opacity: i === active ? 0.9 : 1 }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
            </div>
          ))}
        </div>
      );
    }
    case "divider":
      return null;
    case "switch": {
      const on = c.checked ?? false;
      const h = el.h;
      return (
        <div style={{ width: "100%", height: "100%", borderRadius: h / 2, background: on ? accent : tokens.surface2, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 3,
              left: on ? el.w - h + 3 : 3,
              width: h - 6,
              height: h - 6,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: SHADOWS[1],
              transition: "left .2s cubic-bezier(.2,0,0,1)",
            }}
          />
        </div>
      );
    }
    case "checkbox": {
      const on = c.checked ?? false;
      const box = Math.min(el.h, 22);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: "100%", ...textCss(el, tokens) }}>
          <span
            style={{
              width: box,
              height: box,
              flex: "none",
              borderRadius: 6,
              border: `2px solid ${on ? accent : tokens.border}`,
              background: on ? accent : "transparent",
              color: tokens.onAccent,
              display: "grid",
              placeItems: "center",
              fontSize: box * 0.7,
              lineHeight: 1,
            }}
          >
            {on ? "✓" : ""}
          </span>
          <span>{c.text}</span>
        </div>
      );
    }
    case "slider": {
      const v = Math.max(0, Math.min(1, c.value ?? 0));
      return (
        <div style={{ position: "relative", height: "100%" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, marginTop: -2, borderRadius: 2, background: tokens.surface2 }} />
          <div style={{ position: "absolute", left: 0, width: `${v * 100}%`, top: "50%", height: 4, marginTop: -2, borderRadius: 2, background: accent }} />
          <div
            style={{
              position: "absolute",
              left: `calc(${v * 100}% - 10px)`,
              top: "50%",
              marginTop: -10,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              border: `2px solid ${accent}`,
            }}
          />
        </div>
      );
    }
    case "headerBar":
      return (
        <Text el={el} tokens={tokens} pad={56}>
          {c.text}
        </Text>
      );
    case "backButton":
      return <Text el={el} tokens={tokens} pad={0} />;
    default:
      return (
        <>
          {bgImage}
          <Text el={el} tokens={tokens} />
        </>
      );
  }
}

/** Стиль контейнера элемента: заливка, рамка, скругление, тень, прозрачность. */
export function boxStyle(el: Element, tokens: Tokens): CSSProperties {
  const s = el.style;
  if (el.kind === "shape" || el.kind === "line" || el.kind === "arrow") return { opacity: s.opacity };
  const css: CSSProperties = {
    background: resolveColor(s.fill, tokens),
    borderRadius: el.kind === "switch" ? el.h / 2 : s.radius,
    boxShadow: SHADOWS[s.shadow] ?? "none",
    opacity: s.opacity,
    ...borderCss(s.stroke, tokens),
  };
  if (el.kind === "divider") css.background = resolveColor(s.fill === "transparent" ? "$border" : s.fill, tokens);
  return css;
}

export const ElementBody = memo(function ElementBody(props: BodyProps) {
  const { el, tokens } = props;
  const lineLike = el.kind === "line" || el.kind === "arrow";
  return (
    <div className="el-body" style={{ ...boxStyle(el, tokens), overflow: lineLike || el.kind === "shape" ? "visible" : "hidden" }}>
      <Body {...props} />
    </div>
  );
});
