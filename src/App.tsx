import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Canvas, fitAll } from "./components/canvas/Canvas";
import { useHotkeys } from "./components/hotkeys";
import { Inspector } from "./components/panels/Inspector";
import { FlowMap } from "./components/panels/FlowMap";
import { Palette } from "./components/panels/Palette";
import { ProjectPanel } from "./components/panels/ProjectPanel";
import { ScreensPanel } from "./components/panels/ScreensPanel";
import { RunView } from "./components/run/RunView";
import { Toolbar } from "./components/Toolbar";
import { useEditor } from "./store/editor";

type MobileTab = "screens" | "props" | null;

export function App() {
  const mode = useEditor((s) => s.mode);
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const editorTheme = useEditor((s) => s.editorTheme);
  const toast = useEditor((s) => s.toast);
  const loaded = useEditor((s) => s.loaded);
  const [tab, setTab] = useState<MobileTab>(null);
  useHotkeys();

  useEffect(() => {
    document.documentElement.dataset.theme = editorTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", editorTheme === "dark" ? "#1b1e26" : "#ffffff");
  }, [editorTheme]);

  useEffect(() => {
    if (loaded) requestAnimationFrame(() => fitAll(document.querySelector(".canvas")));
  }, [loaded]);

  const toggle = (t: MobileTab) => setTab((cur) => (cur === t ? null : t));

  return (
    <div className={`app${mode === "run" ? " run" : ""}`}>
      <Toolbar />
      <aside className={`panel left${tab === "screens" ? " open" : ""}`} aria-label="Экраны и элементы">
        {mode === "run" ? <FlowMap /> : <ScreensPanel />}
        {mode === "edit" && <Palette />}
        {mode === "edit" && <FlowMap />}
      </aside>
      <main className="main">{mode === "run" ? <RunView /> : <Canvas />}</main>
      {mode === "edit" && (
        <aside className={`panel right${tab === "props" ? " open" : ""}`} aria-label="Свойства">
          {hasSelection ? <Inspector /> : <ProjectPanel />}
        </aside>
      )}
      <nav className="mobile-tabs">
        <button className={tab === "screens" ? "on" : ""} onClick={() => toggle("screens")}>
          Экраны и элементы
        </button>
        <button className={tab === "props" ? "on" : ""} onClick={() => toggle("props")} disabled={mode === "run"}>
          Свойства
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
    </div>
  );
}
