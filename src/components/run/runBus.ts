// Связь режима «Запустить» с остальным интерфейсом: текущий экран и запрос «открыть экран».
import { create } from "zustand";

type RunBus = {
  current: string | null;
  visited: string[];
  jump: { id: string; n: number } | null;
};

export const useRunBus = create<RunBus>()(() => ({ current: null, visited: [], jump: null }));

export function requestJump(id: string) {
  const j = useRunBus.getState().jump;
  useRunBus.setState({ jump: { id, n: (j?.n ?? 0) + 1 } });
}
