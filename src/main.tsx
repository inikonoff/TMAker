import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { openFromHash } from "./components/shareLink";
import { loadInitial, startAutosave } from "./store/persist";
import "./styles/app.css";
import "./styles/run.css";
import { useEditor } from "./store/editor";

if (import.meta.env.DEV) (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;

async function boot() {
  await loadInitial();
  await openFromHash();
  startAutosave();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void boot();
