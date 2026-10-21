import assert from "node:assert/strict";
import test from "node:test";

import { calculateSpacing, fitResumeLayout } from "./auto-layout.mjs";

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("calculateSpacing applies every frozen L-19 formula in pt", () => {
  const spacing = calculateSpacing(10, 0.5);

  closeTo(spacing.bodyLineHeightPt, 13.9);
  closeTo(spacing.threeColumnTitleLineHeightPt, 12.9675);
  closeTo(spacing.sameGroupBulletGapPt, 2.475);
  closeTo(spacing.sectionBeforeGapPt, 6.9);
  closeTo(spacing.largeTitleToFirstBulletGapPt, 4.3);
  closeTo(spacing.largeTitleToFirstThreeColumnGapPt, 4.73);
  closeTo(spacing.previousExperienceBulletToNextThreeColumnGapPt, 6.9);
  closeTo(spacing.threeColumnToFirstBulletGapPt, 2.52);
});

test("a short resume keeps the largest size and tightest spacing", () => {
  const calls = [];
  const result = fitResumeLayout({
    availableHeightPx: 800,
    measureContentHeightPx: (input) => {
      calls.push(input);
      return 420;
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].bodyPt, 10.5);
  assert.equal(calls[0].slack, 0);
  assert.equal(result.bodyPt, 10.5);
  assert.equal(result.slack, 0);
  assert.equal(result.fits, true);
  assert.equal(result.overflow, false);
});

test("the largest fitting font is chosen before spacing is loosened", () => {
  const calls = [];
  const result = fitResumeLayout({
    availableHeightPx: 100,
    measureContentHeightPx: (input) => {
      calls.push(input);
      return input.bodyPt === 10.5 ? 101 : 90 + 20 * input.slack;
    },
  });

  assert.equal(result.bodyPt, 10.49);
  assert.ok(calls.some((call) => call.bodyPt === 10.49 && call.slack === 0));
  const firstLoosenedCall = calls.find((call) => call.slack > 0);
  assert.equal(firstLoosenedCall.bodyPt, 10.49);
});

test("spacing loosens to the largest value that still fits", () => {
  const result = fitResumeLayout({
    availableHeightPx: 100,
    measureContentHeightPx: ({ bodyPt, slack }) =>
      bodyPt === 10.5 ? 101 : 90 + 20 * slack,
  });

  closeTo(result.slack, 0.5, 1e-6);
  assert.equal(result.bodyPt, 10.49);
  assert.ok(result.fits);
  assert.ok(result.height <= result.availableHeightPx);
  assert.ok(90 + 20 * (result.slack + 1e-5) > result.availableHeightPx);
});

test("minimum size overflow preserves the full measured content state", () => {
  const result = fitResumeLayout({
    availableHeightPx: 100,
    measureContentHeightPx: ({ bodyPt }) => 200 + bodyPt,
  });

  assert.equal(result.status, "overflow");
  assert.equal(result.bodyPt, 8.5);
  assert.equal(result.slack, 0);
  assert.equal(result.height, 208.5);
  assert.equal(result.fits, false);
  assert.equal(result.overflow, true);
  assert.equal(result.overflowPx, 108.5);
});

test("a layout that exactly reaches the available height fits", () => {
  let calls = 0;
  const result = fitResumeLayout({
    availableHeightPx: 615.25,
    measureContentHeightPx: () => {
      calls += 1;
      return 615.25;
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.status, "fits");
  assert.equal(result.height, result.availableHeightPx);
  assert.equal(result.fits, true);
  assert.equal(result.overflow, false);
  assert.equal(result.overflowPx, 0);
});
