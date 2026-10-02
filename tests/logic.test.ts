import test from 'node:test';
import assert from 'node:assert/strict';

import {
  asBareUrl, canLinkAt, cleanTitle, decodeEntities, extractTitle, findTargetInLine, isPrivateHost,
  isSkipped, isUselessTitle, linkDestination, locateUrl, markdownLink, parseSkipList,
} from '../src/logic.ts';

test('asBareUrl accepts one URL and nothing else', () => {
  assert.equal(asBareUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(asBareUrl('  https://example.com\n'), 'https://example.com');
  assert.equal(asBareUrl('see https://example.com'), null);
  assert.equal(asBareUrl('https://a.com https://b.com'), null);
  assert.equal(asBareUrl('ftp://example.com'), null);
  assert.equal(asBareUrl('https://intranet'), null);
  assert.equal(asBareUrl('hello'), null);
});

test('private hosts are recognised', () => {
  for (const h of ['localhost', 'app.local', '127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.1.1', '169.254.1.1', '::1', '[::1]']) {
    assert.equal(isPrivateHost(h), true, h);
  }
  for (const h of ['example.com', '172.32.0.1', '8.8.8.8', 'fcc.gov']) assert.equal(isPrivateHost(h), false, h);
});

test('skip list matches domains and subdomains only', () => {
  const skip = parseSkipList('*.Example.com, www.twitter.com\nyoutu.be');
  assert.deepEqual(skip, ['example.com', 'twitter.com', 'youtu.be']);
  assert.equal(isSkipped('https://example.com/x', skip), true);
  assert.equal(isSkipped('https://docs.example.com/x', skip), true);
  assert.equal(isSkipped('https://notexample.com/x', skip), false);
  assert.equal(isSkipped('http://localhost:3000/', []), true);
});

test('entities decode, including numeric and unknown ones', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &#8212; &#x2019;s &hellip;'), 'Tom & Jerry — ’s …');
  assert.equal(decodeEntities('&bogus; &#0; &#99999999;'), '&bogus; &#0; &#99999999;');
  assert.equal(decodeEntities('&amp;lt;'), '&lt;');
});

test('extractTitle prefers <title>, falls back to og and twitter titles', () => {
  assert.equal(extractTitle('<html><head><TITLE lang="en">\n  A  &amp;\n B </TITLE></head>'), 'A & B');
  assert.equal(extractTitle('<head><meta property="og:title" content="OG &quot;Title&quot;"></head>'), 'OG "Title"');
  assert.equal(extractTitle("<head><title> </title><meta name='twitter:title' content='Tw'></head>"), 'Tw');
  assert.equal(extractTitle('<head><!-- <title>no</title> --><title>yes</title></head>'), 'yes');
  assert.equal(extractTitle('<p>nothing</p>'), null);
});

test('cleanTitle caps length', () => {
  const t = cleanTitle('x'.repeat(500));
  assert.equal(t?.length, 200);
  assert.ok(t?.endsWith('…'));
  assert.equal(cleanTitle('   '), null);
});

test('markdownLink escapes brackets and awkward URLs', () => {
  assert.equal(markdownLink('A [b] c', 'https://e.com'), '[A \\[b\\] c](https://e.com)');
  assert.equal(linkDestination('https://e.com/a_(b)'), '<https://e.com/a_(b)>');
  assert.equal(linkDestination('https://e.com/a b'), '<https://e.com/a%20b>');
});

test('isUselessTitle spots titles that repeat the URL', () => {
  assert.equal(isUselessTitle('example.com', 'https://example.com/x'), true);
  assert.equal(isUselessTitle('https://example.com/x', 'https://example.com/x'), true);
  assert.equal(isUselessTitle('Example Domain', 'https://example.com'), false);
});

test('canLinkAt refuses code, links, properties and wikilinks', () => {
  assert.equal(canLinkAt('Hello ', 6), true);
  assert.equal(canLinkAt('```\ncode ', 9), false);
  assert.equal(canLinkAt('```\ncode\n```\nafter ', 20), true);
  assert.equal(canLinkAt('Use `x ', 7), false);
  assert.equal(canLinkAt('[[Some ', 7), false);
  assert.equal(canLinkAt('[text](', 7), false);
  assert.equal(canLinkAt('[text ', 6), false);
  assert.equal(canLinkAt('---\nsource: \n---\nbody', 12), false);
  assert.equal(canLinkAt('---\nsource: \n---\nbody ', 22), true);
});

test('findTargetInLine finds bare URLs and empty links', () => {
  const line = 'see https://example.com/a, then';
  assert.deepEqual(findTargetInLine(line, 10), { from: 4, to: 25, url: 'https://example.com/a', kind: 'bare' });
  assert.equal(findTargetInLine(line, 1), null);
  const empty = 'x [](https://e.com/p) y';
  assert.deepEqual(findTargetInLine(empty, 5), { from: 2, to: 21, url: 'https://e.com/p', kind: 'empty' });
  assert.equal(findTargetInLine('[Named](https://e.com)', 3), null);
  assert.equal(findTargetInLine('<https://e.com>', 5), null);
  assert.deepEqual(findTargetInLine('[https://e.com](https://e.com)', 3)?.kind, 'empty');
});

test('locateUrl follows the URL when text was typed before it', () => {
  const url = 'https://e.com/a';
  assert.deepEqual(locateUrl(`xx ${url}`, url, 0), { from: 3, to: 3 + url.length });
  assert.deepEqual(locateUrl(`${url}`, url, 0), { from: 0, to: url.length });
  assert.equal(locateUrl('gone', url, 0), null);
  assert.equal(locateUrl(`[t](${url})`, url, 4), null);
  assert.equal(locateUrl(`${url}/longer`, url, 0), null);
  assert.deepEqual(locateUrl(`${url} ${url}`, url, 17), { from: 16, to: 31 });
});
