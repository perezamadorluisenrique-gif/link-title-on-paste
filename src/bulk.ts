// Finding and rewriting every bare web address in a note. Pure logic: no
// `obsidian` import, so tests/ can run it under plain Node.

import { asBareUrl, markdownLink } from './logic.ts';

export interface BareUrl {
  /** Offsets of what gets replaced: the URL, plus its `<` and `>` when it is an autolink. */
  from: number;
  to: number;
  /** The address itself, without trailing punctuation or autolink brackets. */
  url: string;
}

export interface Edit {
  from: number;
  to: number;
  text: string;
}

export interface Plan {
  /** Non-overlapping replacements in the coordinates of the current document, ascending. */
  edits: Edit[];
  added: number;
  /** Addresses that stay as they were: no title, or the text moved or changed meanwhile. */
  left: number;
}

const BLANK = ' ';

/** Replaces `[from, to)` of `s` with spaces, keeping every offset and newline in place. */
function blank(s: string, from: number, to: number): string {
  return s.slice(0, from) + s.slice(from, to).replace(/[^\n]/g, BLANK) + s.slice(to);
}

function maskMatches(s: string, re: RegExp): string {
  let out = s;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (let m = g.exec(s); m; m = g.exec(s)) {
    out = blank(out, m.index, m.index + m[0].length);
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}

function maskFrontMatter(s: string): string {
  if (!/^---[ \t]*\r?\n/.test(s)) return s;
  const end = /\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(s.slice(3));
  return end ? blank(s, 0, 3 + end.index + end[0].length) : s;
}

/** Fenced code blocks, an unclosed one running to the end of the note. */
function maskFences(s: string): string {
  let out = s;
  let open: { ch: string; len: number; start: number } | null = null;
  let pos = 0;
  for (const line of s.split('\n')) {
    const start = pos;
    pos += line.length + 1;
    const m = /^[ \t>]*(?:(?:[-*+]|\d+[.)])[ \t]+)?(`{3,}|~{3,})(.*)$/.exec(line.replace(/\r$/, ''));
    if (!open) {
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) open = { ch: m[1][0], len: m[1].length, start };
    } else if (m && m[1][0] === open.ch && m[1].length >= open.len && m[2].trim() === '') {
      out = blank(out, open.start, Math.min(s.length, pos));
      open = null;
    }
  }
  return open ? blank(out, open.start, s.length) : out;
}

/** Inline code: a backtick run closed by a run of the same length in the same paragraph. */
function maskInlineCode(s: string): string {
  let out = s;
  const runs: { index: number; len: number }[] = [];
  const re = /`+/g;
  for (let m = re.exec(s); m; m = re.exec(s)) runs.push({ index: m.index, len: m[0].length });
  for (let i = 0; i < runs.length; i++) {
    const open = runs[i];
    const para = s.slice(open.index + open.len).search(/\n[ \t]*\r?\n/);
    const limit = para === -1 ? s.length : open.index + open.len + para;
    for (let j = i + 1; j < runs.length && runs[j].index < limit; j++) {
      if (runs[j].len !== open.len) continue;
      out = blank(out, open.index, runs[j].index + open.len);
      i = j;
      break;
    }
  }
  return out;
}

/**
 * Every bare http(s) address in `doc`, in order. Skipped on purpose: the
 * properties block, fenced and inline code, `[[wikilinks]]`, `[text](links)`
 * (text and destination), reference definitions, HTML tags and comments, and
 * `%%comments%%`. An autolink `<https://…>` counts as bare.
 */
export function findBareUrls(doc: string): BareUrl[] {
  let s = maskFrontMatter(doc);
  s = maskFences(s);
  s = maskMatches(s, /<!--[\s\S]*?-->/g);
  s = maskMatches(s, /%%[\s\S]*?%%/g);
  s = maskInlineCode(s);
  s = maskMatches(s, /!?\[\[[^\]\n]*\]\]/g);
  s = maskMatches(s, /!?\[(?:\\.|[^\]\\\n])*\]\((?:<[^>\n]*>|[^)\n]*)\)/g);
  s = maskMatches(s, /^[ \t]{0,3}\[[^\]\n]+\]:[^\n]*/gm);
  s = maskMatches(s, /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g);

  const found: BareUrl[] = [];
  const urlRe = /(<)?(https?:\/\/[^\s<>|]+)(>)?/gi;
  for (let m = urlRe.exec(s); m; m = urlRe.exec(s)) {
    // Glued to a word or a path (`xhttps://…`): not an address of its own.
    if (m.index > 0 && /[\w/]/.test(s[m.index - 1])) continue;
    const auto = m[1] === '<' && m[3] === '>';
    // `<` without a closing `>` is not an autolink: the address starts after it.
    const start = m.index + (m[1] && !auto ? 1 : 0);
    let raw = m[2];
    if (auto) {
      // Inside <...> the address is exactly what the brackets hold.
    } else {
      raw = trimTrailing(raw);
    }
    const url = asBareUrl(raw);
    if (!url || url !== raw) continue;
    found.push(auto ? { from: m.index, to: m.index + m[0].length, url } : { from: start, to: start + raw.length, url });
  }
  return found;
}

/** Strips punctuation that ends a sentence, not an address, and unbalanced closing brackets. */
export function trimTrailing(raw: string): string {
  let u = raw;
  for (;;) {
    const last = u[u.length - 1];
    if (last && /[.,;:!?'"*_~]/.test(last)) u = u.slice(0, -1);
    else if (last === ')' && count(u, ')') > count(u, '(')) u = u.slice(0, -1);
    else if (last === ']' && count(u, ']') > count(u, '[')) u = u.slice(0, -1);
    else if (last === '}' && count(u, '}') > count(u, '{')) u = u.slice(0, -1);
    else return u;
  }
}

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/** The addresses that lie entirely inside one of `ranges`; all of them when `ranges` is empty. */
export function withinRanges(found: BareUrl[], ranges: { from: number; to: number }[]): BareUrl[] {
  if (ranges.length === 0) return found;
  return found.filter((f) => ranges.some((r) => f.from >= r.from && f.to <= r.to));
}

/** The distinct addresses, in order of first appearance. */
export function uniqueUrls(found: BareUrl[]): string[] {
  return [...new Set(found.map((f) => f.url))];
}

/**
 * Maps offsets of `before` to offsets of `after` when the edits between them
 * are summed up as one changed stretch (common head and tail). Offsets inside
 * that stretch have no counterpart: null.
 */
export function offsetMapper(before: string, after: string): (start: number, end: number) => { from: number; to: number } | null {
  let head = 0;
  const max = Math.min(before.length, after.length);
  while (head < max && before[head] === after[head]) head++;
  let tail = 0;
  while (tail < max - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  const delta = after.length - before.length;
  return (start, end) => {
    if (end <= head) return { from: start, to: end };
    if (start >= before.length - tail) return { from: start + delta, to: end + delta };
    return null;
  };
}

/**
 * Turns the results into edits for the note as it is now. `snapshot` is the
 * note when the addresses were found; the user may have typed since. An
 * address is rewritten only if it still sits, unchanged and still bare, where
 * it was (after allowing for text inserted or removed around it).
 */
export function planRewrite(snapshot: string, current: string, found: BareUrl[], titles: Map<string, string | null>): Plan {
  const map = snapshot === current ? (a: number, b: number) => ({ from: a, to: b }) : offsetMapper(snapshot, current);
  const now = new Map(findBareUrls(current).map((f) => [f.from + ':' + f.to, f.url]));
  const edits: Edit[] = [];
  let left = 0;
  for (const f of found) {
    const title = titles.get(f.url);
    const at = title ? map(f.from, f.to) : null;
    if (!title || !at || now.get(at.from + ':' + at.to) !== f.url) {
      left++;
      continue;
    }
    edits.push({ from: at.from, to: at.to, text: tableSafe(markdownLink(title, f.url), inTable(current, at.from)) });
  }
  edits.sort((a, b) => a.from - b.from);
  return { edits, added: edits.length, left };
}

function tableSafe(link: string, table: boolean): string {
  return table ? link.replace(/\|/g, '\\|') : link;
}

function inTable(doc: string, offset: number): boolean {
  const line = doc.slice(doc.lastIndexOf('\n', offset - 1) + 1, offset);
  return /^\s*\|/.test(line);
}

export function summary(added: number, left: number): string {
  const titles = `${added} ${added === 1 ? 'title' : 'titles'}`;
  return left > 0 ? `Added ${titles}, ${left} left as they were.` : `Added ${titles}.`;
}

/** Runs `worker` over `items` with at most `limit` in flight; `stop()` ends the launching early. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>, stop: () => boolean): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (!stop() && next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
