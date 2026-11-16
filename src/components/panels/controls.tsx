// Мелкие контролы инспектора.
import type { ReactNode } from "react";
import { TOKEN_LABELS, TOKEN_NAMES, isHex, resolveColor, themeTokens } from "../../lib/color";
import type { Color } from "../../lib/model";
import { useEditor } from "../../store/editor";
import { tr } from "../../lib/i18n";

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
        }}
      />
    </label>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          title={o.title && tr(o.title)}
          className={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {typeof o.label === "string" ? tr(o.label) : o.label}
        </button>
      ))}
    </div>
  );
}

/** Цвет: токен темы или свой hex. Токены меняются вместе с темой. */
export function ColorInput({ value, onChange, allowNone = true }: { value: Color; onChange: (c: Color) => void; allowNone?: boolean }) {
  const theme = useEditor((s) => s.project.theme);
  const tokens = themeTokens(theme);
  const shown = resolveColor(value, tokens, "#000000");
  const mode = value === "transparent" ? "none" : value.startsWith("$") ? value : "custom";
  return (
    <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}>
      <input
        type="color"
        value={isHex(shown) && shown.length === 7 ? shown : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        aria-label={tr("Свой цвет")}
      />
      <select className="input" value={mode} onChange={(e) => onChange(e.target.value === "custom" ? (isHex(shown) ? shown : "#888888") : e.target.value === "none" ? "transparent" : e.target.value)}>
        {allowNone && <option value="none">{tr("Нет")}</option>}
        {TOKEN_NAMES.map((t) => (
          <option key={t} value={`$${t}`}>
            {tr(TOKEN_LABELS[t])}
          </option>
        ))}
        <option value="custom">{mode === "custom" ? value : tr("Свой…")}</option>
      </select>
    </div>
  );
}
