import { memo, useMemo } from "react";
import type { Tokens } from "../../lib/color";
import { resolveColor } from "../../lib/color";
import { deviceLabel } from "../../lib/devices";
import type { Device, Element, Screen } from "../../lib/model";
import { useDrag } from "../../store/drag";
import { ElementView, LiveArrow } from "./ElementView";
import { startScreenDrag } from "./gestures";
import { tr } from "../../lib/i18n";

type Props = {
  screen: Screen;
  w: number;
  h: number;
  device: Device;
  elements: Element[];
  tokens: Tokens;
  active: boolean;
  index: number;
};

export const ScreenFrame = memo(function ScreenFrame({ screen, w, h, device, elements, tokens, active, index }: Props) {
  const dragIds = useDrag((s) => s.ids);
  const byId = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);
  return (
    <div
      className={`screen${active ? " active" : ""}`}
      data-screen={screen.id}
      style={{ transform: `translate(${screen.x}px, ${screen.y}px)`, width: w, height: h }}
    >
      <div
        className="screen-label"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          startScreenDrag(e, screen.id);
        }}
      >
        <span>
          {index + 1}. {screen.name}
        </span>
        <small>{tr(deviceLabel(device))}</small>
      </div>
      <div className="screen-body" style={{ background: resolveColor(screen.bg, tokens, tokens.bg) }}>
        {elements.map((el) => {
          const attachedToDrag =
            el.arrow && dragIds.size > 0 && ((el.arrow.from.el && dragIds.has(el.arrow.from.el)) || (el.arrow.to.el && dragIds.has(el.arrow.to.el)));
          if (attachedToDrag && !dragIds.has(el.id)) return <LiveArrow key={el.id} el={el} tokens={tokens} byId={byId} />;
          return <ElementView key={el.id} el={el} tokens={tokens} dragging={dragIds.has(el.id)} />;
        })}
      </div>
    </div>
  );
});
