import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DraftBar } from "./components/ai/DraftBar";
import { Canvas, fitAll } from "./components/canvas/Canvas";
import { useHotkeys } from "./components/hotkeys";
import { Inspector } from "./components/panels/Inspector";
import { FlowMap } from "./components/panels/FlowMap";
import { Palette } from "./components/panels/Palette";
import { ProjectPanel } from "./components/panels/ProjectPanel";
import { ScreensPanel } from "./components/panels/ScreensPanel";
import { RunView } from "./components/run/RunView";
import { Toolbar } from "./components/Toolbar";
import { Tour, startTour } from "./components/onboarding/Tour";
import { useEditor } from "./store/editor";
import { getPrefs } from "./store/persist";
import { tr } from "./lib/i18n";

type MobileTab = "screens" | "props" | null;

const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 440;

type PanelSide = "left" | "right";

function PanelResizeHandle({ side, label, width, onResize }: {
  side: PanelSide;
  label: string;
  width: number;
  onResize: (width: number) => void;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const direction = side === "left" ? 1 : -1;
  const panelId = `panel-${side}`;
  const resize = (width: number) => {
    const maxWidth = Math.min(MAX_PANEL_WIDTH, Math.floor(window.innerWidth * 0.35));
    onResize(Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, width)));
  };

  return (
    <div
      className={`panel-resize ${side}`}
      role="separator"
      aria-label={label}
      aria-controls={panelId}
      aria-orientation="vertical"
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={MAX_PANEL_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        const panel = document.getElementById(panelId);
        if (!panel) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus({ preventScroll: true });
        drag.current = { pointerId: event.pointerId, x: event.clientX, width: panel.offsetWidth };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start?.pointerId === event.pointerId) {
          resize(start.width + (event.clientX - start.x) * direction);
        }
      }}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        const currentWidth = document.getElementById(panelId)?.offsetWidth ?? width;
        resize(currentWidth + (event.key === "ArrowLeft" ? -10 : 10) * direction);
      }}
    />
  );
}

export function App() {
  const mode = useEditor((s) => s.mode);
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const editorTheme = useEditor((s) => s.editorTheme);
  const toast = useEditor((s) => s.toast);
  const loaded = useEditor((s) => s.loaded);
  const lang = useEditor((s) => s.lang);
  const [tab, setTab] = useState<MobileTab>(null);
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(280);
  const panelWidths = {
    "--left-panel-width": `${leftWidth}px`,
    "--right-panel-width": `${rightWidth}px`,
  } as CSSProperties;
  useHotkeys();

  useEffect(() => {
    document.documentElement.dataset.theme = editorTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", editorTheme === "dark" ? "#1b1e26" : "#ffffff");
  }, [editorTheme]);

  useEffect(() => {
    if (!loaded) return;
    requestAnimationFrame(() => fitAll(document.querySelector(".canvas")));
    // Новым пользователям — обучение. В автотестах (navigator.webdriver) не мешаем сценариям.
    if (!getPrefs().onboarded && !navigator.webdriver) {
      const t = setTimeout(startTour, 500);
      return () => clearTimeout(t);
    }
  }, [loaded]);

  const toggle = (t: MobileTab) => setTab((cur) => (cur === t ? null : t));

  return (
    <div key={lang} className={`app${mode === "run" ? " run" : ""}`} style={panelWidths}>
      <Toolbar />
      <aside id="panel-left" className={`panel left${tab === "screens" ? " open" : ""}`} aria-label={tr("Экраны и элементы")}>
        {mode === "run" ? <FlowMap /> : <ScreensPanel />}
        {mode === "edit" && <Palette />}
        {mode === "edit" && <FlowMap />}
      </aside>
      <main className="main">
        {mode === "run" ? <RunView /> : <Canvas />}
        <DraftBar />
      </main>
      {mode === "edit" && (
        <aside id="panel-right" className={`panel right${tab === "props" ? " open" : ""}`} aria-label={tr("Свойства")} data-tour="inspector">
          {hasSelection ? <Inspector /> : <ProjectPanel />}
        </aside>
      )}
      <PanelResizeHandle side="left" label={tr("Экраны и элементы")} width={leftWidth} onResize={setLeftWidth} />
      {mode === "edit" && (
        <PanelResizeHandle side="right" label={tr("Свойства")} width={rightWidth} onResize={setRightWidth} />
      )}
      <nav className="mobile-tabs">
        <button className={tab === "screens" ? "on" : ""} onClick={() => toggle("screens")}>
          {tr("Экраны и элементы")}
        </button>
        <button className={tab === "props" ? "on" : ""} onClick={() => toggle("props")} disabled={mode === "run"}>
          {tr("Свойства")}
        </button>
      </nav>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <Tour />
    </div>
  );
}
