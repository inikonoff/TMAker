// Полный набор файлов экспорта. Чистая функция: картинки и скриншоты передаются байтами.
import type { Project } from "../model";
import { buildAgents, buildClaudeMd } from "./agents";
import { buildPrompt, screenSlugs } from "./prompt";
import { appFiles } from "./scaffoldApp";
import { serverFiles } from "./scaffoldServer";
import type { Dialect } from "./sql";

export type ExportOptions = {
  scaffold: boolean;
  dialect: Dialect;
  /** idb-ссылка → байты и расширение. */
  images: Map<string, { data: Uint8Array; ext: string }>;
  /** id экрана → PNG. */
  screenshots: Map<string, Uint8Array>;
};

export type ExportFiles = Record<string, string | Uint8Array>;

/** project.json для экспорта: idb-ссылки заменены на пути assets/images/… */
export function exportProject(p: Project, images: ExportOptions["images"]): { project: Project; paths: Map<string, string> } {
  const paths = new Map<string, string>();
  for (const [ref, img] of images) paths.set(ref, `assets/images/${ref.slice(4)}.${img.ext}`);
  const project = structuredClone(p);
  for (const e of project.elements) {
    const ref = e.content?.image;
    if (ref?.startsWith("idb:")) {
      const path = paths.get(ref);
      if (path) e.content!.image = path;
      else delete e.content!.image;
    }
  }
  return { project, paths };
}

function readme(p: Project, o: ExportOptions): string {
  const base = `# ${p.title}

Telegram Mini App, экспортировано из TMA Builder.

- \`PROMPT.md\` — описание экранов, элементов и переходов.
- \`AGENTS.md\`, \`CLAUDE.md\` — инструкции для языковой модели.
- \`project.json\` — исходный макет (можно открыть обратно в TMA Builder).
- \`screens/\` — скриншоты экранов, \`assets/images/\` — картинки.
`;
  if (!o.scaffold) return base;
  const pg = o.dialect === "postgres";
  return `${base}- \`app/\` — фронтенд (Vite + React + TypeScript + Telegram WebApp SDK).
- \`server/\` — API (Hono) и бот (grammY), база через Drizzle (${pg ? "Postgres" : "SQLite"}).

## Запуск локально

Нужен Node.js 22+.

\`\`\`bash
cp .env.example server/.env
cd server && npm install && npm run migrate && npm test
cd ../app && npm install && npm run build
cd ../server && npm run dev
\`\`\`

Откройте http://localhost:3000. В обычном браузере у запросов нет \`initData\`, поэтому для отладки
поставьте в \`server/.env\` строку \`DEV_NO_AUTH=1\` (только локально!).

Во время разработки фронтенда удобнее \`cd app && npm run dev\` (Vite проксирует \`/api\` на порт 3000).

## Бот

1. Создайте бота у [@BotFather](https://t.me/BotFather), токен впишите в \`server/.env\` → \`BOT_TOKEN\`.
2. Mini App должен открываться по HTTPS. Для теста подойдёт туннель (\`cloudflared tunnel --url http://localhost:3000\`
   или \`ngrok http 3000\`). Адрес впишите в \`WEBAPP_URL\`.
3. Перезапустите сервер: бот ответит на /start кнопкой «Открыть» и поставит кнопку меню.

## Деплой

\`\`\`bash
docker build -t ${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tma-app"} .
docker run -p 3000:3000 --env-file server/.env ${pg ? "" : "-v $(pwd)/data:/srv/server/data "}<образ>
\`\`\`

Подойдёт любой хостинг контейнеров (Fly.io, Railway, Render, VPS). ${pg ? "Нужна база Postgres: задайте `DATABASE_URL`." : "SQLite хранится в томе `/srv/server/data` — подключите постоянный диск. Для нескольких реплик перейдите на Postgres (экспорт с опцией Postgres)."}
После деплоя укажите публичный HTTPS-адрес в \`WEBAPP_URL\` и в @BotFather (Bot Settings → Menu Button).

## Безопасность

- Токен бота и строки подключения — только в \`.env\`, файл не коммитить.
- Сервер проверяет подпись \`initData\` на каждом запросе к \`/api\` (\`server/src/initData.ts\`), данные изолированы по \`user_id\`.
`;
}

const ENV = (d: Dialect) => `# Скопируйте в server/.env и заполните. Этот файл без секретов.
BOT_TOKEN=
WEBAPP_URL=https://example.com
DATABASE_URL=${d === "sqlite" ? "file:./data/app.db" : "postgres://user:password@localhost:5432/app"}
PORT=3000
# Только для локальной отладки без Telegram:
# DEV_NO_AUTH=1
`;

const GITIGNORE = `node_modules
dist
.env
*.db
*.db-*
server/data
`;

const DOCKERFILE = `# Сборка фронтенда и сервера в один образ.
FROM node:22-slim AS build
WORKDIR /src
COPY project.json ./
COPY assets ./assets
COPY app ./app
RUN cd app && npm install && npm run build
COPY server ./server
RUN cd server && npm install && npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /srv
COPY --from=build /src/project.json ./project.json
COPY --from=build /src/app/dist ./app/dist
COPY --from=build /src/server ./server
WORKDIR /srv/server
RUN mkdir -p data
ENV NODE_ENV=production PORT=3000 PROJECT_JSON=../project.json APP_DIST=../app/dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;

export function buildExportFiles(p: Project, o: ExportOptions): ExportFiles {
  const { project, paths } = exportProject(p, o.images);
  const files: ExportFiles = {
    "project.json": JSON.stringify(project, null, 2) + "\n",
    "PROMPT.md": buildPrompt(project),
    "AGENTS.md": buildAgents(project, { scaffold: o.scaffold }),
    "CLAUDE.md": buildClaudeMd(),
    "README.md": readme(project, o),
    "assets/images/.gitkeep": "",
  };
  for (const [ref, img] of o.images) files[paths.get(ref)!] = img.data;
  const slugs = screenSlugs(project);
  for (const [id, png] of o.screenshots) {
    const name = slugs.get(id);
    if (name) files[`screens/${name}.png`] = png;
  }
  if (o.scaffold) {
    Object.assign(files, appFiles(project), serverFiles(project, o.dialect));
    files[".env.example"] = ENV(o.dialect);
    files[".gitignore"] = GITIGNORE;
    files["Dockerfile"] = DOCKERFILE;
    files["server/data/.gitkeep"] = "";
  }
  return files;
}
