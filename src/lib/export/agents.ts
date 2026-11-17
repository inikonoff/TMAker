// AGENTS.md и CLAUDE.md: инструкции для агента (Claude Code и др.), открывшего папку экспорта.
import type { Project } from "../model";

export function buildAgents(p: Project, opts: { scaffold: boolean }): string {
  const hasData = (p.data?.tables.length ?? 0) > 0;
  return `# Инструкции для агента

Проект «${p.title}» — Telegram Mini App. Экраны нарисованы в визуальном конструкторе TMA Builder.

## Что лежит в папке

- \`project.json\` — **источник правды**: экраны, элементы с координатами, стили, переходы, тема${hasData ? ", схема данных" : ""}. Формат описан ниже.
- \`PROMPT.md\` — то же самое текстом: читай его первым, чтобы понять задачу.
- \`screens/*.png\` — скриншоты экранов (как задумано визуально).
- \`images/\` — картинки, на которые ссылается \`project.json\` (\`content.image\`).
${opts.scaffold ? "- `app/` — фронтенд (Vite + React + TS + Telegram WebApp SDK), уже рендерит экраны из `project.json`.\n- `server/` — бот и API (grammY + Drizzle + SQLite/Postgres), проверка `initData`.\n" : ""}
## Задача по умолчанию

${opts.scaffold
    ? "Заготовка уже запускается (см. README.md). Доведи её до рабочего приложения: замени абсолютное позиционирование на адаптивную вёрстку там, где это уместно, подключи данные к API, сохрани визуальный стиль со скриншотов."
    : "Сверстай Mini App по `project.json` и скриншотам: Vite + React + TypeScript, `@twa-dev/sdk` или `window.Telegram.WebApp`."}

## Правила

1. Сохраняй структуру экранов, тексты и переходы из \`project.json\`. Если меняешь — объясни почему.
2. Координаты в \`project.json\` — макет на устройстве указанного размера. В коде предпочитай flex/grid, но визуально держись макета.
3. Цвета \`$accent\`, \`$bg\`, \`$text\` и т. п. — токены темы. В Telegram бери \`themeParams\` (\`bg_color\`, \`text_color\`, \`button_color\`, \`button_text_color\`, \`secondary_bg_color\`, \`hint_color\`), токены из PROMPT.md — запасные значения.
4. Элементы \`mainButton\` и \`backButton\` — это нативные \`Telegram.WebApp.MainButton\` и \`BackButton\`, не рисуй их HTML-кнопками.
5. Переходы: \`slideLeft\` = новый экран приходит справа, «назад» играет тот же переход в обратную сторону. Длительность ~420 мс, кривая \`cubic-bezier(0.2, 0, 0, 1)\`. Уважай \`prefers-reduced-motion\`.
6. Секреты (токен бота, ключи) — только в \`.env\`, никогда в коде и в \`project.json\`.
7. На сервере всегда проверяй \`initData\` (HMAC-SHA256 c ключом от \`BOT_TOKEN\`) перед доступом к данным пользователя.

## Формат project.json (кратко)

\`\`\`ts
type Project = {
  version: number; title: string; brief: string;
  device: "phone" | "telegram" | "tablet" | { w: number; h: number };
  theme: { mode: "light" | "dark"; darkLevel: number; accent: string; radius: number; motion: "standard" | "expressive" };
  screens: { id: string; name: string; x: number; y: number; bg: string; note: string; device?: Device;
             swipe?: { left?: string; right?: string; up?: string; down?: string } }[];
  elements: { id: string; screenId: string; kind: string; x: number; y: number; w: number; h: number; z: number;
              style: { fill; stroke: { style; width; color }; radius; shadow; opacity; textColor; fontSize; fontWeight; align };
              content?: { text?; image?; imageFit?; items?; links?; checked?; value?; placeholder?; shape?; sides? };  // links — экран для каждого пункта nav/tabs
              action?: { to: string; transition: string } | { back: true } | { open: "link"; url: string };
              bind?: { table: string; mode: "list" | "form" | "value" | "record"; field?: string };
              arrow?: { from: { el?: string; x; y }; to: { el?: string; x; y }; head: "none" | "end" | "both" } }[];
  data?: { tables: { name: string; fields: { name: string; type: "text"|"number"|"boolean"|"date"|"image"|"ref"; required: boolean; ref?: string }[] }[] };
  bot?: { name: string; commands: { command: string; description: string }[] };
};
\`\`\`

Координаты элементов — относительно левого верхнего угла своего экрана. \`z\` — порядок слоёв.

### Данные и параметры экранов

- \`bind.mode: "list"\` — список записей таблицы (новые сверху), показывается \`field\` или первое текстовое поле.
- \`bind.mode: "form"\` — форма добавления записи со всеми полями таблицы.
- \`bind.mode: "value"\` — одно значение: \`field\` последней записи, без \`field\` — число записей.
- \`bind.mode: "record"\` — поле **выбранной записи**. Запись выбирается нажатием на строку списка, у которого есть
  \`action.to\`: экран открывается с параметром (например, \`/tasks/:id\`), а элементы с \`record\` показывают её поля.
`;
}

export function buildClaudeMd(): string {
  return `# CLAUDE.md

Прочитай \`AGENTS.md\` — там задача, правила и формат \`project.json\`. Затем \`PROMPT.md\` и скриншоты в \`screens/\`.

Перед правками запусти проект по README.md и убедись, что он собирается. Работай небольшими шагами, после каждого — сборка и тесты.
`;
}
