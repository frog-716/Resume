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
    if (typeof link.href !== "string" || !isHttpUrl(link.href)) {
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
