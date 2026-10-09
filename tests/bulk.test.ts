import test from 'node:test';
import assert from 'node:assert/strict';

import { findBareUrls, offsetMapper, planRewrite, runPool, summary, trimTrailing, uniqueUrls, withinRanges } from '../src/bulk.ts';

const urls = (doc: string) => findBareUrls(doc).map((f) => f.url);
const slices = (doc: string) => findBareUrls(doc).map((f) => doc.slice(f.from, f.to));

test('finds bare addresses and reports their exact range', () => {
  const doc = 'See https://a.com/x and\nhttp://b.org.\n- https://c.io/p?q=1#h';
  assert.deepEqual(urls(doc), ['https://a.com/x', 'http://b.org', 'https://c.io/p?q=1#h']);
  assert.deepEqual(slices(doc), urls(doc));
});

test('trailing punctuation is not part of the address', () => {
  assert.deepEqual(urls('(see https://a.com/x).'), ['https://a.com/x']);
  assert.deepEqual(urls('https://a.com/x, https://b.com/y; https://c.com/z! https://d.com/w?'), [
    'https://a.com/x', 'https://b.com/y', 'https://c.com/z', 'https://d.com/w',
  ]);
  assert.deepEqual(urls('**https://a.com/x** and "https://b.com/y"'), ['https://a.com/x', 'https://b.com/y']);
  assert.deepEqual(urls('https://en.wikipedia.org/wiki/Foo_(bar)'), ['https://en.wikipedia.org/wiki/Foo_(bar)']);
  assert.deepEqual(urls('(https://en.wikipedia.org/wiki/Foo_(bar))'), ['https://en.wikipedia.org/wiki/Foo_(bar)']);
  assert.equal(trimTrailing('https://a.com/x).,'), 'https://a.com/x');
});

test('autolinks count as bare and include their brackets', () => {
  const doc = 'go <https://a.com/x> now';
  assert.deepEqual(urls(doc), ['https://a.com/x']);
  assert.deepEqual(slices(doc), ['<https://a.com/x>']);
});

test('already linked addresses are left alone', () => {
  assert.deepEqual(urls('[text](https://a.com) and [https://b.com](https://b.com) and ![i](https://c.com/i.png)'), []);
  assert.deepEqual(urls('[a](<https://a.com/x y>) and [[https://b.com]] and ![[https://c.com]]'), []);
  assert.deepEqual(urls('[a](https://en.wikipedia.org/wiki/Foo_(bar)) https://d.com'), ['https://d.com']);
});

test('code, properties, comments and HTML are skipped', () => {
  assert.deepEqual(urls('---\nsource: https://a.com\n---\nhttps://b.com'), ['https://b.com']);
  assert.deepEqual(urls('```\nhttps://a.com\n```\nhttps://b.com'), ['https://b.com']);
  assert.deepEqual(urls('~~~js\nhttps://a.com\n~~~\nhttps://b.com'), ['https://b.com']);
  assert.deepEqual(urls('```\nhttps://a.com\nnever closed'), []);
  assert.deepEqual(urls('  - ```\n    https://a.com\n    ```\n  https://b.com'), ['https://b.com']);
  assert.deepEqual(urls('`https://a.com` and ``x ` https://b.com`` and https://c.com'), ['https://c.com']);
  assert.deepEqual(urls('a ` lone tick https://a.com'), ['https://a.com']);
  assert.deepEqual(urls('`open\n\nhttps://a.com\n\nclose`'), ['https://a.com']);
  assert.deepEqual(urls('<a href="https://a.com">https://b.com</a> https://c.com'), ['https://b.com', 'https://c.com']);
  assert.deepEqual(urls('<img src="https://a.com/i.png"> <!-- https://b.com --> %%https://c.com%% https://d.com'), ['https://d.com']);
  assert.deepEqual(urls('[ref]: https://a.com "Title"\nhttps://b.com'), ['https://b.com']);
});

test('not an address: no dot, other scheme, glued to a word', () => {
  assert.deepEqual(urls('https://intranet ftp://a.com xhttps://b.com'), []);
  assert.deepEqual(urls('see https://c.com'), ['https://c.com']);
});

test('table cells end the address at the pipe', () => {
  assert.deepEqual(urls('| https://a.com | https://b.com |'), ['https://a.com', 'https://b.com']);
});

test('duplicates are all found, fetched once', () => {
  const found = findBareUrls('https://a.com x https://a.com y https://b.com');
  assert.equal(found.length, 3);
  assert.deepEqual(uniqueUrls(found), ['https://a.com', 'https://b.com']);
});

test('a selection keeps only addresses wholly inside it', () => {
  const doc = 'https://a.com https://b.com https://c.com';
  const found = findBareUrls(doc);
  assert.deepEqual(withinRanges(found, []).length, 3);
  assert.deepEqual(withinRanges(found, [{ from: 14, to: 27 }]).map((f) => f.url), ['https://b.com']);
  assert.deepEqual(withinRanges(found, [{ from: 14, to: 20 }]), []);
  assert.deepEqual(withinRanges(found, [{ from: 0, to: 13 }, { from: 28, to: 41 }]).map((f) => f.url), ['https://a.com', 'https://c.com']);
});

const titles = (o: Record<string, string | null>) => new Map(Object.entries(o));

test('the plan rewrites addresses, one edit each, and counts what stays', () => {
  const doc = 'a https://a.com b <https://b.com> c https://c.com d https://a.com';
  const plan = planRewrite(doc, doc, findBareUrls(doc), titles({ 'https://a.com': 'Site A', 'https://b.com': 'B [x]', 'https://c.com': null }));
  assert.equal(plan.added, 3);
  assert.equal(plan.left, 1);
  let out = doc;
  for (const e of [...plan.edits].reverse()) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  assert.equal(out, 'a [Site A](https://a.com) b [B \\[x\\]](https://b.com) c https://c.com d [Site A](https://a.com)');
});

test('text typed before an address shifts the edit; text typed after leaves it be', () => {
  const snap = 'one https://a.com two https://b.com';
  const found = findBareUrls(snap);
  const t = titles({ 'https://a.com': 'A', 'https://b.com': 'B' });
  const cur = 'NEW one https://a.com two https://b.com';
  const plan = planRewrite(snap, cur, found, t);
  assert.equal(plan.added, 2);
  assert.deepEqual(plan.edits.map((e) => cur.slice(e.from, e.to)), ['https://a.com', 'https://b.com']);
  const typedAfter = 'one https://a.com two https://b.com!!';
  assert.equal(planRewrite(snap, typedAfter, found, t).added, 2);
});

test('an address that was edited, deleted or wrapped meanwhile is skipped', () => {
  const snap = 'one https://a.com two https://b.com';
  const found = findBareUrls(snap);
  const t = titles({ 'https://a.com': 'A', 'https://b.com': 'B' });
  const edited = 'one https://a.com/more two https://b.com';
  const p1 = planRewrite(snap, edited, found, t);
  assert.equal(p1.added, 1);
  assert.equal(p1.left, 1);
  assert.equal(edited.slice(p1.edits[0].from, p1.edits[0].to), 'https://b.com');
  const deleted = 'one  two https://b.com';
  assert.equal(planRewrite(snap, deleted, found, t).added, 1);
  const wrapped = 'one `https://a.com` two https://b.com';
  assert.equal(planRewrite(snap, wrapped, found, t).added, 1);
  const linked = 'one [x](https://a.com) two https://b.com';
  assert.equal(planRewrite(snap, linked, found, t).added, 1);
});

test('edits inside the changed stretch never land on other text', () => {
  const snap = 'https://a.com mid https://b.com';
  const found = findBareUrls(snap);
  const cur = 'x https://a.com MIDDLE https://b.com y';
  const plan = planRewrite(snap, cur, found, titles({ 'https://a.com': 'A', 'https://b.com': 'B' }));
  for (const e of plan.edits) assert.match(cur.slice(e.from, e.to), /^https:\/\/[ab]\.com$/);
});

test('pipes in a title are escaped inside tables only', () => {
  const doc = '| https://a.com |\nhttps://a.com';
  const plan = planRewrite(doc, doc, findBareUrls(doc), titles({ 'https://a.com': 'A | B' }));
  assert.equal(plan.edits[0].text, '[A \\| B](https://a.com)');
  assert.equal(plan.edits[1].text, '[A | B](https://a.com)');
});

test('offsetMapper', () => {
  const m = offsetMapper('abcXdef', 'abcXYZdef');
  assert.deepEqual(m(0, 3), { from: 0, to: 3 });
  assert.deepEqual(m(4, 7), { from: 6, to: 9 });
  assert.equal(m(2, 5), null);
});

test('summary wording', () => {
  assert.equal(summary(9, 3), 'Added 9 titles, 3 left as they were.');
  assert.equal(summary(1, 0), 'Added 1 title.');
  assert.equal(summary(0, 2), 'Added 0 titles, 2 left as they were.');
});

test('runPool never runs more than the limit at once and honours stop', async () => {
  let live = 0;
  let peak = 0;
  const done: number[] = [];
  await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    live++;
    peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, 5));
    live--;
    done.push(n);
  }, () => false);
  assert.equal(peak, 3);
  assert.equal(done.length, 7);
  const some: number[] = [];
  await runPool([1, 2, 3, 4, 5], 1, async (n) => void some.push(n), () => some.length >= 2);
  assert.deepEqual(some, [1, 2]);
});
