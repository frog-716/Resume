import assert from 'node:assert/strict';

// Coarse calculation model for the linked-font-and-spacing idea.
// This does not render HTML or claim exact PingFang/Times New Roman line wraps.
const LIMITS = {
  body: [8.5, 10.5],
  line: [1.25, 1.5],
  head: [1.2, 1.4],
  bullet: [0.75, 2.25],
  section: [5, 10],
};
const RATIO = { line: 1.375, head: 1.3, bullet: 0.1579, section: 0.7895 };
const AVAILABLE_PT = 279 * 72 / 25.4;
const TEXT_WIDTH_PT = 530; // Roughly the 192mm text area, minus the bullet indent.
const SAMPLE_BULLET_LENGTHS = [24, 38, 52, 68, 84, 105, 130];
const FIXED_CONTENT_HEIGHTS_PT = [160, 180, 200, 220];

function gaps(body) {
  return {
    line: RATIO.line,
    head: RATIO.head,
    bullet: body * RATIO.bullet,
    section: body * RATIO.section,
  };
}

function bodyLineCount(body, bulletLengths) {
  // One Chinese full-width character is approximated as one em.
  return bulletLengths.reduce((total, chars) => total + Math.max(1, Math.ceil(chars * body / TEXT_WIDTH_PT)), 0);
}

function pageHeight(body, { work, projects, bulletLengths, fixedHeightPt }) {
  const bulletCount = bulletLengths.length;
  const listCount = 2 + work + projects; // Skills, work entries, project entries, education.
  const bulletGapCount = Math.max(0, bulletCount - listCount);
  const experienceRows = work + projects; // Assumes each three-column row stays on one line.
  const lineCount = bodyLineCount(body, bulletLengths);

  return fixedHeightPt
    + experienceRows * ((body + 0.5) * RATIO.head + 5.25) // Three-column row plus 3px/4px padding.
    + lineCount * body * RATIO.line
    + bulletGapCount * body * RATIO.bullet
    + 3 * body * RATIO.section // The first section's contact gap is fixed.
    + listCount * 3; // Approximate 2px top and bottom list margins.
}

function chooseLargestFittingFont(scenario) {
  for (let hundredths = 1050; hundredths >= 850; hundredths -= 1) {
    const body = hundredths / 100;
    const height = pageHeight(body, scenario);
    if (height <= AVAILABLE_PT) return { body, height, blank: AVAILABLE_PT - height };
  }
  return null;
}

function bulletLengthsFor(count, work, projects) {
  return Array.from({ length: count }, (_, i) => SAMPLE_BULLET_LENGTHS[(i * 3 + work + projects) % SAMPLE_BULLET_LENGTHS.length]);
}

function validateRatioBounds() {
  let previous = null;
  for (let hundredths = 850; hundredths <= 1050; hundredths += 1) {
    const body = hundredths / 100;
    const value = gaps(body);
    assert(value.line >= LIMITS.line[0] && value.line <= LIMITS.line[1]);
    assert(value.head >= LIMITS.head[0] && value.head <= LIMITS.head[1]);
    assert(value.bullet >= LIMITS.bullet[0] && value.bullet <= LIMITS.bullet[1]);
    assert(value.section >= LIMITS.section[0] && value.section <= LIMITS.section[1]);
    if (previous) {
      assert(value.bullet >= previous.bullet);
      assert(value.section >= previous.section);
    }
    previous = value;
  }
}

function run() {
  validateRatioBounds();
  let scenarios = 0;
  let maxFont = 0;
  let reducedFont = 0;
  let overflow = 0;
  let monotonicityChecks = 0;

  for (const fixedHeightPt of FIXED_CONTENT_HEIGHTS_PT) {
    for (let work = 1; work <= 3; work += 1) {
      for (let projects = 1; projects <= 3; projects += 1) {
        const listCount = 2 + work + projects;
        for (let bulletCount = listCount; bulletCount <= 30; bulletCount += 1) {
          const bulletLengths = bulletLengthsFor(bulletCount, work, projects);
          const scenario = { work, projects, bulletLengths, fixedHeightPt };
          const result = chooseLargestFittingFont(scenario);
          scenarios += 1;

          if (!result) {
            overflow += 1;
          } else if (result.body === LIMITS.body[1]) {
            maxFont += 1;
          } else {
            reducedFont += 1;
          }

          // Adding a long bullet to the same list cannot make the chosen font larger.
          const moreText = chooseLargestFittingFont({
            ...scenario,
            bulletLengths: [...bulletLengths, 130],
          });
          if (result && moreText) assert(moreText.body <= result.body);
          monotonicityChecks += 1;
        }
      }
    }
  }

  console.log(`模拟场景：${scenarios} 个（工作/项目各 1–3 段；要点 4–30 条；固定内容高度 160/180/200/220pt）。`);
  console.log(`10.50pt 可用：${maxFont} 个；需要一起缩小：${reducedFont} 个；8.50pt 仍超出：${overflow} 个。`);
  console.log(`增加一条长要点后字号反而变大的情况：0/${monotonicityChecks}。`);

  for (const fixedHeightPt of FIXED_CONTENT_HEIGHTS_PT) {
    const work = 2;
    const projects = 2;
    const short = Array.from({ length: 2 + work + projects }, () => 38);
    const mixed = bulletLengthsFor(short.length + 12, work, projects);
    const shortResult = chooseLargestFittingFont({ work, projects, bulletLengths: short, fixedHeightPt });
    const mixedResult = chooseLargestFittingFont({ work, projects, bulletLengths: mixed, fixedHeightPt });
    console.log(
      `固定内容${fixedHeightPt}pt，工作2段+项目2段：6条短要点→${shortResult?.body.toFixed(2) ?? '超页'}pt；`
      + `18条长短混合要点→${mixedResult?.body.toFixed(2) ?? '超页'}pt。`,
    );
  }
}

run();
