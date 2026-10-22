import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyResumeContent,
  createSampleResumeContent,
  EDUCATION_COLUMN_RATIO,
  SECTION_ORDER,
  validateResumeContent,
  normalizeLinkHref,
  repairResumeContent,
} from "./domain-resume-content.mjs";

test("empty content has four fixed sections and owns fresh per-resume data", () => {
  const first = createEmptyResumeContent();
  const second = createEmptyResumeContent();

  assert.deepEqual(first.sections.map((section) => section.type), SECTION_ORDER);
  assert.deepEqual(first.sections.map((section) => section.title.html), [
    "专业技能",
    "工作经历",
    "项目经历",
    "教育背景",
  ]);
  assert.deepEqual(first.identity.links, { github: null, personalWebsite: null });
  assert.deepEqual(validateResumeContent(first), { valid: true, errors: [] });

  first.identity.name.html = "林舟";
  first.sections[0].title.html = "改过的标题";
  assert.equal(second.identity.name.html, "");
  assert.equal(second.sections[0].title.html, "专业技能");
  assert.notEqual(first.identity, second.identity);
  assert.notEqual(first.sections[0], second.sections[0]);
});

test("fictional sample has three-column rows, stable ids, and example.com links", () => {
  const sample = createSampleResumeContent();
  const result = validateResumeContent(sample);

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.deepEqual([...EDUCATION_COLUMN_RATIO], [1, 3, 1]);
  assert.equal(sample.identity.name.html, "林舟");
  assert.equal(sample.sections[1].entries[0].columns.length, 3);
  assert.equal(sample.sections[2].entries[0].columns.length, 3);
  assert.equal(sample.sections[3].columns.length, 3);
  assert.deepEqual(sample.sections[3].bullets.map((bullet) => bullet.id), ["education-bullet-1"]);

  const linkHrefs = Object.values(sample.identity.links).map((link) => link.href);
  assert.ok(linkHrefs.length > 0);
  assert.ok(linkHrefs.every((href) => new URL(href).hostname === "example.com"));
  assert.match(JSON.stringify(sample), /虚构/);

  const ids = [
    ...sample.sections[0].bullets.map((bullet) => bullet.id),
    ...sample.sections[1].entries.flatMap((entry) => [entry.id, ...entry.bullets.map((bullet) => bullet.id)]),
    ...sample.sections[2].entries.flatMap((entry) => [entry.id, ...entry.bullets.map((bullet) => bullet.id)]),
    ...sample.sections[3].bullets.map((bullet) => bullet.id),
  ];
  assert.equal(new Set(ids).size, ids.length);
});

test("validator reports fixed-order, section-type, and bullets-array errors", () => {
  const content = createEmptyResumeContent();
  [content.sections[0], content.sections[1]] = [content.sections[1], content.sections[0]];
  content.sections[2].entries = {};

  const { valid, errors } = validateResumeContent(content);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes('sections[0].type must be "skills"')));
  assert.ok(errors.some((error) => error.includes('sections[0].bullets must be an array')));
  assert.ok(errors.some((error) => error.includes('sections[1].type must be "work"')));
  assert.ok(errors.some((error) => error.includes("sections[2].entries must be an array")));
});

test("validator requires three fields in experience rows and the education row", () => {
  const content = createSampleResumeContent();
  content.sections[1].entries[0].columns.pop();
  content.sections[3].columns.pop();

  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes("sections[1].entries[0].columns must be an array containing exactly 3")));
  assert.ok(errors.some((error) => error.includes("sections[3].columns must be an array containing exactly 3")));
});

test("education bullets belong to the education section and must be an array", () => {
  const content = createEmptyResumeContent();
  content.sections[3].bullets = null;

  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes("sections[3].bullets must be an array of bullets")));
});

test("validator catches duplicate ids across entries and bullets", () => {
  const content = createSampleResumeContent();
  content.sections[2].entries[0].bullets[0].id = content.sections[1].entries[0].id;

  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes('duplicates id "work-entry-1"')));
});

test("optional contact links may be empty but supplied links need their declared type", () => {
  const content = createEmptyResumeContent();
  assert.equal(validateResumeContent(content).valid, true);

  content.identity.links.personalWebsite = {
    type: "github",
    href: "https://example.com/profile",
    label: { html: "个人网页" },
  };
  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes('identity.links.personalWebsite.type must be "personalWebsite"')));
});

test("editable HTML fields reject tags outside the supported set", () => {
  const content = createEmptyResumeContent();
  content.sections[0].bullets = [{ id: "skill-1", html: "<em>强调</em>" }];

  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes("sections[0].bullets[0].html may contain text and only <b>, <strong>, or <br> tags")));
});

test("alignment choices are stored per editable field and limited to left, center, or right", () => {
  const content = createSampleResumeContent();
  content.identity.name.align = "left";
  content.sections[0].bullets[0].align = "center";
  content.sections[1].entries[0].columns[0].align = "right";
  assert.equal(validateResumeContent(content).valid, true);

  content.sections[0].bullets[0].align = "justify";
  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes('sections[0].bullets[0].align must be "left", "center", or "right"')));
});

test("an unfilled link is valid so adding a link never invalidates the whole direction", () => {
  const content = createEmptyResumeContent();
  // D-03: the link row exists before it is filled in.
  content.identity.links.github = { type: "github", href: "", label: { html: "GitHub" } };
  assert.equal(validateResumeContent(content).valid, true);
});

test("a filled link must be http or https", () => {
  const content = createEmptyResumeContent();
  content.identity.links.github = { type: "github", href: "ftp://example.com", label: { html: "GitHub" } };
  const { errors } = validateResumeContent(content);
  assert.ok(errors.some((error) => error.includes("identity.links.github.href must be a valid http or https URL string")));
});

test("normalizeLinkHref keeps empty, completes the scheme, and refuses script urls", () => {
  assert.equal(normalizeLinkHref(""), "");
  assert.equal(normalizeLinkHref("   "), "");
  assert.equal(normalizeLinkHref("https://github.com/frog"), "https://github.com/frog");
  assert.equal(normalizeLinkHref("github.com/frog"), "https://github.com/frog");
  assert.equal(normalizeLinkHref("//github.com/frog"), "https://github.com/frog");
  assert.equal(normalizeLinkHref("javascript:alert(1)"), "");
  assert.equal(normalizeLinkHref("data:text/html,<script>"), "");
  assert.equal(normalizeLinkHref("has space"), "");
});

test("repairResumeContent keeps a direction usable instead of discarding it", () => {
  // The scenario that used to destroy data: a link without a scheme made the
  // whole direction invalid, loadStore dropped it, and the next save wrote an
  // empty template over the user's real content.
  const content = createSampleResumeContent();
  content.identity.links.github = { type: "github", href: "github.com/frog", label: { html: "GitHub" } };

  const { content: repaired, repaired: changed, issues } = repairResumeContent(content);
  assert.equal(validateResumeContent(repaired).valid, true);
  assert.equal(changed, true);
  assert.ok(issues.length > 0);
  assert.equal(repaired.identity.links.github.href, "https://github.com/frog");
  // 正文一字未改。
  assert.equal(repaired.sections[0].bullets[0].html, content.sections[0].bullets[0].html);
});

test("repairResumeContent fills missing sections, arrays, and ids", () => {
  const broken = { identity: {}, sections: [{ type: "skills", bullets: [{ html: "无 id 的要点" }] }] };
  const { content: repaired } = repairResumeContent(broken);

  assert.deepEqual(repaired.sections.map((section) => section.type), SECTION_ORDER);
  assert.equal(validateResumeContent(repaired).valid, true);
  assert.ok(repaired.sections[0].bullets[0].id);
  assert.equal(repaired.sections[0].bullets[0].html, "无 id 的要点");
  assert.equal(repaired.sections[3].columns.length, 3);
});

test("repairResumeContent de-duplicates ids so the direction stays valid", () => {
  const content = createSampleResumeContent();
  content.sections[0].bullets[1].id = content.sections[0].bullets[0].id;

  const { content: repaired } = repairResumeContent(content);
  assert.equal(validateResumeContent(repaired).valid, true);
});

test("repairResumeContent keeps a direction whose links were never filled in", () => {
  // D-03: 点"＋GitHub"后 href 是空串。这是合法的中间态，
  // 不能因此让整份简历被判 invalid 而在重开时被丢弃。
  const content = createEmptyResumeContent();
  content.identity.links.github = { type: "github", href: "", label: { html: "GitHub" } };
  const { content: repaired } = repairResumeContent(content);
  assert.equal(validateResumeContent(repaired).valid, true);
  assert.equal(repaired.identity.links.github.href, "");
});

test("repairResumeContent never drops body text when normalizing a link", () => {
  const content = createSampleResumeContent();
  const before = content.sections[1].entries[0].bullets.map((bullet) => bullet.html);
  content.identity.links.github = { type: "github", href: "github.com/frog", label: { html: "GitHub" } };

  const { content: repaired } = repairResumeContent(content);
  assert.deepEqual(repaired.sections[1].entries[0].bullets.map((bullet) => bullet.html), before);
  assert.equal(repaired.identity.links.github.href, "https://github.com/frog");
});

test("repairResumeContent keeps a link the user deliberately blanked", () => {
  // 用户可能主动把地址清空。修复不能把"空"当成"坏"而丢掉这个链接位。
  const content = createEmptyResumeContent();
  content.identity.links.personalWebsite = { type: "personalWebsite", href: "", label: { html: "个人网页" } };
  const { content: repaired } = repairResumeContent(content);
  assert.notEqual(repaired.identity.links.personalWebsite, null);
  assert.equal(repaired.identity.links.personalWebsite.href, "");
});
