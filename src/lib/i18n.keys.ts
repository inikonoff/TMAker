// Ключи, которые показываются через tr(переменная): подписи из констант. Используется тестом полноты словарей.
import { TOKEN_LABELS } from "./color";
import { KIND_GROUPS, KIND_SPEC } from "./defaults";
import { DEVICE_PRESETS } from "./devices";
import { TRANSITION_LABELS } from "./transitions";

export function dynamicKeys(): string[] {
  return [
    ...Object.values(KIND_SPEC).map((k) => k.label),
    ...KIND_GROUPS.map((g) => g.label),
    ...Object.values(TOKEN_LABELS),
    ...Object.values(TRANSITION_LABELS),
    ...Object.values(DEVICE_PRESETS).map((d) => d.label),
  ];
}
