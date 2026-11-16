// История правок снимками. Чистая логика без React.

export const HISTORY_LIMIT = 100;
export const MERGE_MS = 800;

export type History<T> = {
  past: T[];
  future: T[];
  /** Ключ и время последней записи — для слияния повторных правок одного поля. */
  lastKey: string | null;
  lastAt: number;
};

export function createHistory<T>(): History<T> {
  return { past: [], future: [], lastKey: null, lastAt: 0 };
}

/**
 * Записать состояние ДО правки. Если key совпадает с прошлым и прошло < 800 мс —
 * шаг сливается (снимок не добавляется), чтобы ввод в поле был одним шагом отмены.
 */
export function record<T>(h: History<T>, before: T, key: string | null = null, now = Date.now()): History<T> {
  if (key !== null && key === h.lastKey && now - h.lastAt < MERGE_MS) {
    return { ...h, lastAt: now, future: [] };
  }
  const past = [...h.past, before];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [current, ...h.future], lastKey: null, lastAt: 0 },
    state: prev,
  };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const next = h.future[0];
  if (next === undefined) return null;
  return {
    history: { past: [...h.past, current], future: h.future.slice(1), lastKey: null, lastAt: 0 },
    state: next,
  };
}

/** Разорвать слияние: следующая правка с тем же ключом станет новым шагом. */
export function breakMerge<T>(h: History<T>): History<T> {
  return { ...h, lastKey: null, lastAt: 0 };
}
