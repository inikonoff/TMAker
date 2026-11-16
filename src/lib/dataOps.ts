// Операции над схемой данных. Переименования и удаления каскадно обновляют привязки и ссылки.
import type { Field, Project, Table } from "./model";

const tablesOf = (p: Project) => p.data?.tables ?? [];
const withTables = (p: Project, tables: Table[]): Project => ({ ...p, data: { tables } });

export function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function addTable(p: Project, name = "items"): { project: Project; name: string } {
  const n = uniqueName(name, tablesOf(p).map((t) => t.name));
  const t: Table = { name: n, fields: [{ name: "title", type: "text", required: true }] };
  return { project: withTables(p, [...tablesOf(p), t]), name: n };
}

export function renameTable(p: Project, from: string, to: string): Project {
  const name = to.trim();
  if (!name || name === from || tablesOf(p).some((t) => t.name === name)) return p;
  const tables = tablesOf(p).map((t) => ({
    name: t.name === from ? name : t.name,
    fields: t.fields.map((f) => (f.ref === from ? { ...f, ref: name } : f)),
  }));
  const elements = p.elements.map((e) => (e.bind?.table === from ? { ...e, bind: { ...e.bind, table: name } } : e));
  return { ...withTables(p, tables), elements };
}

export function deleteTable(p: Project, name: string): Project {
  const tables = tablesOf(p)
    .filter((t) => t.name !== name)
    .map((t) => ({ ...t, fields: t.fields.map((f) => (f.ref === name ? { ...f, type: "number" as const, ref: undefined } : f)).map(stripUndef) }));
  const elements = p.elements.map((e) => {
    if (e.bind?.table !== name) return e;
    const next = { ...e };
    delete next.bind;
    return next;
  });
  return { ...withTables(p, tables), elements };
}

function stripUndef(f: Field): Field {
  const out = { ...f };
  if (out.ref === undefined) delete out.ref;
  return out;
}

export function addField(p: Project, table: string): Project {
  return withTables(
    p,
    tablesOf(p).map((t) =>
      t.name === table ? { ...t, fields: [...t.fields, { name: uniqueName("field", t.fields.map((f) => f.name)), type: "text", required: false }] } : t,
    ),
  );
}

export function updateField(p: Project, table: string, field: string, patch: Partial<Field>): Project {
  const t = tablesOf(p).find((x) => x.name === table);
  if (!t) return p;
  const newName = patch.name?.trim();
  if (patch.name !== undefined && (!newName || (newName !== field && t.fields.some((f) => f.name === newName)))) {
    const rest = { ...patch };
    delete rest.name;
    if (Object.keys(rest).length === 0) return p;
    return updateField(p, table, field, rest);
  }
  const tables = tablesOf(p).map((x) =>
    x.name !== table
      ? x
      : {
          ...x,
          fields: x.fields.map((f) => {
            if (f.name !== field) return f;
            const next: Field = { ...f, ...patch, ...(newName ? { name: newName } : {}) };
            if (next.type !== "ref") delete next.ref;
            return next;
          }),
        },
  );
  let elements = p.elements;
  if (newName && newName !== field) {
    elements = p.elements.map((e) => (e.bind?.table === table && e.bind.field === field ? { ...e, bind: { ...e.bind, field: newName } } : e));
  }
  return { ...withTables(p, tables), elements };
}

export function deleteField(p: Project, table: string, field: string): Project {
  const tables = tablesOf(p).map((t) => (t.name === table ? { ...t, fields: t.fields.filter((f) => f.name !== field) } : t));
  const elements = p.elements.map((e) => {
    if (e.bind?.table !== table || e.bind.field !== field) return e;
    const bind = { ...e.bind };
    delete bind.field;
    return { ...e, bind };
  });
  return { ...withTables(p, tables), elements };
}

export function moveField(p: Project, table: string, field: string, dir: -1 | 1): Project {
  return withTables(
    p,
    tablesOf(p).map((t) => {
      if (t.name !== table) return t;
      const i = t.fields.findIndex((f) => f.name === field);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= t.fields.length) return t;
      const fields = [...t.fields];
      [fields[i], fields[j]] = [fields[j]!, fields[i]!];
      return { ...t, fields };
    }),
  );
}
