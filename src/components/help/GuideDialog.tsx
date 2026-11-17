// Инструкция пользователя внутри приложения. Источник — docs/GUIDE.md (тот же файл видно на GitHub).
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import guideMd from "../../../docs/GUIDE.md?raw";
import { tr } from "../../lib/i18n";
import type { Inline } from "../../lib/markdown";
import { parseMarkdown } from "../../lib/markdown";
import { Icon } from "../Icon";

// Скриншоты инструкции: Vite выдаёт итоговые адреса файлов.
const IMAGES = import.meta.glob<string>("../../../docs/guide/*.png", { eager: true, query: "?url", import: "default" });
const imageUrl = (src: string) => IMAGES[`../../../docs/${src}`] ?? src;

function Inl({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        if (x.t === "b") return <b key={i}>{x.v}</b>;
        if (x.t === "i") return <i key={i}>{x.v}</i>;
        if (x.t === "code") return <code key={i}>{x.v}</code>;
        if (x.t === "link") {
          const external = /^https?:/.test(x.href);
          return (
            <a key={i} href={external ? x.href : undefined} target={external ? "_blank" : undefined} rel="noreferrer">
              {x.v}
            </a>
          );
        }
        return <span key={i}>{x.v}</span>;
      })}
    </>
  );
}

export function GuideDialog({ onClose }: { onClose: () => void }) {
  const blocks = useMemo(() => parseMarkdown(guideMd), []);
  const body = useRef<HTMLDivElement>(null);
  const toc = blocks.filter((b): b is Extract<typeof b, { t: "h" }> => b.t === "h" && b.level === 2);
  const go = (id: string) => body.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const render = (b: (typeof blocks)[number], i: number): ReactNode => {
    switch (b.t) {
      case "h": {
        const H = (`h${Math.min(4, b.level + 1)}`) as "h2" | "h3" | "h4";
        return (
          <H key={i} id={b.id}>
            {b.text}
          </H>
        );
      }
      case "p":
        return (
          <p key={i}>
            <Inl items={b.inl} />
          </p>
        );
      case "list": {
        const L = b.ordered ? "ol" : "ul";
        return (
          <L key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Inl items={it} />
              </li>
            ))}
          </L>
        );
      }
      case "code":
        return (
          <pre key={i}>
            <code>{b.v}</code>
          </pre>
        );
      case "quote":
        return (
          <blockquote key={i}>
            <Inl items={b.inl} />
          </blockquote>
        );
      case "img":
        return (
          <figure key={i}>
            <img src={imageUrl(b.src)} alt={b.alt} loading="lazy" />
            {b.alt && <figcaption>{b.alt}</figcaption>}
          </figure>
        );
      case "table":
        return (
          <div className="guide-table" key={i}>
            <table>
              <thead>
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j}>
                      <Inl items={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k}>
                        <Inl items={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "hr":
        return <hr key={i} />;
    }
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div className="modal-head">
          <h2 id="guide-title">{tr("Инструкция")}</h2>
          <button className="btn sm" onClick={onClose} aria-label={tr("Закрыть")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="guide-grid">
          <nav className="guide-toc" aria-label={tr("Содержание")}>
            {toc.map((h) => (
              <button key={h.id} className="menu-item" onClick={() => go(h.id)}>
                {h.text}
              </button>
            ))}
          </nav>
          <div className="guide-body" ref={body}>
            {blocks.map(render)}
          </div>
        </div>
      </div>
    </div>
  );
}
