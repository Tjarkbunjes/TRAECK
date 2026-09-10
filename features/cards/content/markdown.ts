// Markdown helpers shared by the renderer and (later) the content pipeline.
// remarkNormChips wraps German statute citations ("§ 823 I BGB", "Art. 12 GG",
// "§§ 280 I, III, 281 BGB") in a <span class="norm"> so the renderer can style
// them as chips. Styling only — no links.

const SP = String.raw`[ \u00A0]`;
const NUM = String.raw`(?:[IVX]+|\d+[a-z]?|[a-z]\))`;
const PART = String.raw`(?:(?:Abs\.|S\.|Nr\.|Alt\.|Hs\.|Var\.|lit\.)${SP}?)?${NUM}`;
const REF = String.raw`\d+[a-z]?(?:${SP}${PART})*`;
const LIST = String.raw`${REF}(?:,${SP}?${NUM}(?:${SP}${PART})*)*`;
const LAW = String.raw`[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*[A-ZÄÖÜ]`;

export const NORM_RE = new RegExp(String.raw`(?:§§?|Artt?\.)${SP}?${LIST}(?:${SP}ff\.)?${SP}${LAW}`, 'g');

export const NORM_CLASS = 'norm';

export function findNorms(text: string): string[] {
  return [...text.matchAll(NORM_RE)].map((m) => m[0]);
}

// Minimal mdast shape — enough to walk and rewrite text nodes without pulling
// in @types/mdast as a dependency.
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const SKIP_PARENTS = new Set(['inlineCode', 'code', 'html']);

function splitTextNode(node: MdNode): MdNode[] | null {
  const text = node.value ?? '';
  const matches = [...text.matchAll(NORM_RE)];
  if (matches.length === 0) return null;
  const out: MdNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > cursor) out.push({ type: 'text', value: text.slice(cursor, start) });
    out.push({
      type: 'text',
      value: m[0],
      data: { hName: 'span', hProperties: { className: [NORM_CLASS] } },
    });
    cursor = start + m[0].length;
  }
  if (cursor < text.length) out.push({ type: 'text', value: text.slice(cursor) });
  return out;
}

function walk(node: MdNode): void {
  if (!node.children || SKIP_PARENTS.has(node.type)) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      const split = splitTextNode(child);
      if (split) {
        next.push(...split);
        continue;
      }
    } else {
      walk(child);
    }
    next.push(child);
  }
  node.children = next;
}

/** remark plugin — usable as `remarkPlugins={[remarkNormChips]}`. */
export function remarkNormChips() {
  return (tree: MdNode) => {
    walk(tree);
  };
}
