import { tr } from "../../lib/i18n";
import { useEditor } from "../../store/editor";
import { Icon } from "../Icon";

/** Плашка черновика ИИ: оставить или отменить (отмена — один шаг). */
export function DraftBar() {
  const pending = useEditor((s) => s.pendingDraft);
  const note = useEditor((s) => s.draftNote);
  if (!pending) return null;
  return (
    <div className="draft-bar" role="status">
      <Icon name="ai" />
      <span>{tr("Черновик ИИ")}{note ? `: ${note}` : ""}</span>
      <button className="btn sm primary" onClick={() => useEditor.getState().acceptDraft()}>
        {tr("Оставить")}
      </button>
      <button className="btn sm ghost-line" onClick={() => useEditor.getState().rejectDraft()}>
        {tr("Отменить")}
      </button>
    </div>
  );
}
