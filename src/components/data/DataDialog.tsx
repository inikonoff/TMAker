// Редактор схемы данных и настроек бота. Секреты (токен) сюда не вводятся.
import { useState } from "react";
import { addField, addTable, deleteField, deleteTable, moveField, renameTable, updateField } from "../../lib/dataOps";
import type { FieldType, Project } from "../../lib/model";
import { useEditor } from "../../store/editor";
import { Icon } from "../Icon";
import { tr } from "../../lib/i18n";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Да/нет" },
  { value: "date", label: "Дата" },
  { value: "image", label: "Картинка (URL)" },
  { value: "ref", label: "Связь →" },
];

/** Поле ввода, которое применяет значение по Enter/потере фокуса (для имён — чтобы не ломать привязки на каждой букве). */
function CommitInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  const [focus, setFocus] = useState(false);
  return (
    <input
      {...rest}
      value={focus ? v : value}
      onFocus={() => {
        setV(value);
        setFocus(true);
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocus(false);
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function TablesEditor({ project }: { project: Project }) {
  const commit = useEditor((s) => s.commit);
  const tables = project.data?.tables ?? [];
  const [sel, setSel] = useState(tables[0]?.name ?? "");
  const table = tables.find((t) => t.name === sel) ?? tables[0];
  const usedBy = (name: string) => project.elements.filter((e) => e.bind?.table === name).length;

  return (
    <div className="data-grid">
      <div className="data-tables">
        {tables.map((t) => (
          <button key={t.name} className={`menu-item${t.name === table?.name ? " on" : ""}`} onClick={() => setSel(t.name)}>
            <Icon name="db" size={15} /> {t.name}
            <span className="hint" style={{ marginLeft: "auto" }}>
              {t.fields.length}
            </span>
          </button>
        ))}
        <button
          className="btn sm ghost-line"
          style={{ marginTop: 6, width: "100%" }}
          onClick={() => {
            let name = "";
            commit((p) => {
              const r = addTable(p);
              name = r.name;
              return r.project;
            });
            setSel(name);
          }}
        >
          <Icon name="plus" size={15} /> {tr("Таблица")}
        </button>
      </div>
      <div className="data-fields">
        {!table ? (
          <div className="empty">{tr("Добавьте таблицу — например, «tasks» для списка задач.")}</div>
        ) : (
          <>
            <div className="row">
              <label>{tr("Таблица")}</label>
              <CommitInput
                className="input"
                value={table.name}
                aria-label={tr("Имя таблицы")}
                onCommit={(v) => {
                  commit((p) => renameTable(p, table.name, v));
                  setSel(v.trim() || table.name);
                }}
              />
              <button
                className="btn sm danger"
                title={tr("Удалить таблицу")}
                onClick={() => {
                  const n = usedBy(table.name);
                  if (n && !confirm(tr("Таблица привязана к {n} элементам. Удалить и снять привязки?", { n }))) return;
                  commit((p) => deleteTable(p, table.name));
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
            <table className="fields">
              <thead>
                <tr>
                  <th>{tr("Поле")}</th>
                  <th>{tr("Тип")}</th>
                  <th title={tr("Обязательное")}>*</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.fields.map((f, i) => (
                  <tr key={f.name}>
                    <td>
                      <CommitInput className="input" value={f.name} aria-label={tr("Имя поля")} onCommit={(v) => commit((p) => updateField(p, table.name, f.name, { name: v }))} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <select
                          className="input"
                          value={f.type}
                          onChange={(e) => {
                            const type = e.target.value as FieldType;
                            const ref = type === "ref" ? tables.find((t) => t.name !== table.name)?.name ?? table.name : undefined;
                            commit((p) => updateField(p, table.name, f.name, ref ? { type, ref } : { type }));
                          }}
                        >
                          {TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {tr(t.label)}
                            </option>
                          ))}
                        </select>
                        {f.type === "ref" && (
                          <select className="input" value={f.ref ?? ""} onChange={(e) => commit((p) => updateField(p, table.name, f.name, { ref: e.target.value }))}>
                            {tables.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td>
                      <input type="checkbox" checked={f.required} onChange={(e) => commit((p) => updateField(p, table.name, f.name, { required: e.target.checked }))} />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn sm" disabled={i === 0} onClick={() => commit((p) => moveField(p, table.name, f.name, -1))} aria-label={tr("Выше")}>
                        ↑
                      </button>
                      <button className="btn sm danger" onClick={() => commit((p) => deleteField(p, table.name, f.name))} aria-label={tr("Удалить поле")}>
                        <Icon name="close" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn sm ghost-line" onClick={() => commit((p) => addField(p, table.name))}>
              <Icon name="plus" size={15} /> {tr("Поле")}
            </button>
            <p className="hint">
              {tr("У каждой записи автоматически есть")} <code>id</code>, <code>user_id</code> {tr("(кто создал в Telegram) и")} <code>created_at</code>.
              Используется элементами: {usedBy(table.name)}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function BotEditor({ project }: { project: Project }) {
  const commit = useEditor((s) => s.commit);
  const bot = project.bot ?? { name: "", commands: [] };
  const setBot = (b: typeof bot, key?: string) => commit((p) => ({ ...p, bot: b }), key);
  return (
    <>
      <div className="row">
        <label>{tr("Имя бота")}</label>
        <input className="input" placeholder="my_app_bot" value={bot.name} onChange={(e) => setBot({ ...bot, name: e.target.value.replace(/^@/, "") }, "bot-name")} />
      </div>
      {bot.commands.map((c, i) => (
        <div className="row" key={i}>
          <input
            className="input"
            style={{ width: 120, flex: "none" }}
            value={`/${c.command}`}
            aria-label={tr("Команда")}
            onChange={(e) => {
              const commands = [...bot.commands];
              commands[i] = { ...c, command: e.target.value.replace(/^\//, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32) };
              setBot({ ...bot, commands }, `cmd-${i}`);
            }}
          />
          <input
            className="input"
            value={c.description}
            placeholder={tr("Описание")}
            onChange={(e) => {
              const commands = [...bot.commands];
              commands[i] = { ...c, description: e.target.value };
              setBot({ ...bot, commands }, `cmd-d-${i}`);
            }}
          />
          <button className="btn sm danger" aria-label={tr("Удалить команду")} onClick={() => setBot({ ...bot, commands: bot.commands.filter((_, j) => j !== i) })}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      <button
        className="btn sm ghost-line"
        onClick={() => setBot({ ...bot, commands: [...bot.commands, { command: bot.commands.length ? "help" : "start", description: bot.commands.length ? tr("Помощь") : tr("Открыть приложение") }] })}
      >
        <Icon name="plus" size={15} /> {tr("Команда")}
      </button>
      <p className="hint">{tr("Токен бота сюда не вводится и в проект не попадает: он задаётся в .env при запуске заготовки.")}</p>
    </>
  );
}

export function DataDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const [tab, setTab] = useState<"data" | "bot">("data");
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="data-title">
        <div className="modal-head">
          <h2 id="data-title">{tr("Данные и бот")}</h2>
          <button className="btn sm" onClick={onClose} aria-label={tr("Закрыть")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="seg" style={{ maxWidth: 260, marginBottom: 12 }}>
          <button className={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>
            {tr("Таблицы")}
          </button>
          <button className={tab === "bot" ? "on" : ""} onClick={() => setTab("bot")}>
            {tr("Бот")}
          </button>
        </div>
        {tab === "data" ? <TablesEditor project={project} /> : <BotEditor project={project} />}
      </div>
    </div>
  );
}
