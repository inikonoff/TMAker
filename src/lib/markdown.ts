// Мини-разбор Markdown для встроенной инструкции: заголовки, абзацы, списки, код, цитаты, картинки, ссылки, таблицы.
export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; v: string }
  | { t: "i"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; href: string };

export type Block =
  | { t: "h"; level: number; text: string; id: string }
  | { t: "p"; inl: Inline[] }
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "code"; lang: string; v: string }
  | { t: "quote"; inl: Inline[] }
  | { t: "img"; src: string; alt: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "hr" };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    if (m.index! > last) out.push({ t: "text", v: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ t: "b", v: tok.slice(2, -2) });
    else if (tok.startsWith("*")) out.push({ t: "i", v: tok.slice(1, -1) });
    else if (tok.startsWith("`")) out.push({ t: "code", v: tok.slice(1, -1) });
    else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      out.push({ t: "link", v: lm[1]!, href: lm[2]! });
    }
    last = m.index! + tok.length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

/** Якорь заголовка, как у GitHub: строчные буквы, пробелы → дефисы, без знаков препинания. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i++]!);
      i++;
      out.push({ t: "code", lang: fence[1] ?? "", v: body.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push({ t: "h", level: h[1]!.length, text: h[2]!.trim(), id: slugify(h[2]!) });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push({ t: "hr" });
      i++;
      continue;
    }
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      out.push({ t: "img", alt: img[1]!, src: img[2]! });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?\s*:?-+/)) {
      const head = cells(line);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      out.push({ t: "table", head, rows });
      continue;
    }
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) body.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push({ t: "quote", inl: parseInline(body.join(" ")) });
      continue;
    }
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]!);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (m) {
          items.push(parseInline(m[2]!));
          i++;
        } else if (lines[i]!.match(/^\s{2,}\S/) && items.length) {
          // Продолжение пункта на следующей строке.
          items[items.length - 1]!.push({ t: "text", v: " " }, ...parseInline(lines[i]!.trim()));
          i++;
        } else break;
      }
      out.push({ t: "list", ordered, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s|!\[|\|)/.test(lines[i]!)) body.push(lines[i++]!.trim());
    if (body.length === 0) body.push(lines[i++]!.trim());
    out.push({ t: "p", inl: parseInline(body.join(" ")) });
  }
  return out;
}
