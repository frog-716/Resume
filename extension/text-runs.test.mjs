import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runsHtml, caretIndexFrom, caretLocation } from './text-runs.mjs';

// L-14: Chinese renders in PingFang SC, Latin letters and digits in Times New
// Roman. runsHtml splits a bare string into run spans by script without touching
// the stored HTML model. ASCII punctuation inherits the neighbouring script
// (so it lands in run-en/run-zh rather than its own class) — that is the
// deployed behaviour and what these tests lock in.

test('runsHtml wraps Chinese in run-zh spans', () => {
  assert.equal(runsHtml('简历'), '<span class="run-zh">简历</span>');
});

test('runsHtml wraps Latin in run-en spans', () => {
  assert.equal(runsHtml('Resume'), '<span class="run-en">Resume</span>');
});

test('runsHtml wraps digits in run-num spans', () => {
  assert.equal(runsHtml('2026'), '<span class="run-num">2026</span>');
});

test('runsHtml splits a Chinese + Latin string into the right run order', () => {
  const out = runsHtml('林舟Resume');
  assert.match(out, /^<span class="run-zh">林舟<\/span>/);
  assert.ok(out.includes('<span class="run-en">Resume</span>'));
});

test('runsHtml splits a Latin + digit + Chinese string into three runs', () => {
  const out = runsHtml('A4纸');
  assert.ok(out.includes('<span class="run-en">A</span>'));
  assert.ok(out.includes('<span class="run-num">4</span>'));
  assert.ok(out.includes('<span class="run-zh">纸</span>'));
});

test('runsHtml escapes HTML-significant characters inside a single run span', () => {
  const out = runsHtml('<b>&"\'</b>');
  assert.ok(out.startsWith('<span class="run-'));
  assert.ok(out.endsWith('</span>'));
  assert.ok(out.includes('&lt;'));
  assert.ok(out.includes('&gt;'));
  assert.ok(out.includes('&amp;'));
  assert.ok(out.includes('&quot;'));
  assert.ok(out.includes('&#39;'));
  assert.ok(out.includes('&lt;/b&gt;'));
});

test('runsHtml treats null/empty input as empty string', () => {
  assert.equal(runsHtml(''), '');
  assert.equal(runsHtml(null), '');
  assert.equal(runsHtml(undefined), '');
});

// 光标换算：normalizeFieldRuns 重写子节点前后要靠这两个纯函数保住光标位置。
// 越界一律夹到合法范围，绝不返回 undefined 让调用方把光标丢到开头。

test('caretIndexFrom adds up preceding node lengths', () => {
  assert.equal(caretIndexFrom([3, 2, 4], 0, 0), 0);
  assert.equal(caretIndexFrom([3, 2, 4], 0, 2), 2);
  assert.equal(caretIndexFrom([3, 2, 4], 1, 1), 4);
  assert.equal(caretIndexFrom([3, 2, 4], 2, 4), 9);
});

test('caretIndexFrom clamps offsets and rejects unknown nodes', () => {
  assert.equal(caretIndexFrom([3, 2], 1, 99), 5);
  assert.equal(caretIndexFrom([3, 2], 0, -4), 0);
  assert.equal(caretIndexFrom([3, 2], 5, 0), null);
  assert.equal(caretIndexFrom([], 0, 0), null);
});

test('caretLocation maps a character offset back onto nodes', () => {
  // 偏移正好落在两节点交界处时贴在前一个节点末尾——视觉上是同一个位置，
  // 且不会把光标塞进紧邻的空 span。
  assert.deepEqual(caretLocation([3, 2, 4], 0), { nodeIndex: 0, offsetInNode: 0 });
  assert.deepEqual(caretLocation([3, 2, 4], 3), { nodeIndex: 0, offsetInNode: 3 });
  assert.deepEqual(caretLocation([3, 2, 4], 4), { nodeIndex: 1, offsetInNode: 1 });
  assert.deepEqual(caretLocation([3, 2, 4], 5), { nodeIndex: 1, offsetInNode: 2 });
  assert.deepEqual(caretLocation([3, 2, 4], 6), { nodeIndex: 2, offsetInNode: 1 });
});

test('caretLocation clamps past-the-end offsets to the last node', () => {
  assert.deepEqual(caretLocation([3, 2], 99), { nodeIndex: 1, offsetInNode: 2 });
  assert.equal(caretLocation([], 0), null);
  assert.equal(caretLocation([3], -1), null);
  assert.equal(caretLocation([3], NaN), null);
});

test('caret offset round-trips through both helpers', () => {
  const lengths = [2, 3, 4];
  for (let index = 0; index <= 9; index += 1) {
    const location = caretLocation(lengths, index);
    assert.equal(caretIndexFrom(lengths, location.nodeIndex, location.offsetInNode), index);
  }
});
