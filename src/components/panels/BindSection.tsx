// Привязка элемента к данным: список из таблицы, форма записи, одиночное значение.
import type { Binding, Element } from "../../lib/model";
import { useEditor } from "../../store/editor";
import { patchSelected } from "./Inspector";
import { tr } from "../../lib/i18n";

const MODES: { value: Binding["mode"]; label: string; kinds: string[] }[] = [
  { value: "list", label: "Список записей", kinds: ["list"] },
  { value: "form", label: "Форма добавления", kinds: ["card", "box"] },
  { value: "value", label: "Одно значение", kinds: ["text", "badge", "button", "card", "box", "headerBar"] },
];

export function BindSection({ el }: { el: Element }) {
  const tables = useEditor((s) => s.project.data?.tables ?? []);
  const modes = MODES.filter((m) => m.kinds.includes(el.kind));
  if (modes.length === 0) return null;
  const set = (bind: Binding | undefined) => patchSelected(() => ({ bind }), "bind");
  const table = tables.find((t) => t.name === el.bind?.table);
  return (
    <div className="section">
      <h3>{tr("Данные")}</h3>
      {tables.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          {tr("Сначала создайте таблицу в окне «Данные».")}
        </p>
      ) : (
        <>
          <select
            className="input"
            style={{ marginBottom: 8 }}
            value={el.bind?.table ?? ""}
            onChange={(e) => (e.target.value ? set({ table: e.target.value, mode: el.bind?.mode ?? modes[0]!.value }) : set(undefined))}
          >
            <option value="">{tr("Без данных")}</option>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          {el.bind && (
            <>
              <select className="input" style={{ marginBottom: 8 }} value={el.bind.mode} onChange={(e) => set({ ...el.bind!, mode: e.target.value as Binding["mode"] })}>
                {modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {tr(m.label)}
                  </option>
                ))}
              </select>
              {el.bind.mode !== "form" && table && (
                <select
                  className="input"
                  value={el.bind.field ?? ""}
                  onChange={(e) => {
                    const b: Binding = { table: el.bind!.table, mode: el.bind!.mode };
                    if (e.target.value) b.field = e.target.value;
                    set(b);
                  }}
                >
                  <option value="">{el.bind.mode === "value" ? tr("Количество записей") : tr("Первое текстовое поле")}</option>
                  {table.fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="hint" style={{ marginBottom: 0 }}>
                {el.bind.mode === "form" ? tr("В режиме «Запустить» здесь появится форма с полями таблицы.") : tr("В режиме «Запустить» показываются записи песочницы.")}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
