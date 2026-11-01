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
  ensurePrototypeDirection,
  isPrototypeDirection,
  makePrototypeDirection,
  PROTOTYPE_ID,
  PROTOTYPE_NAME,
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

test('initialState seeds the prototype as an ordinary direction (S-09)', () => {
  const state = initialState();
  const [prototype] = state.directions;
  assert.equal(prototype.id, PROTOTYPE_ID);
  assert.equal(prototype.name, PROTOTYPE_NAME);
  assert.equal(state.lastOpenedDirectionId, PROTOTYPE_ID);
  // 与普通方向同构：同样的 currentDraft 形状、同样的布局字段，可被编辑与打印。
  assert.deepEqual(Object.keys(prototype.currentDraft).sort(), ['content', 'layout', 'updatedAt']);
  assert.equal(prototype.currentDraft.layout.bodyPt > 0, true);
  assert.equal(prototype.currentDraft.content.sections.length, 4);
});

test('ensurePrototypeDirection appends the prototype to an older store without touching it', () => {
  const existing = makeDirection('AI产品经理');
  const { directions, added } = ensurePrototypeDirection([existing]);
  assert.equal(added, true);
  assert.equal(directions.length, 2);
  assert.equal(directions[0].id, PROTOTYPE_ID);
  assert.equal(directions[1], existing);

  const again = ensurePrototypeDirection(directions);
  assert.equal(again.added, false);
  assert.equal(again.directions.length, 2);
});

test('isPrototypeDirection recognises the built-in direction by id or marker (S-09)', () => {
  assert.equal(isPrototypeDirection(makePrototypeDirection()), true);
  assert.equal(isPrototypeDirection({ id: PROTOTYPE_ID }), true);
  assert.equal(isPrototypeDirection({ id: 'direction-x', builtin: true }), true);
  assert.equal(isPrototypeDirection({ id: 'direction-x', builtin: false }), false);
  assert.equal(isPrototypeDirection(makeDirection('我的简历')), false);
  assert.equal(isPrototypeDirection(null), false);
});

test('canDeleteDirection refuses to delete the prototype (S-09)', () => {
  const prototype = makePrototypeDirection();
  const other = makeDirection('我的简历');
  assert.equal(canDeleteDirection([prototype, other], PROTOTYPE_ID), false);
  assert.equal(canDeleteDirection([prototype, other], other.id), true);
  // 改名只是改 name：同一份内置简历仍然删不掉。
  const renamed = { ...prototype, name: '原型 · FDE' };
  assert.equal(canDeleteDirection([renamed, other], renamed.id), false);
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
