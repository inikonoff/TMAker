// Правка текста прямо на холсте: поле поверх элемента с тем же шрифтом и выравниванием.
import { useEffect, useRef, useState } from "react";
import type { Tokens } from "../../lib/color";
import { resolveColor } from "../../lib/color";
import type { Element } from "../../lib/model";
import { updateElements } from "../../lib/ops";
import { useDrag } from "../../store/drag";
import { useEditor } from "../../store/editor";
import { tr } from "../../lib/i18n";

const TEXT_KINDS = new Set(["button", "text", "card", "badge", "checkbox", "mainButton", "backButton", "headerBar", "input"]);

export function canEditInline(el: Element): boolean {
  if (!TEXT_KINDS.has(el.kind) || el.locked) return false;
  // Значение привязанного элемента приходит из данных — его не правим.
  return !(el.bind && (el.bind.mode === "value" || el.bind.mode === "record"));
}

export function InlineText({ el, tokens }: { el: Element; tokens: Tokens }) {
  const field = el.kind === "input" ? "placeholder" : "text";
  const initial = (field === "placeholder" ? el.content?.placeholder : el.content?.text) ?? "";
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    useDrag.setState({ editingId: null });
    if (!save || value === initial) return;
    useEditor.getState().commit((p) => {
      const cur = p.elements.find((x) => x.id === el.id);
      if (!cur) return p;
      return updateElements(p, new Map([[el.id, { content: { ...cur.content, [field]: value } }]]));
    });
  };

  const s = el.style;
  const multiline = el.kind === "text" || el.kind === "card";
  return (
    <textarea
      ref={ref}
      className="inline-text"
      value={value}
      aria-label={tr("Текст элемента")}
      onChange={(e) => setValue(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") finish(false);
        if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          finish(true);
        }
      }}
      style={{
        color: resolveColor(el.kind === "input" ? "$textMuted" : s.textColor, tokens),
        fontSize: s.fontSize,
        fontWeight: el.kind === "card" ? 600 : s.fontWeight,
        textAlign: s.align,
        padding: el.kind === "card" ? 16 : el.kind === "text" ? "0 12px" : "0 12px",
        paddingTop: el.kind === "card" ? 16 : Math.max(0, (el.h - s.fontSize * 1.25) / 2),
      }}
    />
  );
}
