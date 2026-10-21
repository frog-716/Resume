const SLACK_SEARCH_TOLERANCE = 1e-6;

/**
 * Return the formula-driven line heights and gaps from SPEC L-19, in points.
 * The fixed 18.5px contact-to-first-section distance is outside this model.
 *
 * @param {number} bodyPt Body font size in points.
 * @param {number} slack Shared spacing looseness from 0 (tightest) to 1.
 */
export function calculateSpacing(bodyPt, slack) {
  if (!Number.isFinite(bodyPt) || bodyPt <= 0) {
    throw new RangeError("bodyPt must be a finite positive number");
  }
  if (!Number.isFinite(slack) || slack < 0 || slack > 1) {
    throw new RangeError("slack must be a finite number between 0 and 1");
  }

  return {
    bodyLineHeightPt: bodyPt * (1.36 + 0.06 * slack),
    threeColumnTitleLineHeightPt: (bodyPt + 0.5) * (1.22 + 0.03 * slack),
    sameGroupBulletGapPt: 0.22 * bodyPt * (1 + 0.25 * slack),
    sectionBeforeGapPt: 0.60 * bodyPt * (1 + 0.30 * slack),
    largeTitleToFirstBulletGapPt: 0.40 * bodyPt * (1 + 0.15 * slack),
    largeTitleToFirstThreeColumnGapPt: 0.44 * bodyPt * (1 + 0.15 * slack),
    previousExperienceBulletToNextThreeColumnGapPt:
      0.60 * bodyPt * (1 + 0.30 * slack),
    threeColumnToFirstBulletGapPt: 0.24 * bodyPt * (1 + 0.10 * slack),
  };
}

/**
 * Find the largest body size that fits at minimum spacing, then the largest
 * spacing looseness that still fits at that size. Content measurement is
 * supplied by the caller because the production app measures real DOM layout.
 *
 * @param {object} options
 * @param {(input: {bodyPt: number, slack: number, spacing: ReturnType<typeof calculateSpacing>}) => number} options.measureContentHeightPx
 * @param {number} options.availableHeightPx
 * @param {number} [options.minBodyPt=8.5]
 * @param {number} [options.maxBodyPt=10.5]
 * @param {number} [options.bodyStepPt=0.01]
 */
export function fitResumeLayout({
  measureContentHeightPx,
  availableHeightPx,
  minBodyPt = 8.5,
  maxBodyPt = 10.5,
  bodyStepPt = 0.01,
}) {
  if (typeof measureContentHeightPx !== "function") {
    throw new TypeError("measureContentHeightPx must be a function");
  }
  if (!Number.isFinite(availableHeightPx) || availableHeightPx < 0) {
    throw new RangeError("availableHeightPx must be a finite non-negative number");
  }
  if (!Number.isFinite(minBodyPt) || minBodyPt <= 0) {
    throw new RangeError("minBodyPt must be a finite positive number");
  }
  if (!Number.isFinite(maxBodyPt) || maxBodyPt < minBodyPt) {
    throw new RangeError("maxBodyPt must be finite and greater than or equal to minBodyPt");
  }
  if (!Number.isFinite(bodyStepPt) || bodyStepPt <= 0) {
    throw new RangeError("bodyStepPt must be a finite positive number");
  }

  const measuredHeights = new Map();
  const measure = (bodyPt, slack) => {
    const key = `${bodyPt}:${slack}`;
    if (measuredHeights.has(key)) return measuredHeights.get(key);

    const height = measureContentHeightPx({
      bodyPt,
      slack,
      spacing: calculateSpacing(bodyPt, slack),
    });
    if (!Number.isFinite(height) || height < 0) {
      throw new RangeError("measureContentHeightPx must return a finite non-negative height");
    }
    measuredHeights.set(key, height);
    return height;
  };

  const result = (bodyPt, slack, height) => {
    const fits = height <= availableHeightPx;
    return {
      status: fits ? "fits" : "overflow",
      bodyPt,
      slack,
      spacing: calculateSpacing(bodyPt, slack),
      height,
      availableHeightPx,
      fits,
      overflow: !fits,
      overflowPx: Math.max(0, height - availableHeightPx),
    };
  };

  // L-19 first tries the largest size with the tightest spacing. A short
  // resume keeps this exact layout; its gaps are never stretched to fill paper.
  const maxHeight = measure(maxBodyPt, 0);
  if (maxHeight <= availableHeightPx) return result(maxBodyPt, 0, maxHeight);

  let bodyPt;
  let bodyHeight;
  for (const candidate of descendingBodySizes(maxBodyPt, minBodyPt, bodyStepPt)) {
    const height = measure(candidate, 0);
    if (height <= availableHeightPx) {
      bodyPt = candidate;
      bodyHeight = height;
      break;
    }
  }

  // At minimum size and minimum spacing, keep the full measured content and
  // report overflow so the caller can pause PDF export and ask for edits.
  if (bodyPt === undefined) return result(minBodyPt, 0, measure(minBodyPt, 0));

  const heightAtFullSlack = measure(bodyPt, 1);
  if (heightAtFullSlack <= availableHeightPx) {
    return result(bodyPt, 1, heightAtFullSlack);
  }

  // Content height is expected to grow as spacing loosens. Keep the known
  // fitting lower bound and narrow the boundary to 1e-6 slack precision.
  let fittingSlack = 0;
  let fittingHeight = bodyHeight;
  let overflowingSlack = 1;
  while (overflowingSlack - fittingSlack > SLACK_SEARCH_TOLERANCE) {
    const middleSlack = (fittingSlack + overflowingSlack) / 2;
    const height = measure(bodyPt, middleSlack);
    if (height <= availableHeightPx) {
      fittingSlack = middleSlack;
      fittingHeight = height;
    } else {
      overflowingSlack = middleSlack;
    }
  }

  return result(bodyPt, fittingSlack, fittingHeight);
}

function* descendingBodySizes(maxBodyPt, minBodyPt, bodyStepPt) {
  const range = maxBodyPt - minBodyPt;
  const wholeSteps = Math.floor(range / bodyStepPt + 1e-10);
  let lastCandidate = maxBodyPt;

  for (let index = 1; index <= wholeSteps; index += 1) {
    const rawCandidate = maxBodyPt - index * bodyStepPt;
    const candidate = Number(rawCandidate.toFixed(12));
    if (candidate <= minBodyPt) {
      yield minBodyPt;
      return;
    }
    yield candidate;
    lastCandidate = candidate;
  }

  if (Math.abs(lastCandidate - minBodyPt) > 1e-10) yield minBodyPt;
}
