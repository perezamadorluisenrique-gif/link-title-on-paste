// Pure logic: no `obsidian` import, so tests/ can run it under plain Node.

export interface LinkTarget {
  from: number;
  to: number;
  url: string;
  /** `bare` is a plain URL; `empty` is `[](url)` or `[url](url)`, whose text we can fill in. */
  kind: 'bare' | 'empty';
}

const URL_RE = /^https?:\/\/[^\s<>]+$/i;
const MAX_TITLE = 200;
const MAX_HTML = 300_000;

/** The URL in `text` when the whole text is one http(s) URL, otherwise null. */
export function asBareUrl(text: string): string | null {
  const t = text.trim();
  if (!URL_RE.test(t)) return null;
  try {
    const u = new URL(t);
    return u.hostname.includes('.') || isPrivateHost(u.hostname) ? t : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** localhost, loopback, link-local and private ranges: pages we cannot read and should not probe. */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return h.includes(':');
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Parses the user's skip list: one domain per line or comma separated, `*.` and `www.` ignored. */
export function parseSkipList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^\*\./, '').replace(/^www\./, ''))
    .filter(Boolean);
}

/** True when the URL's host is a skipped domain or one of its subdomains, or is private. */
export function isSkipped(url: string, skip: string[]): boolean {
  const host = hostOf(url);
  if (!host || isPrivateHost(host)) return true;
  return skip.some((d) => host === d || host.endsWith('.' + d));
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®',
  trade: '™', middot: '·', bull: '•', euro: '€', times: '×', eacute: 'é', egrave: 'è', aacute: 'á',
  iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return value;
  }
  return null;
}

/** Cleans a raw title: decodes entities, collapses whitespace, caps the length. Null when nothing is left. */
export function cleanTitle(raw: string): string | null {
  const t = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > MAX_TITLE ? t.slice(0, MAX_TITLE - 1).replace(/\s+$/, '') + '…' : t;
}

/** The page title: `<title>`, else og:title, else twitter:title. Only the first ~300 KB are read. */
export function extractTitle(html: string): string | null {
  const head = html.slice(0, MAX_HTML).replace(/<!--[\s\S]*?-->/g, '');
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const found = (title && cleanTitle(title)) || cleanTitle(metaContent(head, 'og:title') ?? '') || cleanTitle(metaContent(head, 'twitter:title') ?? '');
  return found;
}

/** Link text safe for `[text](url)`: brackets escaped. */
export function escapeLinkText(title: string): string {
  return title.replace(/\\/g, '\\\\').replace(/([[\]])/g, '\\$1');
}

/** URLs with spaces or parentheses would break `(url)`; wrap those in angle brackets. */
export function linkDestination(url: string): string {
  return /[\s()]/.test(url) ? `<${url.replace(/ /g, '%20')}>` : url;
}

export function markdownLink(title: string, url: string): string {
  return `[${escapeLinkText(title)}](${linkDestination(url)})`;
}

/** True when a title adds nothing: it is the URL itself or its host. */
export function isUselessTitle(title: string, url: string): boolean {
  const t = title.trim().toLowerCase();
  return t === url.toLowerCase() || t === hostOf(url) || t === url.replace(/^https?:\/\//i, '').toLowerCase();
}

/**
 * False where a bare URL should stay bare: inside a code block, inline code, a
 * link, a wikilink, the properties block or a URL already being typed.
 */
export function canLinkAt(doc: string, offset: number): boolean {
  const before = doc.slice(0, offset);
  if (/^---\r?\n/.test(doc)) {
    const end = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(doc.slice(3));
    if (end && offset <= 3 + end.index + end[0].length) return false;
  }
  const fences = before.match(/^[ \t]*(```|~~~)/gm);
  if (fences && fences.length % 2 === 1) return false;
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if ((line.match(/`/g)?.length ?? 0) % 2 === 1) return false;
  if (/\[\[[^\]]*$/.test(line) || /\]\([^)]*$/.test(line) || /\[[^\]]*$/.test(line) || /<[^>]*$/.test(line)) return false;
  return true;
}

/**
 * Finds the URL to title at `ch` in `line`: a bare URL under the cursor, or a
 * link whose text is empty or the URL itself.
 */
export function findTargetInLine(line: string, ch: number): LinkTarget | null {
  const link = /\[([^\]]*)\]\((<?)(https?:\/\/[^\s)>]+)>?\)/gi;
  for (let m = link.exec(line); m; m = link.exec(line)) {
    const from = m.index;
    const to = from + m[0].length;
    if (ch < from || ch > to) continue;
    const text = m[1].trim();
    if (text === '' || text === m[3]) return { from, to, url: m[3], kind: 'empty' };
    return null;
  }
  const bare = /https?:\/\/[^\s<>)\]]+/gi;
  for (let m = bare.exec(line); m; m = bare.exec(line)) {
    const from = m.index;
    const to = from + m[0].length;
    if (ch < from || ch > to) continue;
    // Part of a link destination or an autolink: not ours.
    if (/\]\($/.test(line.slice(0, from)) || line[from - 1] === '<') return null;
    const url = m[0].replace(/[.,;:!?'"]+$/, '');
    return { from, to: from + url.length, url, kind: 'bare' };
  }
  return null;
}

/**
 * Where `url` is now, after the user may have typed while the title loaded.
 * Looks at the original offset first, then at the nearest standalone copy.
 */
export function locateUrl(doc: string, url: string, hint: number): { from: number; to: number } | null {
  const standalone = (at: number): boolean => {
    if (doc.slice(at, at + url.length) !== url) return false;
    const prev = doc[at - 1] ?? '';
    const next = doc[at + url.length] ?? '';
    return prev !== '(' && prev !== '<' && prev !== '[' && !/[\w/%-]/.test(next);
  };
  if (standalone(hint)) return { from: hint, to: hint + url.length };
  let best = -1;
  for (let i = doc.indexOf(url); i !== -1; i = doc.indexOf(url, i + 1)) {
    if (standalone(i) && (best === -1 || Math.abs(i - hint) < Math.abs(best - hint))) best = i;
  }
  return best === -1 ? null : { from: best, to: best + url.length };
}
