import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LAYOUT,
  clone,
  makeDirection,
  initialState,
  directionSortKey,
  reorderListById,
  canDeleteDirection,
} from './domain-editor.mjs';
import { createSampleResumeContent, createEmptyResumeContent } from './domain-resume-content.mjs';

test('DEFAULT_LAYOUT fixes all four margins to 9mm and is frozen', () => {
  assert.deepEqual(DEFAULT_LAYOUT.marginsMm, { top: 9, right: 9, bottom: 9, left: 9 });
  assert.ok(Object.isFrozen(DEFAULT_LAYOUT));
});

test('makeDirection deep-clones template content so copies evolve independently (S-03)', () => {
  const template = createSampleResumeContent();
  const direction = makeDirection('副本', template);
  // Mutating the new direction must not touch the original template.
  const baseline = template.sections[0].bullets.length;
  direction.currentDraft.content.sections[0].bullets.push({ id: 'x', html: '注入' });
  assert.equal(template.sections[0].bullets.length, baseline);
  assert.equal(direction.currentDraft.content.sections[0].bullets.length, baseline + 1);
});

test('makeDirection trims name and falls back to a default', () => {
  assert.equal(makeDirection('  林舟  ').name, '林舟');
  assert.equal(makeDirection('').name, '我的简历');
  assert.equal(makeDirection(undefined).name, '我的简历');
});

test('makeDirection assigns a unique id and a current draft', () => {
  const direction = makeDirection('A');
  assert.match(direction.id, /^direction-/);
  assert.ok(direction.currentDraft);
  assert.ok(direction.currentDraft.updatedAt);
});

test('initialState seeds exactly one direction with sample content', () => {
  const state = initialState();
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.directions.length, 1);
  assert.equal(state.lastOpenedDirectionId, state.directions[0].id);
  assert.equal(state.directions[0].currentDraft.content.sections.length, 4);
});

test('directionSortKey reads updatedAt then createdAt and tolerates bad dates (S-07)', () => {
  const newer = { currentDraft: { updatedAt: '2026-10-31T10:00:00.000Z' } };
  const older = { currentDraft: { updatedAt: '2026-10-30T10:00:00.000Z' } };
  assert.ok(directionSortKey(newer) > directionSortKey(older));
  assert.equal(directionSortKey({ createdAt: '2026-10-31T10:00:00.000Z' }), Date.parse('2026-10-31T10:00:00.000Z'));
  assert.equal(directionSortKey({}), 0);
  assert.equal(directionSortKey({ currentDraft: { updatedAt: 'not-a-date' } }), 0);
});

test('reorderListById reorders by ids and drops unknown ids, keeping same objects (E-07/S-06)', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const out = reorderListById(['c', 'a', 'zzz'], items);
  assert.deepEqual(out.map((i) => i.id), ['c', 'a']);
  assert.equal(out[0], items[2]); // same object reference, not a clone
  assert.equal(out[1], items[0]);
});

test('reorderListById handles empty input', () => {
  assert.deepEqual(reorderListById([], [{ id: 'a' }]), []);
});

test('canDeleteDirection blocks deleting the last direction (S-06)', () => {
  const only = [{ id: 'one' }];
  assert.equal(canDeleteDirection(only, 'one'), false);
  const many = [{ id: 'one' }, { id: 'two' }];
  assert.equal(canDeleteDirection(many, 'two'), true);
  assert.equal(canDeleteDirection(many, 'ghost'), false);
});

test('clone is a deep copy', () => {
  const src = { a: { b: [1, 2] } };
  const copy = clone(src);
  copy.a.b.push(3);
  assert.deepEqual(src.a.b, [1, 2]);
});
