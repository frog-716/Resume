import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runsHtml } from './text-runs.mjs';

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
