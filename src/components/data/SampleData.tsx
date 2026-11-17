// Тестовые записи песочницы: то, что видно в режиме «Запустить». В проект и экспорт не попадают.
import { useEffect, useState } from "react";
import { tr } from "../../lib/i18n";
import { uid } from "../../lib/ids";
import type { Project } from "../../lib/model";
import type { SandboxData } from "../../lib/sandbox";
import { addRow, formatValue, parseSandbox, removeRow, validateRow } from "../../lib/sandbox";
import { useEditor } from "../../store/editor";
import { sandboxKey } from "../../store/projects";
import { Icon } from "../Icon";

function load(key: string): SandboxData {
  try {
    return parseSandbox(JSON.parse(localStorage.getItem(key) ?? "{}"));
  } catch {
    return {};
  }
}

export function SampleData({ project }: { project: Project }) {
  const projectId = useEditor((s) => s.projectId);
  const key = sandboxKey(projectId || "default");
  const tables = project.data?.tables ?? [];
  const [data, setData] = useState<SandboxData>(() => load(key));
  const [sel, setSel] = useState(tables[0]?.name ?? "");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const table = tables.find((t) => t.name === sel) ?? tables[0];

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* без localStorage записи живут до закрытия окна */
    }
  }, [data, key]);

  if (!table) return <div className="empty">{tr("Добавьте таблицу — например, «tasks» для списка задач.")}</div>;
  const rows = [...(data[table.name] ?? [])].reverse();

  const add = () => {
    const r = validateRow(table, values);
    if (!r.ok) return setError(r.error);
    setData((d) => addRow(d, table.name, r.row, uid("row")));
    setValues({});
    setError(null);
  };

  return (
    <div className="data-grid">
      <div className="data-tables">
        {tables.map((t) => (
          <button key={t.name} className={`menu-item${t.name === table.name ? " on" : ""}`} onClick={() => setSel(t.name)}>
            <Icon name="db" size={15} /> {t.name}
            <span className="hint" style={{ marginLeft: "auto" }}>
              {(data[t.name] ?? []).length}
            </span>
          </button>
        ))}
      </div>
      <div className="data-fields" style={{ overflowX: "auto" }}>
        <p className="hint" style={{ marginTop: 0 }}>
          {tr("Эти записи видны в режиме «Запустить». В проект и экспорт они не попадают — в настоящем приложении данные придут из базы.")}
        </p>
        <table className="fields">
          <thead>
            <tr>
              {table.fields.map((f) => (
                <th key={f.name}>
                  {f.name}
                  {f.required ? " *" : ""}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                {table.fields.map((f) => (
                  <td key={f.name} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={formatValue(r[f.name])}>
                    {formatValue(r[f.name])}
                  </td>
                ))}
                <td>
                  <button className="btn sm danger" aria-label={tr("Удалить")} onClick={() => setData((d) => removeRow(d, table.name, r._id))}>
                    <Icon name="close" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {table.fields.map((f) => (
                <td key={f.name}>
                  {f.type === "boolean" ? (
                    <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} />
                  ) : (
                    <input
                      className="input"
                      type={f.type === "date" ? "date" : "text"}
                      placeholder={f.name}
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && add()}
                    />
                  )}
                </td>
              ))}
              <td>
                <button className="btn sm primary" onClick={add} aria-label={tr("Добавить запись")}>
                  <Icon name="plus" size={15} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        {error && <div className="ai-error">{error}</div>}
      </div>
    </div>
  );
}
