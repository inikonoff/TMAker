// Шаблоны server/: бот на grammY, API на Hono, Drizzle (SQLite или Postgres), проверка initData.
import type { Project } from "../model";
import type { Dialect } from "./sql";
import { drizzleSchema, migrationSql } from "./sql";

const VERSIONS = {
  grammy: "^1.46.0",
  "drizzle-orm": "^0.45.4",
  "drizzle-kit": "^0.31.11",
  hono: "^4.13.19",
  "@hono/node-server": "^2.1.8",
  "better-sqlite3": "^13.2.0",
  pg: "^8.23.1",
  tsx: "^4.23.15",
  "@types/better-sqlite3": "^9.6.0",
  "@types/pg": "^8.23.1",
  "@types/node": "^22.0.0",
  dotenv: "^18.0.10",
  typescript: "~5.9.0",
};

function serverPackage(d: Dialect): string {
  const deps: Record<string, string> = {
    grammy: VERSIONS.grammy,
    "drizzle-orm": VERSIONS["drizzle-orm"],
    hono: VERSIONS.hono,
    "@hono/node-server": VERSIONS["@hono/node-server"],
    dotenv: VERSIONS.dotenv,
  };
  const dev: Record<string, string> = {
    "drizzle-kit": VERSIONS["drizzle-kit"],
    tsx: VERSIONS.tsx,
    typescript: VERSIONS.typescript,
    "@types/node": VERSIONS["@types/node"],
  };
  if (d === "sqlite") {
    deps["better-sqlite3"] = VERSIONS["better-sqlite3"];
    dev["@types/better-sqlite3"] = VERSIONS["@types/better-sqlite3"];
  } else {
    deps.pg = VERSIONS.pg;
    dev["@types/pg"] = VERSIONS["@types/pg"];
  }
  return JSON.stringify(
    {
      name: "server",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc -p tsconfig.json",
        start: "node dist/index.js",
        migrate: "tsx src/migrate.ts",
        test: "tsx --test src/*.test.ts",
        typecheck: "tsc -p tsconfig.json --noEmit",
      },
      dependencies: deps,
      devDependencies: dev,
    },
    null,
    2,
  );
}

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: "dist",
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ["node"],
    },
    include: ["src"],
    exclude: ["src/**/*.test.ts"],
  },
  null,
  2,
);

const INIT_DATA = `// Проверка initData из Telegram WebApp (HMAC-SHA256). Без неё API не доверяет клиенту.
import { createHmac, timingSafeEqual } from "node:crypto";

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };

export function checkInitData(initData: string, botToken: string, maxAgeSec = 24 * 3600, now = Date.now()): TgUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => \`\${k}=\${v}\`)
    .join("\\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc.length !== hash.length || !timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(params.get("auth_date"));
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "null") as TgUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

/** Для тестов: подписать initData так же, как это делает Telegram. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => \`\${k}=\${v}\`)
    .join("\\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secret).update(dataCheck).digest("hex"));
  return params.toString();
}
`;

const INIT_DATA_TEST = `import assert from "node:assert/strict";
import { test } from "node:test";
import { checkInitData, signInitData } from "./initData.js";

const TOKEN = "123456:TEST";
const now = Date.now();
const fields = { auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: 42, first_name: "Ann" }), query_id: "q" };

test("принимает правильную подпись", () => {
  assert.equal(checkInitData(signInitData(fields, TOKEN), TOKEN, 3600, now)?.id, 42);
});

test("отклоняет подделку, чужой токен и старые данные", () => {
  const good = signInitData(fields, TOKEN);
  assert.equal(checkInitData(good.replace("Ann", "Bob"), TOKEN, 3600, now), null);
  assert.equal(checkInitData(good, "999:OTHER", 3600, now), null);
  assert.equal(checkInitData(good, TOKEN, 60, now + 3600_000), null);
  assert.equal(checkInitData("", TOKEN), null);
});
`;

function dbFile(d: Dialect): string {
  if (d === "sqlite") {
    return `// SQLite через better-sqlite3. DATABASE_URL=file:./data.db
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = (process.env.DATABASE_URL ?? "file:./data.db").replace(/^file:/, "");
export const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite);

/** Применить SQL-миграции из drizzle/ по порядку, один раз каждую. */
export async function migrate(dir = resolve(process.env.MIGRATIONS_DIR ?? "drizzle")): Promise<string[]> {
  sqlite.exec('CREATE TABLE IF NOT EXISTS "_migrations" ("name" TEXT PRIMARY KEY, "at" INTEGER NOT NULL)');
  const done = new Set((sqlite.prepare('SELECT name FROM "_migrations"').all() as { name: string }[]).map((r) => r.name));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    sqlite.transaction(() => {
      sqlite.exec(readFileSync(resolve(dir, f), "utf8"));
      sqlite.prepare('INSERT INTO "_migrations" (name, at) VALUES (?, ?)').run(f, Date.now());
    })();
    applied.push(f);
  }
  return applied;
}
`;
  }
  return `// Postgres через pg. DATABASE_URL=postgres://user:pass@host:5432/db
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

/** Применить SQL-миграции из drizzle/ по порядку, один раз каждую. */
export async function migrate(dir = resolve(process.env.MIGRATIONS_DIR ?? "drizzle")): Promise<string[]> {
  await pool.query('CREATE TABLE IF NOT EXISTS "_migrations" ("name" TEXT PRIMARY KEY, "at" TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await pool.query<{ name: string }>('SELECT name FROM "_migrations"')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(readFileSync(resolve(dir, f), "utf8"));
      await client.query('INSERT INTO "_migrations" (name) VALUES ($1)', [f]);
      await client.query("COMMIT");
      applied.push(f);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  return applied;
}
`;
}

const MIGRATE = `import "dotenv/config";
import { migrate } from "./db.js";

const applied = await migrate();
console.log(applied.length ? \`Применены миграции: \${applied.join(", ")}\` : "Схема актуальна");
process.exit(0);
`;

const INDEX = `// Сервер: API для Mini App + бот. Секреты только из .env.
import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { and, desc, eq } from "drizzle-orm";
import { Bot, InlineKeyboard } from "grammy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, migrate } from "./db.js";
import type { TgUser } from "./initData.js";
import { checkInitData } from "./initData.js";
import type { FieldMeta } from "./schema.js";
import { registry } from "./schema.js";

const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
const WEBAPP_URL = process.env.WEBAPP_URL ?? "";
const PORT = Number(process.env.PORT ?? 3000);
/** Только для локальной отладки в обычном браузере: пускать без initData как пользователя 0. */
const DEV_NO_AUTH = process.env.DEV_NO_AUTH === "1";

type Project = { title: string; bot?: { name: string; commands: { command: string; description: string }[] } };
const project = JSON.parse(readFileSync(resolve(process.env.PROJECT_JSON ?? "../project.json"), "utf8")) as Project;

type Entry = { table: any; fields: readonly FieldMeta[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
const tables = registry as unknown as Record<string, Entry>;

const app = new Hono<{ Variables: { user: TgUser } }>();

// Если фронтенд живёт на другом адресе (GitHub Pages), разрешаем запросы только с него.
if (WEBAPP_URL) {
  app.use("/api/*", cors({ origin: new URL(WEBAPP_URL).origin, allowHeaders: ["Content-Type", "X-Telegram-Init-Data"], allowMethods: ["GET", "POST", "DELETE"] }));
}

/** Строка БД → объект с именами полей из project.json. */
function toApi(entry: Entry, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { id: row.id, createdAt: row.createdAt };
  for (const f of entry.fields) out[f.name] = row[f.key];
  return out;
}

app.use("/api/*", async (c, next) => {
  const user = checkInitData(c.req.header("X-Telegram-Init-Data") ?? "", BOT_TOKEN);
  if (user) c.set("user", user);
  else if (DEV_NO_AUTH) c.set("user", { id: 0, first_name: "dev" });
  else return c.json({ error: "Нет или неверная подпись initData" }, 401);
  await next();
});

app.get("/api/me", (c) => c.json(c.get("user")));

app.get("/api/:table", async (c) => {
  const entry = tables[decodeURIComponent(c.req.param("table"))];
  if (!entry) return c.json({ error: "Нет такой таблицы" }, 404);
  const t = entry.table;
  const rows = await db.select().from(t).where(eq(t.userId, c.get("user").id)).orderBy(desc(t.id)).limit(200);
  return c.json((rows as Record<string, unknown>[]).map((r) => toApi(entry, r)));
});

function parseValue(f: FieldMeta, v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (f.type === "number" || f.type === "ref") {
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) throw new Error(\`«\${f.name}» — нужно число\`);
    return n;
  }
  if (f.type === "boolean") return v === true || v === "true" || v === 1 || v === "1";
  return String(v).slice(0, 5000);
}

app.get("/api/:table/:id", async (c) => {
  const entry = tables[decodeURIComponent(c.req.param("table"))];
  if (!entry) return c.json({ error: "Нет такой таблицы" }, 404);
  const t = entry.table;
  const [row] = (await db.select().from(t).where(and(eq(t.id, Number(c.req.param("id"))), eq(t.userId, c.get("user").id)))) as Record<string, unknown>[];
  return row ? c.json(toApi(entry, row)) : c.json({ error: "Запись не найдена" }, 404);
});

app.post("/api/:table", async (c) => {
  const entry = tables[decodeURIComponent(c.req.param("table"))];
  if (!entry) return c.json({ error: "Нет такой таблицы" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const row: Record<string, unknown> = { userId: c.get("user").id };
  try {
    for (const f of entry.fields) {
      const v = parseValue(f, body[f.name]);
      if (f.required && v === null) throw new Error(\`Заполните поле «\${f.name}»\`);
      row[f.key] = v;
    }
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  const created = ((await db.insert(entry.table).values(row).returning()) as unknown as Record<string, unknown>[])[0];
  return c.json(created ? toApi(entry, created) : null, 201);
});

app.delete("/api/:table/:id", async (c) => {
  const entry = tables[decodeURIComponent(c.req.param("table"))];
  if (!entry) return c.json({ error: "Нет такой таблицы" }, 404);
  const t = entry.table;
  await db.delete(t).where(and(eq(t.id, Number(c.req.param("id"))), eq(t.userId, c.get("user").id)));
  return c.body(null, 204);
});

// Собранный фронтенд.
const dist = process.env.APP_DIST ?? "../app/dist";
app.use("/*", serveStatic({ root: dist }));
app.get("*", serveStatic({ path: \`\${dist}/index.html\` }));

await migrate();
serve({ fetch: app.fetch, port: PORT }, (i) => console.log(\`API и приложение: http://localhost:\${i.port}\`));

if (BOT_TOKEN) {
  const bot = new Bot(BOT_TOKEN);
  const open = () => (WEBAPP_URL ? new InlineKeyboard().webApp("Открыть", WEBAPP_URL) : undefined);
  bot.command("start", (ctx) =>
    ctx.reply(WEBAPP_URL ? \`\${project.title}: нажмите «Открыть».\` : "WEBAPP_URL не задан в .env", { reply_markup: open() }),
  );
  for (const cmd of project.bot?.commands ?? []) {
    if (cmd.command === "start") continue;
    bot.command(cmd.command, (ctx) => ctx.reply(cmd.description || cmd.command, { reply_markup: open() }));
  }
  bot.catch((e) => console.error("Ошибка бота:", e.message));
  const commands = (project.bot?.commands ?? []).filter((c) => /^[a-z0-9_]{1,32}$/.test(c.command));
  await bot.api.setMyCommands(commands.length ? commands.map((c) => ({ command: c.command, description: c.description || c.command })) : [{ command: "start", description: "Открыть приложение" }]).catch(() => {});
  if (WEBAPP_URL.startsWith("https://")) {
    await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Открыть", web_app: { url: WEBAPP_URL } } }).catch(() => {});
  }
  bot.start({ onStart: (me) => console.log(\`Бот @\${me.username} запущен\`) }).catch((e: Error) => console.error("Бот не запустился:", e.message));
} else {
  console.log("BOT_TOKEN не задан — бот не запущен, работает только API.");
}
`;

const DRIZZLE_CONFIG = (d: Dialect) => `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Для следующих миграций: npx drizzle-kit generate
export default defineConfig({
  dialect: "${d === "sqlite" ? "sqlite" : "postgresql"}",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "${d === "sqlite" ? "file:./data.db" : "postgres://localhost:5432/app"}" },
});
`;

export function serverFiles(p: Project, d: Dialect): Record<string, string> {
  const tables = p.data?.tables ?? [];
  return {
    "server/package.json": serverPackage(d),
    "server/tsconfig.json": TSCONFIG,
    "server/src/index.ts": INDEX,
    "server/src/db.ts": dbFile(d),
    "server/src/migrate.ts": MIGRATE,
    "server/src/schema.ts": drizzleSchema(tables, d),
    "server/src/initData.ts": INIT_DATA,
    "server/src/initData.test.ts": INIT_DATA_TEST,
    "server/drizzle/0000_init.sql": migrationSql(tables, d),
    "server/drizzle.config.ts": DRIZZLE_CONFIG(d),
  };
}
