// Pure editor-side business rules for resume directions and ordering.
//
// No DOM, no chrome.* APIs, no storage — safe to unit test in plain Node.
// These mirror the rules that still run inside sidepanel.mjs so the
// acceptance-critical behaviour (direction lifecycle, ordering, delete guard)
// has real coverage instead of relying on manual Chrome verification alone.

import { createEmptyResumeContent, createSampleResumeContent } from './domain-resume-content.mjs';

export const DEFAULT_LAYOUT = Object.freeze({ marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } });

export function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function uid(prefix = 'item') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function nowIso() { return new Date().toISOString(); }

// S-03 / S-01: a direction owns one auto-saved current draft. The content and
// layout are deep-cloned so the new direction evolves independently of its
// template (modifying one never leaks into the other).
export function makeDirection(name, content = createEmptyResumeContent(), currentLayout = DEFAULT_LAYOUT) {
  const createdAt = nowIso();
  return {
    id: uid('direction'),
    name: String(name || '我的简历').trim() || '我的简历',
    createdAt,
    currentDraft: { content: clone(content), layout: clone(currentLayout), updatedAt: createdAt },
  };
}

// First run: exactly one direction seeded with fictional sample content.
export function initialState() {
  const direction = makeDirection('我的简历', createSampleResumeContent());
  return { schemaVersion: 1, lastOpenedDirectionId: direction.id, directions: [direction] };
}

// S-07: direction room orders by most-recent-edit time, newest first.
// A direction with no usable date sorts as the oldest (key 0).
export function directionSortKey(direction) {
  const raw = direction?.currentDraft?.updatedAt || direction?.createdAt;
  if (!raw) return 0;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? 0 : time;
}

// E-07 / S-06: ordering stays inside one list/section. Reorder `items` to match
// `orderedIds`, keeping only ids that exist in `items`; unknown or missing ids
// are dropped rather than crashing (mirrors finishDrag in sidepanel).
export function reorderListById(orderedIds, items) {
  const map = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => map.get(id)).filter(Boolean);
}

// S-06: at least one direction must remain; the last one cannot be deleted.
export function canDeleteDirection(directions, id) {
  if (directions.length <= 1) return false;
  return directions.some((direction) => direction.id === id);
}
