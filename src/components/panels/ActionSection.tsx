import { TRANSITION_LABELS } from "../../lib/transitions";
import type { Action, Element, TransitionKind } from "../../lib/model";
import { TRANSITIONS } from "../../lib/validate";
import { useEditor } from "../../store/editor";
import { patchSelected } from "./Inspector";

type ActionType = "none" | "to" | "back" | "link";

function typeOf(a: Action | undefined): ActionType {
  if (!a) return "none";
  if ("to" in a) return "to";
  if ("back" in a) return "back";
  return "link";
}

/** Действие по нажатию: переход на экран, назад или ссылка. */
export function ActionSection({ el }: { el: Element }) {
  const screens = useEditor((s) => s.project.screens);
  const type = typeOf(el.action);
  const others = screens.filter((s) => s.id !== el.screenId);
  const set = (action: Action | undefined, key = "action") => patchSelected(() => ({ action }), key);

  return (
    <div className="section">
      <h3>Действие по нажатию</h3>
      <select
        className="input"
        value={type}
        style={{ marginBottom: 8 }}
        onChange={(e) => {
          const t = e.target.value as ActionType;
          if (t === "none") set(undefined);
          else if (t === "back") set({ back: true });
          else if (t === "link") set({ open: "link", url: "https://" });
          else set({ to: others[0]?.id ?? screens[0]!.id, transition: "slideLeft" });
        }}
      >
        <option value="none">Нет</option>
        <option value="to">Перейти на экран</option>
        <option value="back">Назад</option>
        <option value="link">Открыть ссылку</option>
      </select>
      {el.action && "to" in el.action && (
        <>
          <select
            className="input"
            value={el.action.to}
            style={{ marginBottom: 8 }}
            onChange={(e) => set({ to: e.target.value, transition: (el.action as { transition: TransitionKind }).transition })}
          >
            {screens.map((s, i) => (
              <option key={s.id} value={s.id} disabled={s.id === el.screenId}>
                {i + 1}. {s.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={el.action.transition}
            onChange={(e) => set({ to: (el.action as { to: string }).to, transition: e.target.value as TransitionKind })}
          >
            {TRANSITIONS.map((t) => (
              <option key={t} value={t}>
                {TRANSITION_LABELS[t]}
              </option>
            ))}
          </select>
        </>
      )}
      {el.action && "open" in el.action && (
        <input
          className="input"
          value={el.action.url}
          placeholder="https://t.me/…"
          onChange={(e) => set({ open: "link", url: e.target.value }, "url")}
        />
      )}
    </div>
  );
}
