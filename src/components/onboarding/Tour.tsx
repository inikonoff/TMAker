// Обучение: затемнение с «прожектором» на элементе интерфейса и карточка с подсказкой.
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { tr } from "../../lib/i18n";
import type { Box } from "../../lib/tour";
import { nextVisible, tipPosition, TOUR } from "../../lib/tour";
import { useEditor } from "../../store/editor";
import { setOnboarded } from "../../store/persist";
import { prefersReducedMotion } from "../canvas/gestures";

export const useTour = create<{ step: number | null }>()(() => ({ step: null }));

const PAD = 6;

function targetEl(t: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${t}"]`);
}

function isVisible(t: string): boolean {
  const el = targetEl(t);
  if (!el) return false;
  // Видим = отрисован (не display:none, например скрытая панель на телефоне). К цели прокручиваем перед показом.
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

export function startTour() {
  const st = useEditor.getState();
  if (st.mode !== "edit") st.setMode("edit");
  st.select([]);
  useTour.setState({ step: 0 });
}

function finish() {
  useTour.setState({ step: null });
  setOnboarded(true);
}

export function Tour() {
  const step = useTour((s) => s.step);
  const lang = useEditor((s) => s.lang);
  const [box, setBox] = useState<Box | null>(null);
  const [tipSize, setTipSize] = useState({ w: 340, h: 180 });
  const [view, setView] = useState({ w: innerWidth, h: innerHeight });
  const tipRef = useRef<HTMLDivElement>(null);
  const s = step === null ? null : TOUR[step];

  const measure = useCallback(() => {
    setView({ w: innerWidth, h: innerHeight });
    if (!s?.target) return setBox(null);
    const el = targetEl(s.target);
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    // Цель может быть выше окна (длинная панель) — обрезаем по видимой части.
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, innerHeight);
    setBox({ x: r.left - PAD, y: top - PAD, w: r.width + PAD * 2, h: bottom - top + PAD * 2 });
  }, [s]);

  useLayoutEffect(() => {
    if (!s) return;
    if (s.target) targetEl(s.target)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [s, measure, lang]);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (el) setTipSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [step, lang]);

  useEffect(() => {
    if (step === null) return;
    const go = (dir: 1 | -1) => {
      const n = nextVisible(TOUR, step, dir, isVisible);
      if (n === null) {
        if (dir === 1) finish();
      } else useTour.setState({ step: n });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", measure);
    };
  }, [step, measure]);

  if (step === null || !s) return null;
  const visibleSteps = TOUR.filter((x) => !x.target || isVisible(x.target));
  const index = visibleSteps.indexOf(s) + 1;
  const isLast = nextVisible(TOUR, step, 1, isVisible) === null;
  const prev = nextVisible(TOUR, step, -1, isVisible);
  const pos = tipPosition(box, tipSize, view, s.place);
  const t = prefersReducedMotion() ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 38 };

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Блокирует клики по интерфейсу, пока идёт обучение. */}
      <div className="tour-block" onPointerDown={(e) => e.preventDefault()} />
      <motion.div
        className="tour-spot"
        initial={false}
        animate={box ? { left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 12 } : { left: view.w / 2, top: view.h / 2, width: 0, height: 0, borderRadius: 0 }}
        transition={t}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          ref={tipRef}
          className="tour-tip"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, left: pos.x, top: pos.y }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion() ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="tour-count">{tr("Шаг {i} из {n}", { i: index, n: visibleSteps.length })}</div>
          <h3 id="tour-title">{tr(s.title)}</h3>
          <p>{tr(s.text)}</p>
          <div className="tour-actions">
            {!isLast && (
              <button className="btn sm" onClick={finish}>
                {tr("Пропустить")}
              </button>
            )}
            <span className="spacer" />
            {prev !== null && (
              <button className="btn sm ghost-line" onClick={() => useTour.setState({ step: prev })}>
                {tr("Назад")}
              </button>
            )}
            <button
              className="btn sm primary"
              autoFocus
              onClick={() => {
                const n = nextVisible(TOUR, step, 1, isVisible);
                if (n === null) finish();
                else useTour.setState({ step: n });
              }}
            >
              {isLast ? tr("Готово") : tr("Далее")}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
