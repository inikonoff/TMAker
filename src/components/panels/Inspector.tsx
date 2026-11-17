// Инспектор: свойства выделенных элементов. Правки нескольких элементов применяются ко всем.
import { KIND_SPEC } from "../../lib/defaults";
import type { Element, ImageFit, ShapeKind, Stroke, StrokeStyle, Style } from "../../lib/model";
import { deleteElements, duplicateElements, reorderZ, updateElements } from "../../lib/ops";
import { useEditor } from "../../store/editor";
import { putImage } from "../../store/images";
import { Icon } from "../Icon";
import { ActionSection } from "./ActionSection";
import { ArrangeSection } from "./ArrangeSection";
import { BindSection } from "./BindSection";
import { ColorInput, NumField, Row, Seg } from "./controls";
import { tr } from "../../lib/i18n";

const TEXT_KINDS = new Set(["button", "text", "card", "badge", "checkbox", "mainButton", "backButton", "headerBar", "input"]);
const ITEM_KINDS = new Set(["list", "tabs", "nav"]);
const IMAGE_KINDS = new Set(["image", "button", "box", "card", "badge", "mainButton"]);
const STROKES: { value: StrokeStyle; label: string }[] = [
  { value: "none", label: "Нет" },
  { value: "solid", label: "━" },
  { value: "dashed", label: "╍" },
  { value: "dotted", label: "┈" },
  { value: "double", label: "═" },
];
const SHAPES: { value: ShapeKind; label: string }[] = [
  { value: "rect", label: "▭" },
  { value: "ellipse", label: "◯" },
  { value: "triangle", label: "△" },
  { value: "star", label: "☆" },
  { value: "polygon", label: "⬡" },
];

export function patchSelected(fn: (e: Element) => Partial<Element>, key?: string) {
  const st = useEditor.getState();
  const ids = new Set(st.selection);
  st.commit((p) => {
    const patches = new Map<string, Partial<Element>>();
    for (const e of p.elements) if (ids.has(e.id)) patches.set(e.id, fn(e));
    return updateElements(p, patches);
  }, key);
}

const setStyle = (patch: Partial<Style>, key: string) => patchSelected((e) => ({ style: { ...e.style, ...patch } }), key);
const setStroke = (patch: Partial<Stroke>, key: string) =>
  patchSelected((e) => ({ style: { ...e.style, stroke: { ...e.style.stroke, ...patch } } }), key);
const setContent = (patch: Partial<NonNullable<Element["content"]>>, key: string) =>
  patchSelected((e) => ({ content: { ...e.content, ...patch } }), key);

export async function setImageFromBlob(blob: Blob) {
  const st = useEditor.getState();
  try {
    const ref = await putImage(blob);
    setContent({ image: ref }, "img");
  } catch (err) {
    st.showToast(err instanceof Error ? err.message : tr("Не удалось сохранить картинку"));
  }
}

function ImageSection({ el }: { el: Element }) {
  const c = el.content ?? {};
  const fits: { value: ImageFit; label: string }[] = [
    { value: "cover", label: tr("Заполнить") },
    { value: "contain", label: tr("Вписать") },
    ...(el.kind !== "image" ? [{ value: "icon" as const, label: tr("Иконка") }] : []),
  ];
  return (
    <div className="section">
      <h3>{tr("Картинка")}</h3>
      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
        <label className="btn sm ghost-line" style={{ cursor: "pointer" }}>
          <Icon name="upload" size={15} /> {tr("Файл")}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void setImageFromBlob(f);
              e.target.value = "";
            }}
          />
        </label>
        {c.image && (
          <button className="btn sm ghost-line danger" onClick={() => setContent({ image: undefined }, "img")}>
            {tr("Убрать")}
          </button>
        )}
      </div>
      <input
        className="input"
        placeholder={tr("https://… или вставьте Ctrl+V")}
        value={c.image && !c.image.startsWith("idb:") ? c.image : ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (!v || /^https?:\/\//.test(v)) setContent({ image: v || undefined }, "img-url");
        }}
        style={{ marginBottom: 8 }}
      />
      {c.image && <Seg value={c.imageFit ?? "cover"} options={fits} onChange={(v) => setContent({ imageFit: v }, "fit")} />}
    </div>
  );
}

/** Экран для каждого пункта навигации или вкладок. */
function ItemLinks({ el }: { el: Element }) {
  const screens = useEditor((s) => s.project.screens);
  const items = el.content?.items ?? [];
  const links = el.content?.links ?? [];
  if (items.length === 0) return null;
  return (
    <>
      <div className="hint" style={{ margin: "4px 0 6px" }}>
        {tr("Пункт ведёт на экран")}
      </div>
      {items.map((it, i) => (
        <div className="row" key={i}>
          <label title={it}>{it || `#${i + 1}`}</label>
          <select
            className="input"
            value={links[i] ?? ""}
            onChange={(e) => {
              const next = items.map((_, j) => (j === i ? e.target.value : (links[j] ?? "")));
              setContent({ links: next.some(Boolean) ? next : undefined }, `links-${i}`);
            }}
          >
            <option value="">—</option>
            {screens
              .filter((s) => s.id !== el.screenId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      ))}
    </>
  );
}

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const sel = project.elements.filter((e) => selection.includes(e.id));
  const el = sel[0];
  if (!el) return null;
  const st = useEditor.getState();
  const multi = sel.length > 1;
  const s = el.style;
  const c = el.content ?? {};
  const lineLike = el.kind === "line" || el.kind === "arrow";
  const ids = new Set(selection);

  return (
    <>
      <div className="section">
        <h3>
          {multi ? tr("Выбрано: {n}", { n: sel.length }) : tr(KIND_SPEC[el.kind].label)}
          <span style={{ display: "flex", gap: 2 }}>
            <button
              className="btn sm"
              title={tr("Дублировать (Ctrl+D)")}
              onClick={() => {
                let next: string[] = [];
                st.commit((p) => {
                  const r = duplicateElements(p, selection);
                  next = r.ids;
                  return r.project;
                });
                st.select(next);
              }}
            >
              <Icon name="copy" size={15} />
            </button>
            <button className="btn sm danger" title={tr("Удалить (Delete)")} onClick={() => st.commit((p) => deleteElements(p, ids))}>
              <Icon name="trash" size={15} />
            </button>
          </span>
        </h3>
        {!multi && (
          <input
            className="input"
            placeholder={tr("Имя слоя")}
            value={el.name ?? ""}
            onChange={(e) => patchSelected(() => ({ name: e.target.value || undefined }), "name")}
            style={{ marginBottom: 8 }}
          />
        )}
        {!multi && !lineLike && (
          <div className="grid2">
            <NumField label="X" value={el.x} onChange={(v) => patchSelected(() => ({ x: v }), "x")} />
            <NumField label="Y" value={el.y} onChange={(v) => patchSelected(() => ({ y: v }), "y")} />
            <NumField label={tr("Ш")} value={el.w} min={1} onChange={(v) => patchSelected(() => ({ w: v }), "w")} />
            <NumField label={tr("В")} value={el.h} min={el.kind === "divider" ? 1 : 1} onChange={(v) => patchSelected(() => ({ h: v }), "h")} />
          </div>
        )}
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm ghost-line" title={tr("На передний план")} onClick={() => st.commit((p) => reorderZ(p, ids, "front"))}>
            ⤒
          </button>
          <button className="btn sm ghost-line" title={tr("Выше")} onClick={() => st.commit((p) => reorderZ(p, ids, "forward"))}>
            ↑
          </button>
          <button className="btn sm ghost-line" title={tr("Ниже")} onClick={() => st.commit((p) => reorderZ(p, ids, "backward"))}>
            ↓
          </button>
          <button className="btn sm ghost-line" title={tr("На задний план")} onClick={() => st.commit((p) => reorderZ(p, ids, "back"))}>
            ⤓
          </button>
          <span className="spacer" />
          <button
            className={`btn sm${el.locked ? " on" : ""}`}
            title={tr("Закрепить")}
            onClick={() => patchSelected(() => ({ locked: el.locked ? undefined : true }))}
          >
            <Icon name="lock" size={15} />
          </button>
          <button
            className={`btn sm${el.hidden ? " on" : ""}`}
            title={tr("Скрыть в превью")}
            onClick={() => patchSelected(() => ({ hidden: el.hidden ? undefined : true }))}
          >
            <Icon name="eye" size={15} />
          </button>
        </div>
      </div>

      {multi && <ArrangeSection />}

      {(TEXT_KINDS.has(el.kind) || ITEM_KINDS.has(el.kind) || el.kind === "shape" || el.kind === "switch" || el.kind === "slider") && (
        <div className="section">
          <h3>{tr("Содержимое")}</h3>
          {TEXT_KINDS.has(el.kind) && el.kind !== "input" && (
            <textarea
              className="input"
              value={c.text ?? ""}
              onChange={(e) => setContent({ text: e.target.value }, "text")}
              rows={2}
              style={{ marginBottom: 8 }}
            />
          )}
          {el.kind === "input" && (
            <input
              className="input"
              placeholder={tr("Подсказка")}
              value={c.placeholder ?? ""}
              onChange={(e) => setContent({ placeholder: e.target.value }, "ph")}
              style={{ marginBottom: 8 }}
            />
          )}
          {ITEM_KINDS.has(el.kind) && el.bind?.mode === "list" && (
            <p className="hint" style={{ marginTop: 0 }}>
              {tr("Строки берутся из таблицы «{t}» — см. раздел «Данные» ниже.", { t: el.bind.table })}
            </p>
          )}
          {ITEM_KINDS.has(el.kind) && el.bind?.mode !== "list" && (
            <>
              <textarea
                className="input"
                value={(c.items ?? []).join("\n")}
                onChange={(e) => setContent({ items: e.target.value.split("\n") }, "items")}
                rows={4}
                placeholder={tr("Каждый пункт с новой строки")}
                style={{ marginBottom: 8 }}
              />
              {el.kind !== "list" && (
                <Row label={tr("Активный")}>
                  <NumField label="#" value={(c.value ?? 0) + 1} min={1} max={(c.items ?? []).length || 1} onChange={(v) => setContent({ value: v - 1 }, "val")} />
                </Row>
              )}
              {el.kind !== "list" && !multi && <ItemLinks el={el} />}
            </>
          )}
          {el.kind === "shape" && (
            <>
              <Seg value={c.shape ?? "rect"} options={SHAPES} onChange={(v) => setContent({ shape: v }, "shape")} />
              {c.shape === "polygon" && (
                <Row label={tr("Углов")}>
                  <input type="range" min={3} max={12} value={c.sides ?? 6} onChange={(e) => setContent({ sides: Number(e.target.value) }, "sides")} />
                </Row>
              )}
            </>
          )}
          {(el.kind === "switch" || el.kind === "checkbox") && (
            <Row label={tr("Включён")}>
              <input type="checkbox" checked={!!c.checked} onChange={(e) => setContent({ checked: e.target.checked }, "chk")} />
            </Row>
          )}
          {el.kind === "slider" && (
            <Row label={tr("Значение")}>
              <input type="range" min={0} max={1} step={0.01} value={c.value ?? 0} onChange={(e) => setContent({ value: Number(e.target.value) }, "val")} />
            </Row>
          )}
        </div>
      )}

      {!multi && IMAGE_KINDS.has(el.kind) && <ImageSection el={el} />}

      <div className="section">
        <h3>{tr("Стиль")}</h3>
        {!lineLike && (
          <Row label={tr("Заливка")}>
            <ColorInput value={s.fill} onChange={(v) => setStyle({ fill: v }, "fill")} />
          </Row>
        )}
        <Row label={tr("Рамка")}>
          <Seg value={s.stroke.style} options={STROKES} onChange={(v) => setStroke({ style: v, width: Math.max(s.stroke.width, v === "double" ? 3 : 1) }, "stroke")} />
        </Row>
        {s.stroke.style !== "none" && (
          <>
            <Row label={tr("Цвет рамки")}>
              <ColorInput value={s.stroke.color} onChange={(v) => setStroke({ color: v }, "stroke-c")} allowNone={false} />
            </Row>
            <Row label={tr("Толщина")}>
              <input type="range" min={1} max={16} value={s.stroke.width} onChange={(e) => setStroke({ width: Number(e.target.value) }, "stroke-w")} />
            </Row>
          </>
        )}
        {el.kind === "arrow" || el.kind === "line" ? (
          <Row label={tr("Концы")}>
            <Seg
              value={el.arrow?.head ?? "none"}
              options={[
                { value: "none", label: "—" },
                { value: "end", label: "→" },
                { value: "both", label: "↔" },
              ]}
              onChange={(v) => patchSelected((e) => (e.arrow ? { arrow: { ...e.arrow, head: v } } : {}), "head")}
            />
          </Row>
        ) : (
          <Row label={tr("Скругление")}>
            <input type="range" min={0} max={Math.max(4, Math.round(Math.min(el.w, el.h) / 2))} value={s.radius} onChange={(e) => setStyle({ radius: Number(e.target.value) }, "radius")} />
          </Row>
        )}
        {!lineLike && (
          <Row label={tr("Тень")}>
            <Seg value={s.shadow} options={[0, 1, 2, 3].map((v) => ({ value: v, label: v === 0 ? tr("Нет") : String(v) }))} onChange={(v) => setStyle({ shadow: v }, "shadow")} />
          </Row>
        )}
        <Row label={tr("Прозрачн.")}>
          <input type="range" min={0.05} max={1} step={0.05} value={s.opacity} onChange={(e) => setStyle({ opacity: Number(e.target.value) }, "opacity")} />
        </Row>
      </div>

      {(TEXT_KINDS.has(el.kind) || ITEM_KINDS.has(el.kind)) && (
        <div className="section">
          <h3>{tr("Текст")}</h3>
          <Row label={tr("Цвет")}>
            <ColorInput value={s.textColor} onChange={(v) => setStyle({ textColor: v }, "tc")} allowNone={false} />
          </Row>
          <div className="grid2">
            <NumField label={tr("Размер")} value={s.fontSize} min={6} max={200} onChange={(v) => setStyle({ fontSize: v }, "fs")} />
            <label className="field">
              <span>{tr("Вес")}</span>
              <select value={s.fontWeight} onChange={(e) => setStyle({ fontWeight: Number(e.target.value) as Style["fontWeight"] }, "fw")}>
                <option value={400}>{tr("Обычный")}</option>
                <option value={500}>{tr("Средний")}</option>
                <option value={600}>{tr("Полужирный")}</option>
                <option value={700}>{tr("Жирный")}</option>
              </select>
            </label>
          </div>
          <Seg
            value={s.align}
            options={[
              { value: "left", label: tr("Слева") },
              { value: "center", label: tr("Центр") },
              { value: "right", label: tr("Справа") },
            ]}
            onChange={(v) => setStyle({ align: v }, "align")}
          />
        </div>
      )}

      {!multi && !lineLike && <ActionSection el={el} />}
      {!multi && <BindSection el={el} />}
    </>
  );
}
