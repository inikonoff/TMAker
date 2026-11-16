// Состояние модификаторов, которое нужно жестам (пробел — панорама).
export const keys = { space: false };

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e.target)) keys.space = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") keys.space = false;
  });
  window.addEventListener("blur", () => {
    keys.space = false;
  });
}

export function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
}
