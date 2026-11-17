// Режим «Запустить»: проход сценария как в живом приложении.
import type { MotionValue } from "motion/react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import type { PointerEvent as RPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Tokens } from "../../lib/color";
import { telegramTokens, TELEGRAM_THEMES, themeTokens } from "../../lib/color";
import { screenSize } from "../../lib/devices";
import type { Element, Swipe, TransitionKind } from "../../lib/model";
import { elementsOf } from "../../lib/ops";
import type { Direction, Pose } from "../../lib/transitions";
import {
  DURATION_MS,
  EASE_STANDARD,
  EXPRESSIVE_SPRING,
  lerp,
  lerpPose,
  posesFor,
  SWIPE_TRANSITION,
  swipeCommits,
  swipeDirection,
  swipeProgress,
  TRANSITION_SHORT,
} from "../../lib/transitions";
import { useEditor } from "../../store/editor";
import { prefersReducedMotion } from "../canvas/gestures";
import { Icon } from "../Icon";
import { useSandbox } from "./sandbox";
import { useRunBus } from "./runBus";
import type { RunHandlers } from "./RunScreen";
import { RunScreen } from "./RunScreen";
import { tr } from "../../lib/i18n";

/** records — выбранные записи по таблицам (параметры экрана): таблица → id записи. */
type Records = Record<string, string>;
type Step = { id: string; via: TransitionKind; records?: Records };
type Anim = { from: string; to: string; kind: TransitionKind; dir: Direction; swipe?: boolean; fromRecords?: Records; toRecords?: Records };
export type PreviewTheme = "project" | "tg-light" | "tg-dark";

function Layer({
  progress,
  from,
  to,
  w,
  h,
  z,
  children,
}: {
  progress: MotionValue<number>;
  from: Pose;
  to: Pose;
  w: number;
  h: number;
  z: number;
  children: React.ReactNode;
}) {
  const transform = useTransform(progress, (t) => {
    const p = lerpPose(from, to, t);
    return `translate(${p.x * w}px, ${p.y * h}px) scale(${p.scale})`;
  });
  const opacity = useTransform(progress, (t) => lerpPose(from, to, t).opacity);
  return (
    <motion.div
      style={{ position: "absolute", inset: 0, transform, opacity, zIndex: z, transformOrigin: "50% 50%", boxShadow: z === 2 ? "0 0 28px rgba(0,0,0,.14)" : undefined }}
    >
      {children}
    </motion.div>
  );
}

export function RunView() {
  const project = useEditor((s) => s.project);
  const activeScreen = useEditor((s) => s.activeScreen);
  const [stack, setStack] = useState<Step[]>(() => [{ id: activeScreen, via: "none" }]);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [highlight, setHighlight] = useState(false);
  const [flash, setFlash] = useState(0);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("project");
  const progress = useMotionValue(0);
  const animRef = useRef<{ stop: () => void; finish: () => void } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 800, h: 600 });
  const reduced = prefersReducedMotion();
  const projectId = useEditor((s) => s.projectId);
  const sandbox = useSandbox(project, projectId);

  const tokens: Tokens = useMemo(() => {
    if (previewTheme === "tg-light") return telegramTokens(TELEGRAM_THEMES.light);
    if (previewTheme === "tg-dark") return telegramTokens(TELEGRAM_THEMES.dark);
    return themeTokens(project.theme);
  }, [previewTheme, project.theme]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byId = useMemo(() => new Map(project.screens.map((s) => [s.id, s])), [project.screens]);
  // Экран удалили во время запуска — начинаем с первого.
  const top = stack[stack.length - 1]!;
  const current = byId.has(top.id) ? top : { id: project.screens[0]?.id ?? top.id, via: "none" as TransitionKind };

  useEffect(() => {
    useRunBus.setState({ current: current.id, visited: [...new Set([...useRunBus.getState().visited, ...stack.map((s) => s.id)])] });
  }, [current.id, stack]);
  useEffect(() => () => useRunBus.setState({ current: null, visited: [], jump: null }), []);
  const jump = useRunBus((s) => s.jump);
  useEffect(() => {
    if (jump) go(jump.id, "fade");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  const sizeOf = useCallback((id: string) => {
    const s = byId.get(id);
    return s ? screenSize(project, s) : { w: 390, h: 780 };
  }, [byId, project]);

  const finishNow = () => animRef.current?.finish();

  const run = (next: Anim, onDone: () => void, fromProgress = 0, target = 1) => {
    finishNow();
    setAnim(next);
    progress.jump(fromProgress);
    const instant = next.kind === "none";
    const opts = reduced || instant
      ? { duration: instant ? 0 : 0.12 }
      : project.theme.motion === "expressive"
        ? EXPRESSIVE_SPRING
        : { duration: DURATION_MS / 1000, ease: EASE_STANDARD as unknown as [number, number, number, number] };
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      animRef.current = null;
      onDone();
      setAnim(null);
      progress.jump(0);
    };
    const ctl = animate(progress, target, opts);
    animRef.current = { stop: () => ctl.stop(), finish: () => { ctl.stop(); complete(); } };
    ctl.then(complete, complete);
  };

  const go = (to: string, kind: TransitionKind, records: Records | undefined = current.records) => {
    if (!byId.has(to) || (to === current.id && records === current.records)) return;
    // Свайп/«назад» с reduced motion → только растворение.
    const k = reduced && kind !== "none" ? "fade" : kind;
    run({ from: current.id, to, kind: k, dir: "forward", fromRecords: current.records, toRecords: records }, () =>
      setStack((s) => [...s, { id: to, via: k, records }]),
    );
  };

  const back = () => {
    if (stack.length < 2) return;
    const top = stack[stack.length - 1]!;
    const prev = stack[stack.length - 2]!;
    run({ from: top.id, to: prev.id, kind: top.via, dir: "back", fromRecords: top.records, toRecords: prev.records }, () => setStack((s) => s.slice(0, -1)));
  };

  const onAction = (el: Element, rowIndex?: number) => {
    const a = el.action;
    if (!a) {
      if (el.kind === "backButton") return back();
      if (el.bind?.mode === "form") return;
      return;
    }
    if ("back" in a) return back();
    if ("open" in a) {
      window.open(a.url, "_blank", "noopener");
      return;
    }
    // Нажатие на строку списка, привязанного к таблице, передаёт эту запись следующему экрану.
    if (el.bind?.mode === "list" && rowIndex !== undefined) {
      const rowId = sandbox.rowIdAt(el, rowIndex);
      if (rowId) return go(a.to, a.transition, { ...current.records, [el.bind.table]: rowId });
    }
    go(a.to, a.transition);
  };

  const handlers: RunHandlers = { onAction, rowsFor: sandbox.rowsFor, renderForm: sandbox.renderForm, valueFor: sandbox.valueFor };

  // ---------- Свайп «за пальцем» ----------
  const swipe = useRef<{ x: number; y: number; t: number; dir: keyof Swipe | null; target: string | null; back: boolean; w: number; h: number } | null>(null);

  const onPointerDown = (e: RPointerEvent) => {
    if (anim) finishNow();
    const { w, h } = sizeOf(current.id);
    swipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), dir: null, target: null, back: false, w, h };
  };

  const onPointerMove = (e: RPointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const scale = frameScale;
    const dx = (e.clientX - s.x) / scale;
    const dy = (e.clientY - s.y) / scale;
    if (!s.dir) {
      const dir = swipeDirection(dx, dy);
      if (!dir) return;
      s.dir = dir;
      const scr = byId.get(current.id);
      const target = scr?.swipe?.[dir];
      if (target && target !== current.id) {
        s.target = target;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setAnim({ from: current.id, to: target, kind: SWIPE_TRANSITION[dir], dir: "forward", swipe: true, fromRecords: current.records, toRecords: current.records });
      } else if (dir === "right" && stack.length > 1 && stack[stack.length - 1]!.via !== "none") {
        // Свайп вправо без настройки — «назад», если пришли сдвигом.
        const top = stack[stack.length - 1]!;
        s.back = true;
        s.target = stack[stack.length - 2]!.id;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setAnim({ from: top.id, to: s.target, kind: top.via, dir: "back", swipe: true, fromRecords: top.records, toRecords: stack[stack.length - 2]!.records });
      } else {
        swipe.current = null;
        return;
      }
    }
    if (!s.target || !s.dir) return;
    const dir = s.back ? backDir(stack[stack.length - 1]!.via) : s.dir;
    progress.jump(swipeProgress(dir, dx, dy, s.w, s.h));
  };

  const onPointerUp = (e: RPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s?.target || !s.dir) return;
    const dt = Math.max(1, performance.now() - s.t) / 1000;
    const dx = (e.clientX - s.x) / frameScale;
    const dy = (e.clientY - s.y) / frameScale;
    const dir = s.back ? backDir(stack[stack.length - 1]!.via) : s.dir;
    const p = swipeProgress(dir, dx, dy, s.w, s.h);
    const along = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
    const commit = swipeCommits(p, along / dt, dir === "left" || dir === "right" ? s.w : s.h);
    const a = anim ?? { from: current.id, to: s.target, kind: SWIPE_TRANSITION[s.dir], dir: s.back ? "back" : "forward" };
    const target = s.target;
    const isBack = s.back;
    run(
      a as Anim,
      () => {
        if (!commit) return;
        if (isBack) setStack((st) => st.slice(0, -1));
        else setStack((st) => [...st, { id: target, via: SWIPE_TRANSITION[s.dir!], records: st[st.length - 1]?.records }]);
      },
      p,
      commit ? 1 : 0,
    );
  };

  // ---------- Размер рамки: плавно между устройствами ----------
  const fromSize = anim ? sizeOf(anim.from) : sizeOf(current.id);
  const toSize = anim ? sizeOf(anim.to) : fromSize;
  const maxW = Math.max(fromSize.w, toSize.w);
  const maxH = Math.max(fromSize.h, toSize.h);
  const frameScale = Math.min(1, (avail.w - 32) / maxW, (avail.h - 120) / maxH);
  const frameW = useTransform(progress, (t) => lerp(fromSize.w, toSize.w, t) * frameScale);
  const frameH = useTransform(progress, (t) => lerp(fromSize.h, toSize.h, t) * frameScale);

  const renderScreen = (id: string, records: Records | undefined) => {
    const s = byId.get(id);
    if (!s) return null;
    const { w, h } = sizeOf(id);
    return (
      <RunScreen
        screen={s}
        elements={elementsOf(project, id)}
        tokens={tokens}
        w={w}
        h={h}
        highlight={highlight || flash > 0}
        handlers={handlers}
        records={records}
      />
    );
  };

  const poses = anim ? posesFor(anim.kind, anim.dir) : null;
  const layerSize = (id: string) => sizeOf(id);

  return (
    <div className="runview" ref={boxRef}>
      <div className="run-bar">
        <button className="btn sm ghost-line" disabled={stack.length < 2} onClick={back} title={tr("Назад")}>
          <Icon name="back" size={16} /> {tr("Назад")}
        </button>
        <button className={`btn sm${highlight ? " on" : ""}`} onClick={() => setHighlight(!highlight)} title={tr("Подсветить кликабельные зоны")}>
          {tr("Зоны")}
        </button>
        <select className="input" style={{ width: "auto" }} value={previewTheme} onChange={(e) => setPreviewTheme(e.target.value as PreviewTheme)} title={tr("Цвета превью")}>
          <option value="project">{tr("Тема проекта")}</option>
          <option value="tg-light">{tr("Telegram светлая")}</option>
          <option value="tg-dark">{tr("Telegram тёмная")}</option>
        </select>
        <button
          className="btn sm"
          onClick={() => {
            finishNow();
            setStack([{ id: project.screens[0]!.id, via: "none" }]);
          }}
          title={tr("С первого экрана")}
        >
          {tr("⟲ Сначала")}
        </button>
        {sandbox.toolbar}
      </div>
      <motion.div
        className="run-frame"
        style={{ width: frameW, height: frameH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          const t = e.target as HTMLElement;
          if (!t.closest(".run-el.clickable")) {
            setFlash((f) => f + 1);
            setTimeout(() => setFlash((f) => f - 1), 500);
          }
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: maxW, height: maxH, transform: `scale(${frameScale})`, transformOrigin: "0 0" }}>
          {anim && poses ? (
            <>
              <Layer progress={progress} from={poses.outgoing.from} to={poses.outgoing.to} w={layerSize(anim.from).w} h={layerSize(anim.from).h} z={poses.incomingOnTop ? 1 : 2}>
                {renderScreen(anim.from, anim.fromRecords)}
              </Layer>
              <Layer progress={progress} from={poses.incoming.from} to={poses.incoming.to} w={layerSize(anim.to).w} h={layerSize(anim.to).h} z={poses.incomingOnTop ? 2 : 1}>
                {renderScreen(anim.to, anim.toRecords)}
              </Layer>
            </>
          ) : (
            renderScreen(current.id, current.records)
          )}
        </div>
      </motion.div>
      <ol className="run-path" aria-label={tr("Путь")}>
        {stack.map((s, i) => (
          <li key={i}>
            {i > 0 && <span className="hint">{TRANSITION_SHORT[s.via]}</span>}
            <button
              className={`btn sm${i === stack.length - 1 ? " on" : ""}`}
              onClick={() => {
                finishNow();
                setStack(stack.slice(0, i + 1));
              }}
            >
              {byId.get(s.id)?.name ?? "?"}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Направление пальца для «назад»: противоположно направлению входа. */
function backDir(via: TransitionKind): keyof Swipe {
  if (via === "slideRight") return "left";
  if (via === "slideUp") return "down";
  if (via === "slideDown") return "up";
  return "right";
}

