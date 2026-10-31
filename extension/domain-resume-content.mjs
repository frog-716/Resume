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

/**
 * Return the "原型" template: a complete, ATS-friendly sample resume for a
 * Forward Deployed Engineer (FDE).
 *
 * Content rules kept deliberately plain so parsers keep it intact:
 * - Four standard sections in a fixed order, no graphics, no columns tricks.
 * - Each bullet is one achievement: action verb + scope + measurable result.
 * - Keywords (FDE, RAG, Agent, Kubernetes, POC, Technical Discovery …) appear
 *   organically inside sentences instead of a keyword dump.
 * Contact details use placeholder digits and example.com on purpose; the file
 * ships in the extension bundle and must never carry real personal data.
 */
export function createSampleResumeContent() {
  const content = createEmptyResumeContent();

  content.identity.name = text("陈叙");
  content.identity.contacts = {
    phone: text("138-0000-0000"),
    email: text("chen.xu@example.com"),
    wechat: text("chenxu-fde"),
  };
  content.identity.links = {
    github: {
      type: "github",
      href: "https://example.com/chenxu/github",
      label: text("GitHub"),
    },
    personalWebsite: {
      type: "personalWebsite",
      href: "https://example.com/chenxu",
      label: text("作品集"),
    },
  };

  content.sections[0].bullets = [
    { id: "skill-1", html: "<b>语言与框架</b>：Python、TypeScript、Go、Java、SQL、Rust；FastAPI、gRPC、React、Next.js、Node.js、Django、Celery" },
    { id: "skill-2", html: "<b>AI 工程</b>：RAG、Agentic Workflow、Function Calling、LangGraph、vLLM、SFT / DPO 微调、评测体系与幻觉治理" },
    { id: "skill-3", html: "<b>数据与云原生</b>：PostgreSQL、ClickHouse、Kafka、Flink、Airflow、Hive、Kubernetes、Terraform、AWS / 阿里云" },
    { id: "skill-4", html: "<b>交付方法论</b>：Technical Discovery、POC 验证、Solution Architecture、交付风险管控、SLA 保障、可观测性与交付资产管理" },
    { id: "skill-5", html: "<b>证书与语言</b>：AWS Solutions Architect Professional、CKA、TOGAF；雅思 8.0，可全英文独立驻场交付与方案答辩" },
  ];

  content.sections[1].entries = [
    {
      id: "work-entry-1",
      columns: [
        text("字节跳动 · 火山引擎"),
        text("高级前向部署工程师（Senior FDE）"),
        text("2022.07—至今"),
      ],
      bullets: [
        { id: "work-bullet-1", html: "主导 12 家头部客户（金融、汽车、零售）的大模型应用落地，交付周期由 14 周压缩至 7 周，客户续约率 <b>94%</b>。" },
        { id: "work-bullet-2", html: "设计 RAG 知识中台并覆盖 6 类知识库场景，知识命中率 68%→<b>96%</b>，人工转接率降 41%，单客户年省 1200 万元。" },
        { id: "work-bullet-3", html: "沉淀可复用 FDE 交付脚手架（FastAPI + LangGraph + 自动评测），输出 24 个行业模板，冷启动时间缩短 <b>60%</b>。" },
        { id: "work-bullet-4", html: "带领 6 人虚拟团队对接客户 CTO / CIO，完成 20+ 次技术尽调与方案评审，推动 4 个千万级订单签约，回款 1.1 亿。" },
        { id: "work-bullet-12", html: "建立交付复盘与故障归档机制，沉淀 30 篇方案与故障文档并纳入新人培养，人均效率提升 <b>35%</b>，故障复发率降 28%。" },
        { id: "work-bullet-14", html: "推动 CI/CD 与自动化回归在交付项目落地，上线缺陷率下降 <b>47%</b>，交付 SLA 达成率由 91% 升至 99.2%，恢复 8 分钟。" },
        { id: "work-bullet-16", html: "申请发明专利 3 项（推理调度、缓存复用、检索重排），均进入实质审查并在生产集群落地，吞吐提升 1.8 倍。" },
        { id: "work-bullet-18", html: "主讲 5 场客户技术工作坊，覆盖 200+ 业务与技术决策人，孵化 8 个 POC 并转化 3 个百万级订单，平均 6 周成单。" },
      ],
    },
    {
      id: "work-entry-2",
      columns: [
        text("智谱 AI"),
        text("解决方案架构师（FDE）"),
        text("2020.03—2022.06"),
      ],
      bullets: [
        { id: "work-bullet-5", html: "作为 Forward Deployed Engineer 负责 API 售前验证与现场交付，支撑 45+ 客户 POC，转化率 <b>71%</b>，回款 6800 万元。" },
        { id: "work-bullet-6", html: "构建多模态文档解析流水线（OCR + LayoutLM + RAG），字段抽取准确率 <b>97.2%</b>，人工复核成本降 72%。" },
        { id: "work-bullet-7", html: "主导私有化部署方案（Kubernetes + vLLM + 信创），落地 15 家客户，单集群 300+ QPS、P99 稳定在 720ms，续费 3 家。" },
        { id: "work-bullet-8", html: "牵头麒麟 / 昇腾信创环境适配，完成 4 个标杆客户上线，推理成本下降 38%，客户满意度由 4.3 升至 4.8，纳入交付包。" },
        { id: "work-bullet-13", html: "搭建模型效果评测集（2000 条样本 + 双人标注），把 POC 验收标准量化为 6 项可复现指标，争议率降 60%。" },
      ],
    },
    {
      id: "work-entry-3",
      columns: [
        text("商汤科技"),
        text("后端工程师"),
        text("2018.07—2020.02"),
      ],
      bullets: [
        { id: "work-bullet-9", html: "负责城市视觉中枢的数据接入与任务调度，日均处理 2.4 亿事件流、跨 7 地机房，服务可用性 <b>99.97%</b>，零重大事故。" },
        { id: "work-bullet-10", html: "重构批处理链路（Airflow + ClickHouse 分区优化），核心报表产出由 5 小时降至 18 分钟，资源成本降 45%。" },
        { id: "work-bullet-11", html: "主导数据质量治理，制定埋点与校验规范并接入 CI，脏数据率由 9% 降至 <b>0.5%</b>，下游投诉工单清零，年省 300 万。" },
      ],
    },
  ];

  content.sections[2].entries = [
    {
      id: "project-entry-1",
      columns: [
        text("开源：fde-starter-kit"),
        text("作者"),
        text("2025.03—至今"),
      ],
      bullets: [
        { id: "project-bullet-1", html: "开源 FDE 交付脚手架（鉴权、日志、评测、部署），GitHub <b>3.2k</b> Star，120+ 团队用于 POC 与生产交付，周下载 1.2k。" },
        { id: "project-bullet-2", html: "配套《FDE 交付手册》阅读 12 万+，被 5 家独角兽采纳为新人培训教材，登上 GitHub Trending 日榜，8 场大会引用。" },
      ],
    },
    {
      id: "project-entry-2",
      columns: [
        text("制造业设备预测性维护平台"),
        text("交付负责人（驻场 6 个月）"),
        text("2024.07—2025.01"),
      ],
      bullets: [
        { id: "project-bullet-3", html: "驻场梳理 6 条产线、800+ 传感器数据，构建时序特征管道与异常检测模型，非计划停机下降 <b>31%</b>，OEE 提升 6%。" },
        { id: "project-bullet-4", html: "端到端交付采集—特征—告警—工单闭环，培训客户 30 人自主运维，二期合同续签 1200 万元并列为集团标杆。" },
        { id: "project-bullet-5", html: "设计分级告警与值班 SOP，误报率控制在 4% 以内，客户 CSAT 4.9 / 5，方案复制到集团另外 3 个生产基地，续签 3 年。" },
      ],
    },
    {
      id: "project-entry-3",
      columns: [
        text("国有大行智能合规审查 Agent"),
        text("技术负责人"),
        text("2023.09—2024.05"),
      ],
      bullets: [
        { id: "project-bullet-6", html: "基于 LangGraph 构建多步审查 Agent，串联 8 类监管规则与 12 份制度文件，单份材料审核由 50 分钟降至 <b>2.5 分钟</b>。" },
        { id: "project-bullet-7", html: "Function Calling 对接行内风控与影像系统，审查结论可追溯、可审计，规则覆盖率 100%，误报率 <b>3.2%</b>，复核量降 80%。" },
        { id: "project-bullet-8", html: "单日处理 3.6 万份材料、峰值并发 500，平均响应 6 秒，一次性通过等保三级与行内红队渗透测试，支撑 6 个业务条线。" },
        { id: "project-bullet-9", html: "沉淀规则配置化能力，新监管规则接入由 3 天缩短至 <b>2 小时</b>，业务方自助上线，可版本回滚，年省研发投入 400 人天。" },
      ],
    },
  ];

  content.sections[3].columns = [
    text("清华大学"),
    text("计算机科学与技术"),
    text("2014—2018"),
  ];
  content.sections[3].bullets = [
    { id: "education-bullet-1", html: "ACM-ICPC 全球总决赛（World Finals）参赛选手，亚洲区域赛金牌（队内主代码手，赛区第 2 名），校队队长 2 年。" },
    { id: "education-bullet-2", html: "GPA 3.9 / 4.0（专业前 2%），国家奖学金 3 次，清华大学优秀毕业生；辅修统计学，校级优秀毕设，发表 EI 论文 2 篇。" },
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
