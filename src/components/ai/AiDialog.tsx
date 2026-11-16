// ИИ: настройки (ключ хранится только в этом браузере) и действия. Результат — черновик, который можно оставить или отменить.
import { useRef, useState } from "react";
import type { AiSettings, AiTask } from "../../lib/ai";
import { AiError, applySchemaDraft, applyScreenDraft, applyTextsDraft, buildMessages, chat, DEFAULT_BASE_URL, extractJson, GROQ_MODELS, listModels } from "../../lib/ai";
import { useEditor } from "../../store/editor";
import { focusScreen } from "../canvas/Canvas";
import { Icon } from "../Icon";

const KEY = "tma-builder:ai";

export function loadAi(): AiSettings {
  try {
    return { key: "", model: GROQ_MODELS[0]!, baseUrl: DEFAULT_BASE_URL, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { key: "", model: GROQ_MODELS[0]!, baseUrl: DEFAULT_BASE_URL };
  }
}

function saveAi(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим */
  }
}

const TASKS: { id: AiTask; label: string; hint: string; placeholder: string }[] = [
  { id: "screen", label: "Собрать экран", hint: "Новый экран по описанию. Раскладку делает конструктор.", placeholder: "Список задач с формой добавления" },
  { id: "schema", label: "Схема данных", hint: "Таблицы и поля по экранам проекта. Существующие не меняются.", placeholder: "Пожелания (необязательно)" },
  { id: "texts", label: "Тексты экрана", hint: "Переписать подписи активного экрана. Координаты не меняются.", placeholder: "Тон: дружелюбно, коротко" },
];

export function AiDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<AiSettings>(loadAi);
  const [models, setModels] = useState<string[]>(GROQ_MODELS);
  const [task, setTask] = useState<AiTask>("screen");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; kind?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(!s.key);
  const abort = useRef<AbortController | null>(null);
  const activeScreen = useEditor((st) => st.activeScreen);
  const t = TASKS.find((x) => x.id === task)!;

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveAi(next);
  };

  const check = async () => {
    setError(null);
    setBusy(true);
    try {
      const list = await listModels(s);
      if (list.length) setModels(list);
      useEditor.getState().showToast(`Соединение есть, моделей: ${list.length}`);
    } catch (e) {
      setError({ text: e instanceof AiError ? e.message : "Запрос не дошёл: вероятно, CORS. Укажите прокси.", kind: e instanceof AiError ? e.kind : "cors" });
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!s.key) return setSettingsOpen(true);
    if (task === "screen" && !prompt.trim()) return setError({ text: "Опишите экран" });
    setError(null);
    setBusy(true);
    abort.current = new AbortController();
    const st = useEditor.getState();
    try {
      const text = await chat(s, buildMessages(task, st.project, { prompt: prompt.trim(), screenId: activeScreen }), abort.current.signal);
      let raw: unknown;
      try {
        raw = extractJson(text);
      } catch {
        throw new AiError("Модель вернула не JSON. Попробуйте ещё раз или другую модель.", "parse");
      }
      const cur = useEditor.getState().project;
      const r = task === "screen" ? applyScreenDraft(cur, raw) : task === "schema" ? applySchemaDraft(cur, raw) : applyTextsDraft(cur, raw, activeScreen);
      useEditor.getState().replaceProject(r.project, { draft: true });
      useEditor.setState({ draftNote: r.summary });
      if (r.focusScreen) {
        useEditor.getState().setActiveScreen(r.focusScreen);
        requestAnimationFrame(() => focusScreen(r.focusScreen!));
      }
      onClose();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError({ text: (e as Error).message, kind: e instanceof AiError ? e.kind : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <div className="modal-head">
          <h2 id="ai-title">ИИ-помощник</h2>
          <span style={{ display: "flex", gap: 4 }}>
            <button className={`btn sm${settingsOpen ? " on" : ""}`} onClick={() => setSettingsOpen(!settingsOpen)} title="Настройки">
              <Icon name="settings" size={16} />
            </button>
            <button className="btn sm" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </span>
        </div>
        {settingsOpen && (
          <div className="ai-settings">
            <div className="row">
              <label>Ключ Groq</label>
              <input className="input" type="password" autoComplete="off" placeholder="gsk_…" value={s.key} onChange={(e) => update({ key: e.target.value.trim() })} />
            </div>
            <div className="row">
              <label>Модель</label>
              <input className="input" list="groq-models" value={s.model} onChange={(e) => update({ model: e.target.value })} />
              <datalist id="groq-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="row">
              <label title="Адрес OpenAI-совместимого API или вашего прокси">Base URL</label>
              <input className="input" value={s.baseUrl} onChange={(e) => update({ baseUrl: e.target.value.trim() || DEFAULT_BASE_URL })} />
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm ghost-line" disabled={!s.key || busy} onClick={check}>
                Проверить соединение
              </button>
              <a className="hint" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                Получить ключ
              </a>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Ключ хранится только в этом браузере и уходит только на указанный Base URL. Не публикуйте сборку с ключом.
            </p>
          </div>
        )}
        <div className="seg" style={{ margin: "12px 0 8px" }}>
          {TASKS.map((x) => (
            <button key={x.id} className={task === x.id ? "on" : ""} onClick={() => setTask(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {t.hint}
        </p>
        <textarea
          className="input"
          rows={3}
          value={prompt}
          placeholder={t.placeholder}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void run();
          }}
        />
        {error && (
          <div className="ai-error" role="alert">
            {error.text}
            {error.kind === "cors" && (
              <div className="hint">
                Разверните прокси из папки <code>proxy/</code> репозитория (Cloudflare Worker, 2 минуты) и впишите его адрес в Base URL.
              </div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn primary" disabled={busy} onClick={run}>
            <Icon name="ai" /> {busy ? "Думаю…" : "Сделать черновик"}
          </button>
          {busy && (
            <button className="btn ghost-line" onClick={() => abort.current?.abort()}>
              Остановить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Плашка черновика ИИ: оставить или отменить (отмена — один шаг). */
export function DraftBar() {
  const pending = useEditor((s) => s.pendingDraft);
  const note = useEditor((s) => s.draftNote);
  if (!pending) return null;
  return (
    <div className="draft-bar" role="status">
      <Icon name="ai" />
      <span>Черновик ИИ{note ? `: ${note}` : ""}</span>
      <button className="btn sm primary" onClick={() => useEditor.getState().acceptDraft()}>
        Оставить
      </button>
      <button className="btn sm ghost-line" onClick={() => useEditor.getState().rejectDraft()}>
        Отменить
      </button>
    </div>
  );
}
