// Песочница данных в режиме «Запустить»: формы пишут записи, списки их показывают, всё переживает перезагрузку.
import { useCallback, useEffect, useMemo, useState } from "react";
import { uid } from "../../lib/ids";
import type { Element, Project, Table } from "../../lib/model";
import type { SandboxData } from "../../lib/sandbox";
import { addRow, listRows, parseSandbox, singleValue, validateRow } from "../../lib/sandbox";

const KEY = "tma-builder:sandbox";

function load(): SandboxData {
  try {
    return parseSandbox(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return {};
  }
}

function SandboxForm({ el, table, onAdd }: { el: Element; table: Table; onAdd: (values: Record<string, string | boolean>) => string | null }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const r = el.style.radius;
  return (
    <form
      className="sb-form"
      style={{ borderRadius: r }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        const err = onAdd(values);
        setError(err);
        if (!err) setValues({});
      }}
    >
      {el.content?.text && <div className="sb-title">{el.content.text}</div>}
      {table.fields.map((f) =>
        f.type === "boolean" ? (
          <label key={f.name} className="sb-check">
            <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} />
            {f.name}
          </label>
        ) : (
          <input
            key={f.name}
            className="sb-input"
            type={f.type === "number" ? "text" : f.type === "date" ? "date" : "text"}
            inputMode={f.type === "number" ? "decimal" : undefined}
            placeholder={f.name + (f.required ? " *" : "")}
            value={String(values[f.name] ?? "")}
            onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
          />
        ),
      )}
      {error && <div className="sb-error">{error}</div>}
      <button type="submit" className="sb-submit">
        Добавить
      </button>
    </form>
  );
}

export function useSandbox(project: Project) {
  const [data, setData] = useState<SandboxData>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* переполнение — песочница не критична */
    }
  }, [data]);

  const tables = useMemo(() => new Map((project.data?.tables ?? []).map((t) => [t.name, t])), [project.data]);

  const rowsFor = useCallback(
    (el: Element) => {
      if (!el.bind) return undefined;
      const t = tables.get(el.bind.table);
      if (!t) return undefined;
      if (el.bind.mode === "list") return listRows(data, t, el.bind);
      return undefined;
    },
    [data, tables],
  );

  const renderForm = useCallback(
    (el: Element) => {
      if (!el.bind) return undefined;
      const t = tables.get(el.bind.table);
      if (!t) return undefined;
      if (el.bind.mode === "value") {
        return (
          <div className="el-text" style={{ height: "100%", fontSize: el.style.fontSize, fontWeight: el.style.fontWeight }}>
            {singleValue(data, t, el.bind)}
          </div>
        );
      }
      if (el.bind.mode !== "form") return undefined;
      return (
        <SandboxForm
          el={el}
          table={t}
          onAdd={(values) => {
            const r = validateRow(t, values);
            if (!r.ok) return r.error;
            setData((d) => addRow(d, t.name, r.row, uid("row")));
            return null;
          }}
        />
      );
    },
    [data, tables],
  );

  const count = Object.values(data).reduce((s, rows) => s + rows.length, 0);
  const toolbar =
    tables.size > 0 ? (
      <button
        className="btn sm"
        title="Очистить данные песочницы"
        disabled={count === 0}
        onClick={() => confirm("Удалить все записи песочницы?") && setData({})}
      >
        Данные: {count} ✕
      </button>
    ) : null;

  return { rowsFor, renderForm, toolbar };
}
