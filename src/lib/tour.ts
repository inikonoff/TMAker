// Шаги обучения. target — значение data-tour у элемента интерфейса; без target — карточка по центру.
export type TourStep = {
  id: string;
  target?: string;
  title: string;
  text: string;
  /** Где показать подсказку относительно цели. */
  place?: "bottom" | "top" | "left" | "right";
};

export const TOUR: TourStep[] = [
  {
    id: "welcome",
    title: "Добро пожаловать в TMA Builder",
    text: "Здесь вы рисуете экраны мини-приложения для Telegram, связываете их переходами, проверяете сценарий и получаете готовый проект для VS Code и нейросети. Пройдём по интерфейсу за минуту.",
  },
  {
    id: "projects",
    target: "projects",
    title: "Проекты, шаблоны, версии",
    text: "Нажмите на название, чтобы открыть другой проект, начать новый из шаблона (список задач, магазин, запись) или сохранить версию и вернуться к ней позже.",
    place: "bottom",
  },
  {
    id: "screens",
    target: "screens",
    title: "Экраны",
    text: "Каждый экран — отдельная страница приложения. Плюс добавляет экран, перетаскивание за точки меняет порядок, двойной клик переименовывает. Ниже — размер устройства, свайпы и заметка для нейросети.",
    place: "right",
  },
  {
    id: "palette",
    target: "palette",
    title: "Элементы",
    text: "Кнопки, тексты, списки, формы, фигуры, стрелки и элементы Telegram. Нажмите — элемент встанет под последним, или перетащите его в нужное место экрана.",
    place: "right",
  },
  {
    id: "canvas",
    target: "canvas",
    title: "Холст",
    text: "Колесо мыши — масштаб, правая кнопка — двигать холст. Элементы перетаскиваются и тянутся за углы, сами притягиваются к краям и центрам. Двойной клик по кнопке или тексту — правка прямо на месте. Ctrl отключает привязку.",
    place: "left",
  },
  {
    id: "inspector",
    target: "inspector",
    title: "Свойства",
    text: "Без выделения здесь проект и тема (светлая, тёмная, акцент). С выделенным элементом — размеры, цвета, рамки, картинка, действие по нажатию («Перейти на экран», «Назад», ссылка) и привязка к данным.",
    place: "left",
  },
  {
    id: "flowmap",
    target: "flowmap",
    title: "Карта связей",
    text: "Схема переходов между экранами. Появляется, когда вы назначаете кнопкам действие «Перейти на экран». Клик по экрану на карте — перейти к нему.",
    place: "right",
  },
  {
    id: "data",
    target: "data",
    title: "Данные и бот",
    text: "Таблицы с полями (например, tasks: title, done) и команды бота. Списки показывают записи, формы их добавляют, а нажатие на строку списка открывает карточку записи.",
    place: "bottom",
  },
  {
    id: "ai",
    target: "ai",
    title: "ИИ-помощник",
    text: "Соберёт экран по описанию, предложит схему данных или перепишет тексты. Результат — черновик: его можно оставить или отменить. Нужен ключ Groq.",
    place: "bottom",
  },
  {
    id: "run",
    target: "run",
    title: "Запустить",
    text: "Проверьте сценарий как в живом приложении: нажатия, переходы, свайпы, «назад», данные в песочнице. Можно включить цвета Telegram — светлые или тёмные.",
    place: "bottom",
  },
  {
    id: "export",
    target: "export",
    title: "Экспорт",
    text: "Папка или ZIP для VS Code: описание экранов для нейросети, скриншоты и по желанию готовая заготовка — приложение, бот, API и база.",
    place: "bottom",
  },
  {
    id: "help",
    target: "help",
    title: "Помощь всегда здесь",
    text: "Эта кнопка снова запускает обучение. В меню «⋯» — горячие клавиши, язык и версии проекта. Удачи!",
    place: "bottom",
  },
];

/** Следующий видимый шаг в направлении dir; null — тур закончен. */
export function nextVisible(steps: TourStep[], from: number, dir: 1 | -1, isVisible: (target: string) => boolean): number | null {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i]!;
    if (!s.target || isVisible(s.target)) return i;
  }
  return null;
}

export type Box = { x: number; y: number; w: number; h: number };

/** Позиция карточки подсказки: рядом с целью, внутри окна. */
export function tipPosition(target: Box | null, tip: { w: number; h: number }, view: { w: number; h: number }, place: TourStep["place"] = "bottom", gap = 14): { x: number; y: number } {
  const clampX = (x: number) => Math.max(12, Math.min(view.w - tip.w - 12, x));
  const clampY = (y: number) => Math.max(12, Math.min(view.h - tip.h - 12, y));
  if (!target) return { x: clampX((view.w - tip.w) / 2), y: clampY((view.h - tip.h) / 2) };
  const fits = {
    bottom: target.y + target.h + gap + tip.h <= view.h,
    top: target.y - gap - tip.h >= 0,
    right: target.x + target.w + gap + tip.w <= view.w,
    left: target.x - gap - tip.w >= 0,
  };
  const order = [place, "bottom", "top", "right", "left"] as const;
  const p = order.find((o) => fits[o]) ?? "bottom";
  const cx = target.x + target.w / 2 - tip.w / 2;
  const cy = target.y + target.h / 2 - tip.h / 2;
  if (p === "bottom") return { x: clampX(cx), y: clampY(target.y + target.h + gap) };
  if (p === "top") return { x: clampX(cx), y: clampY(target.y - gap - tip.h) };
  if (p === "right") return { x: clampX(target.x + target.w + gap), y: clampY(cy) };
  return { x: clampX(target.x - gap - tip.w), y: clampY(cy) };
}
