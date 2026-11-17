// Один экран в режиме «Запустить»: элементы кликабельны по своим действиям.
import { memo, useState } from "react";
import type { Tokens } from "../../lib/color";
import { resolveColor } from "../../lib/color";
import type { Element, Screen } from "../../lib/model";
import { ElementBody } from "../ElementBody";

export type RunHandlers = {
  /** rowIndex — номер нажатой строки списка (для передачи записи на следующий экран). */
  onAction: (el: Element, rowIndex?: number) => void;
  rowsFor?: (el: Element) => string[] | undefined;
  renderForm?: (el: Element) => React.ReactNode;
  valueFor?: (el: Element, records?: Record<string, string>) => string | undefined;
  /** Переход по пункту навигации или вкладки. */
  onNavigate?: (screenId: string) => void;
};

type Props = {
  screen: Screen;
  elements: Element[];
  tokens: Tokens;
  w: number;
  h: number;
  highlight: boolean;
  handlers: RunHandlers;
  records?: Record<string, string>;
};

const TOGGLES = new Set(["switch", "checkbox"]);

export const RunScreen = memo(function RunScreen({ screen, elements, tokens, w, h, highlight, handlers, records }: Props) {
  // Переключатели и флажки живые в превью, но в проект не пишутся.
  const [local, setLocal] = useState<Record<string, Partial<NonNullable<Element["content"]>>>>({});
  return (
    <div
      style={{ position: "absolute", inset: 0, width: w, height: h, background: resolveColor(screen.bg, tokens, tokens.bg), overflow: "hidden", color: tokens.text, "--tk-accent": tokens.accent, "--tk-on-accent": tokens.onAccent } as React.CSSProperties}
    >
      {elements.map((el) => {
        if (el.hidden) return null;
        const override = local[el.id];
        let shown = override ? { ...el, content: { ...el.content, ...override } } : el;
        const value = handlers.valueFor?.(el, records);
        if (value !== undefined) {
          const isUrl = /^(https?:|data:image\/)/.test(value);
          shown = { ...shown, content: { ...shown.content, ...(el.kind === "image" ? (isUrl ? { image: value } : {}) : { text: value }) } };
        }
        const clickable = !!el.action || !!el.content?.links?.some(Boolean) || el.kind === "backButton" || TOGGLES.has(el.kind) || el.kind === "tabs" || el.kind === "nav";
        const form = handlers.renderForm?.(el);
        return (
          <div
            key={el.id}
            className={`run-el${clickable ? " clickable" : ""}${highlight && (el.action || el.content?.links?.some(Boolean)) ? " hl" : ""}`}
            style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z, pointerEvents: el.kind === "line" || el.kind === "arrow" ? "none" : undefined }}
            onClick={(e) => {
              if (TOGGLES.has(el.kind)) {
                setLocal((s) => ({ ...s, [el.id]: { checked: !(shown.content?.checked ?? false) } }));
              } else if ((el.kind === "tabs" || el.kind === "nav") && !el.action) {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const n = Math.max(1, el.content?.items?.length ?? 1);
                const i = Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n));
                setLocal((s) => ({ ...s, [el.id]: { value: i } }));
                const to = el.content?.links?.[i];
                if (to) return handlers.onNavigate?.(to);
              }
              const row = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
              handlers.onAction(el, row ? Number(row.dataset.row) : undefined);
            }}
          >
            {form ?? <ElementBody el={shown} tokens={tokens} rows={handlers.rowsFor?.(el)} />}
          </div>
        );
      })}
    </div>
  );
});
