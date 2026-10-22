/**
 * Editable resume content owned by one resume document.
 *
 * `columns` are positional fields. Work and project entries use three fields;
 * education has one section-level three-field row with a fixed 1:3:1 ratio,
 * followed by its own section-level bullets. Editable text is stored as an
 * HTML fragment in an `html` property. The supported tags are b, strong, and br.
 */

export const SECTION_ORDER = Object.freeze([
  "skills",
  "work",
  "projects",
  "education",
]);

export const EDUCATION_COLUMN_RATIO = Object.freeze([1, 3, 1]);

const SECTION_TITLES = Object.freeze({
  skills: "专业技能",
  work: "工作经历",
  projects: "项目经历",
  education: "教育背景",
});

const OPTIONAL_LINK_TYPES = Object.freeze({
  github: "github",
  personalWebsite: "personalWebsite",
});

const text = (html = "") => ({ html });
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Return a fresh, blank content document. No nested state is shared. */
export function createEmptyResumeContent() {
  return {
    identity: {
      name: text(),
      contacts: {
        phone: text(),
        email: text(),
        wechat: text(),
      },
      links: {
        github: null,
        personalWebsite: null,
      },
    },
    sections: [
      { type: "skills", title: text(SECTION_TITLES.skills), bullets: [] },
      { type: "work", title: text(SECTION_TITLES.work), entries: [] },
      { type: "projects", title: text(SECTION_TITLES.projects), entries: [] },
      {
        type: "education",
        title: text(SECTION_TITLES.education),
        columns: [text(), text(), text()],
        bullets: [],
      },
    ],
  };
}

/** Return a small fictional first-page example for UI development. */
export function createSampleResumeContent() {
  const content = createEmptyResumeContent();

  content.identity.name = text("林舟");
  content.identity.contacts = {
    phone: text("010-0000-0000"),
    email: text("lin.zhou@example.com"),
    wechat: text("linzhou-demo"),
  };
  content.identity.links = {
    github: {
      type: "github",
      href: "https://example.com/lin-zhou",
      label: text("GitHub"),
    },
    personalWebsite: {
      type: "personalWebsite",
      href: "https://example.com/lin-zhou/profile",
      label: text("个人网页"),
    },
  };

  content.sections[0].bullets = [
    { id: "skill-1", html: "熟悉前端页面开发与组件拆分" },
    { id: "skill-2", html: "能用清晰的数据结构整理业务信息" },
    { id: "skill-3", html: "关注可读性、键盘操作与页面适配" },
  ];

  content.sections[1].entries = [
    {
      id: "work-entry-1",
      columns: [
        text("星桥科技（虚构）"),
        text("前端工程师"),
        text("2022.06—至今"),
      ],
      bullets: [
        { id: "work-bullet-1", html: "维护内部运营台，让常用操作更容易查找。" },
        { id: "work-bullet-2", html: "与设计和产品同事协作，整理页面状态与交互细节。" },
      ],
    },
  ];

  content.sections[2].entries = [
    {
      id: "project-entry-1",
      columns: [
        text("城市绿行数据看板（虚构）"),
        text("个人项目"),
        text("2024.01—2024.04"),
      ],
      bullets: [
        { id: "project-bullet-1", html: "把虚构的出行数据整理为可筛选的图表页面。" },
        { id: "project-bullet-2", html: "补充空数据和窄屏状态，方便演示不同使用场景。" },
      ],
    },
  ];

  content.sections[3].columns = [
    text("2018—2022"),
    text("海岚大学（虚构）· 信息管理"),
    text("杭州（虚构）"),
  ];
  content.sections[3].bullets = [
    { id: "education-bullet-1", html: "课程项目中整理虚构数据并制作展示说明。" },
  ];

  return content;
}

/**
 * Normalize a user-typed link into a value that is safe to store and to
 * render as a clickable link.
 *
 * D-03 allows a link row to exist before it is filled in, so an empty value
 * is a legitimate intermediate state and stays empty. Anything the user
 * types without a scheme gets `https://` so L-04 keeps the printed link
 * clickable. Script-bearing schemes are refused outright: the paper renders
 * the href on an <a>, so `javascript:` would be an injection vector.
 *
 * @param {string} raw
 * @returns {string} '' or an absolute http(s) URL
 */
export function normalizeLinkHref(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (/^(?:javascript|data|vbscript|file|blob):/i.test(text)) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  if (/\s/.test(text)) return "";
  return `https://${text}`;
}

/**
 * Repair a resume content document so it can always be rendered and edited.
 *
 * The strict validator exists to protect the data model, but it must never be
 * used to *discard* a stored direction: dropping it would let the next save
 * overwrite the user's real content with an empty template. Instead this
 * function repairs what is safely repairable (missing sections, missing
 * arrays, missing ids, link schemes) and keeps everything else verbatim.
 *
 * @param {unknown} content
 * @returns {{content: object, repaired: boolean, issues: string[]}}
 */
export function repairResumeContent(content) {
  const issues = [];
  const base = createEmptyResumeContent();
  if (!isRecord(content)) {
    issues.push("content 不是对象，已重置为空白简历。");
    return { content: base, repaired: true, issues };
  }

  const out = base;
  const identity = isRecord(content.identity) ? content.identity : {};
  const contacts = isRecord(identity.contacts) ? identity.contacts : {};
  for (const key of ["phone", "email", "wechat"]) {
    const value = contacts[key];
    if (isRecord(value)) out.identity.contacts[key] = { html: String(value.html ?? ""), ...(value.align ? { align: value.align } : {}) };
  }
  const name = identity.name;
  if (isRecord(name)) out.identity.name = { html: String(name.html ?? ""), ...(name.align ? { align: name.align } : {}) };

  const links = isRecord(identity.links) ? identity.links : {};
  for (const [key, expectedType] of Object.entries(OPTIONAL_LINK_TYPES)) {
    const link = links[key];
    if (link === null || link === undefined) { out.identity.links[key] = null; continue; }
    if (!isRecord(link)) {
      issues.push(`identity.links.${key} 结构不完整，已移除该链接。`);
      out.identity.links[key] = null;
      continue;
    }
    const rawHref = typeof link.href === "string" ? link.href : "";
    const href = normalizeLinkHref(rawHref);
    if (rawHref && !href) issues.push(`identity.links.${key} 的地址无法识别，已清空该链接。`);
    else if (rawHref && href !== rawHref) issues.push(`identity.links.${key} 的地址已补全协议。`);
    const label = isRecord(link.label) ? { html: String(link.label.html ?? "") } : { html: "" };
    out.identity.links[key] = { type: expectedType, href, label, ...(link.align ? { align: link.align } : {}) };
  }

  const seenIds = new Set();
  const takeId = (id, fallback) => {
    let next = typeof id === "string" && id.trim() ? id.trim() : fallback;
    while (seenIds.has(next)) next = `${next}-${Math.random().toString(36).slice(2, 7)}`;
    seenIds.add(next);
    return next;
  };
  const repairBullets = (bullets, prefix) => {
    if (!Array.isArray(bullets)) { if (bullets !== undefined) issues.push(`${prefix}.bullets 不是数组，已置空。`); return []; }
    return bullets.map((bullet, index) => {
      if (!isRecord(bullet)) return { id: takeId(null, `${prefix}-bullet-${index + 1}`), html: "" };
      return {
        id: takeId(bullet.id, `${prefix}-bullet-${index + 1}`),
        html: String(bullet.html ?? ""),
        ...(bullet.align ? { align: bullet.align } : {}),
      };
    });
  };
  const repairColumns = (columns) => {
    const list = Array.isArray(columns) ? columns : [];
    return [0, 1, 2].map((index) => {
      const column = list[index];
      if (!isRecord(column)) return { html: "" };
      return { html: String(column.html ?? ""), ...(column.align ? { align: column.align } : {}) };
    });
  };

  const sections = Array.isArray(content.sections) ? content.sections : [];
  const byType = new Map();
  for (const section of sections) if (isRecord(section)) byType.set(section.type, section);
  SECTION_ORDER.forEach((type, index) => {
    const source = byType.get(type);
    const target = out.sections[index];
    if (!source) { issues.push(`缺少 ${type} 板块，已补空板块。`); return; }
    if (isRecord(source.title)) target.title = { html: String(source.title.html ?? ""), ...(source.title.align ? { align: source.title.align } : {}) };
    if (type === "skills") target.bullets = repairBullets(source.bullets, `sections[${index}]`);
    else if (type === "education") {
      target.columns = repairColumns(source.columns);
      target.bullets = repairBullets(source.bullets, `sections[${index}]`);
    } else {
      const entries = Array.isArray(source.entries) ? source.entries : [];
      target.entries = entries.map((entry, entryIndex) => {
        if (!isRecord(entry)) return { id: takeId(null, `${type}-entry-${entryIndex + 1}`), columns: repairColumns([]), bullets: [] };
        return {
          id: takeId(entry.id, `${type}-entry-${entryIndex + 1}`),
          columns: repairColumns(entry.columns),
          bullets: repairBullets(entry.bullets, `sections[${index}].entries[${entryIndex}]`),
        };
      });
    }
  });

  return { content: out, repaired: issues.length > 0, issues };
}

/**
 * Validate a resume content document.
 *
 * Returns `{ valid, errors }`; each error names the field path that needs
 * attention. This validates content shape without imposing a persistence or
 * snapshot format.
 */
export function validateResumeContent(content) {
  const errors = [];
  const seenIds = new Map();

  if (!isRecord(content)) {
    return { valid: false, errors: ["content must be an object."] };
  }

  validateIdentity(content.identity, errors);

  if (!Array.isArray(content.sections)) {
    errors.push('sections must be an array ordered as "skills", "work", "projects", "education".');
  } else {
    if (content.sections.length !== SECTION_ORDER.length) {
      errors.push(`sections must contain exactly ${SECTION_ORDER.length} blocks in the fixed order.`);
    }

    SECTION_ORDER.forEach((expectedType, index) => {
      const section = content.sections[index];
      const path = `sections[${index}]`;

      if (!isRecord(section)) {
        errors.push(`${path} must be an object of type "${expectedType}".`);
        return;
      }

      if (section.type !== expectedType) {
        errors.push(`${path}.type must be "${expectedType}"; received ${describe(section.type)}.`);
      }
      validateHtmlField(section.title, `${path}.title`, errors);

      if (expectedType === "skills") {
        validateBullets(section.bullets, `${path}.bullets`, errors, seenIds);
      } else if (expectedType === "work" || expectedType === "projects") {
        validateExperienceEntries(section.entries, `${path}.entries`, errors, seenIds);
      } else {
        validateColumns(section.columns, `${path}.columns`, errors);
        validateBullets(section.bullets, `${path}.bullets`, errors, seenIds);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateIdentity(identity, errors) {
  if (!isRecord(identity)) {
    errors.push("identity must be an object containing name, contacts, and links.");
    return;
  }

  validateHtmlField(identity.name, "identity.name", errors);

  if (!isRecord(identity.contacts)) {
    errors.push("identity.contacts must be an object containing phone, email, and wechat fields.");
  } else {
    for (const key of ["phone", "email", "wechat"]) {
      validateHtmlField(identity.contacts[key], `identity.contacts.${key}`, errors);
    }
  }

  if (!isRecord(identity.links)) {
    errors.push("identity.links must be an object; github and personalWebsite may each be null or a typed link.");
    return;
  }

  for (const [key, expectedType] of Object.entries(OPTIONAL_LINK_TYPES)) {
    const link = identity.links[key];
    if (link === null || link === undefined) continue;

    const path = `identity.links.${key}`;
    if (!isRecord(link)) {
      errors.push(`${path} must be null or an object with type "${expectedType}", href, and label.`);
      continue;
    }
    if (link.type !== expectedType) {
      errors.push(`${path}.type must be "${expectedType}"; received ${describe(link.type)}.`);
    }
    // 链接未填完时 href 为空串是合法中间态（D-03：填写状态删除键正常删字，
    // 文字空后再次退格才移除）。一旦填了内容，就必须是可点击的 http(s) 地址
    // （L-04），否则纸面上会渲染出点不动的链接。
    if (typeof link.href !== "string") {
      errors.push(`${path}.href must be a string.`);
    } else if (link.href !== "" && !isHttpUrl(link.href)) {
      errors.push(`${path}.href must be a valid http or https URL string.`);
    }
    validateAlignment(link.align, `${path}.align`, errors);
    validateHtmlField(link.label, `${path}.label`, errors);
  }
}

function validateExperienceEntries(entries, path, errors, seenIds) {
  if (!Array.isArray(entries)) {
    errors.push(`${path} must be an array of experience entries.`);
    return;
  }

  entries.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${entryPath} must be an object with id, three columns, and a bullets array.`);
      return;
    }
    validateId(entry.id, `${entryPath}.id`, errors, seenIds);
    validateColumns(entry.columns, `${entryPath}.columns`, errors);
    validateBullets(entry.bullets, `${entryPath}.bullets`, errors, seenIds);
  });
}

function validateColumns(columns, path, errors) {
  if (!Array.isArray(columns) || columns.length !== 3) {
    errors.push(`${path} must be an array containing exactly 3 HTML fields.`);
    return;
  }
  columns.forEach((column, index) => validateHtmlField(column, `${path}[${index}]`, errors));
}

function validateBullets(bullets, path, errors, seenIds) {
  if (!Array.isArray(bullets)) {
    errors.push(`${path} must be an array of bullets.`);
    return;
  }

  bullets.forEach((bullet, index) => {
    const bulletPath = `${path}[${index}]`;
    if (!isRecord(bullet)) {
      errors.push(`${bulletPath} must be an object with a unique id and an html string.`);
      return;
    }
    validateId(bullet.id, `${bulletPath}.id`, errors, seenIds);
    validateHtmlString(bullet.html, `${bulletPath}.html`, errors);
    validateAlignment(bullet.align, `${bulletPath}.align`, errors);
  });
}

function validateId(id, path, errors, seenIds) {
  if (typeof id !== "string" || id.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
    return;
  }
  const previousPath = seenIds.get(id);
  if (previousPath) {
    errors.push(`${path} duplicates id ${JSON.stringify(id)} already used at ${previousPath}.`);
  } else {
    seenIds.set(id, path);
  }
}

function validateHtmlField(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object with an html string.`);
    return;
  }
  validateHtmlString(value.html, `${path}.html`, errors);
  validateAlignment(value.align, `${path}.align`, errors);
}

function validateAlignment(value, path, errors) {
  if (value !== undefined && !["left", "center", "right"].includes(value)) {
    errors.push(`${path} must be "left", "center", or "right" when provided.`);
  }
}

function validateHtmlString(value, path, errors) {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string HTML fragment.`);
    return;
  }

  const remaining = value.replace(/<\/?(?:b|strong)>|<br\s*\/?>/gi, "");
  if (/[<>]/.test(remaining)) {
    errors.push(`${path} may contain text and only <b>, <strong>, or <br> tags.`);
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function describe(value) {
  return value === undefined ? "missing" : JSON.stringify(value);
}
