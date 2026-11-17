// Несколько проектов и именованные версии в IndexedDB.
// Ключи хранилища projects: "index" — список, "p:<id>" — проект, "v:<id>" — версии проекта.
import { uid } from "../lib/ids";
import type { Project } from "../lib/model";
import { parseProject } from "../lib/validate";
import { idbDel, idbGet, idbSet, STORE_PROJECTS } from "./idb";

export type ProjectMeta = { id: string; title: string; updatedAt: number; screens: number; elements: number };
export type Version = { id: string; name: string; at: number; project: Project };

const INDEX = "index";
const LEGACY = "current";
const pKey = (id: string) => `p:${id}`;
const vKey = (id: string) => `v:${id}`;
export const MAX_VERSIONS = 50;

export function metaOf(id: string, p: Project, updatedAt = Date.now()): ProjectMeta {
  return { id, title: p.title || "Без названия", updatedAt, screens: p.screens.length, elements: p.elements.length };
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const list = (await idbGet<ProjectMeta[]>(STORE_PROJECTS, INDEX)) ?? [];
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function writeIndex(list: ProjectMeta[]) {
  await idbSet(STORE_PROJECTS, INDEX, list);
}

export async function saveProject(id: string, p: Project): Promise<void> {
  await idbSet(STORE_PROJECTS, pKey(id), p);
  const list = (await idbGet<ProjectMeta[]>(STORE_PROJECTS, INDEX)) ?? [];
  const meta = metaOf(id, p);
  const i = list.findIndex((m) => m.id === id);
  if (i >= 0) list[i] = meta;
  else list.push(meta);
  await writeIndex(list);
}

export async function loadProject(id: string): Promise<{ project: Project; warnings: string[] } | null> {
  const raw = await idbGet<unknown>(STORE_PROJECTS, pKey(id));
  if (!raw) return null;
  const r = parseProject(raw);
  return r.ok ? { project: r.project, warnings: r.warnings } : null;
}

export async function createProject(p: Project): Promise<string> {
  const id = uid("prj");
  await saveProject(id, p);
  return id;
}

export async function deleteProject(id: string): Promise<void> {
  await idbDel(STORE_PROJECTS, pKey(id));
  await idbDel(STORE_PROJECTS, vKey(id));
  const list = (await idbGet<ProjectMeta[]>(STORE_PROJECTS, INDEX)) ?? [];
  await writeIndex(list.filter((m) => m.id !== id));
  try {
    localStorage.removeItem(sandboxKey(id));
  } catch {
    /* нет localStorage — нечего чистить */
  }
}

/** Старый формат (один проект под ключом "current") → список проектов. Возвращает id перенесённого проекта. */
export async function migrateLegacy(): Promise<string | null> {
  const legacy = await idbGet<unknown>(STORE_PROJECTS, LEGACY);
  if (!legacy) return null;
  const r = parseProject(legacy);
  let id: string | null = null;
  if (r.ok) id = await createProject(r.project);
  await idbDel(STORE_PROJECTS, LEGACY);
  return id;
}

export async function listVersions(projectId: string): Promise<Version[]> {
  return ((await idbGet<Version[]>(STORE_PROJECTS, vKey(projectId))) ?? []).sort((a, b) => b.at - a.at);
}

export async function saveVersion(projectId: string, name: string, p: Project): Promise<Version> {
  const list = await listVersions(projectId);
  const v: Version = { id: uid("ver"), name: name.trim() || new Date().toLocaleString(), at: Date.now(), project: structuredClone(p) };
  await idbSet(STORE_PROJECTS, vKey(projectId), [v, ...list].slice(0, MAX_VERSIONS));
  return v;
}

export async function deleteVersion(projectId: string, versionId: string): Promise<void> {
  const list = await listVersions(projectId);
  await idbSet(STORE_PROJECTS, vKey(projectId), list.filter((v) => v.id !== versionId));
}

/** Версия проходит через валидатор: снимок мог быть сделан в старой версии формата. */
export function versionProject(v: Version): Project | null {
  const r = parseProject(v.project);
  return r.ok ? r.project : null;
}

export const sandboxKey = (projectId: string) => `tma-builder:sandbox:${projectId}`;
