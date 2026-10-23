const PAPER_WIDTH = 793.7;
const PAPER_HEIGHT = 1122.5;
const SECTION_ORDER = ["skills", "work", "projects", "education"];
const SECTION_LABELS = {
  skills: "专业技能",
  work: "工作经历",
  projects: "项目经历",
  education: "教育背景",
};

const sampleContent = {
  identity: {
    name: "林亦舟",
    contacts: { phone: "138 0012 3056", email: "lin.yizhou@example.com", wechat: "linzhou.design" },
    links: { github: "github.com/example", personalWebsite: "portfolio.example.com" },
  },
  sections: [
    {
      type: "skills", title: "专业技能", bullets: [
        "产品梳理：将用户任务、业务约束和边界条件整理成清楚的流程。",
        "交互设计：覆盖默认、空数据、错误与恢复状态，明确每次操作的结果。",
        "协作交付：用原型、标注和短文档说明取舍，和产品、研发一起核对细节。",
        "信息架构：结合访谈纪要、使用记录和业务目标梳理问题，区分已验证结论与待确认内容。",
        "原型验证：围绕任务路径检查导航、表单和反馈状态，把发现的问题整理成可执行建议。",
      ],
    },
    {
      type: "work", title: "工作经历", entries: [
        { columns: ["远景科技", "产品设计师", "2023.04 — 至今"], bullets: [
          "负责内部运营工具的体验梳理，把高频任务、权限边界和异常处理放在同一条流程里。",
          "与研发共同维护组件与交互约定，减少相似页面之间的行为差异。",
          "围绕用户反馈持续调整信息层级，保留必要依据，降低重复确认。",
          "整理多角色入口和常用数据，调整导航层级并补充空状态、加载状态和失败后的恢复路径。",
          "维护设计说明与组件状态，和研发一起走查边界情况，记录已解决及仍需确认的问题。",
        ] },
      ],
    },
    {
      type: "projects", title: "项目经历", entries: [
        { columns: ["协作记录工具", "产品与交互", "2024.08 — 2025.02"], bullets: [
          "从团队讨论、资料归档和行动项回看三个场景整理核心路径。",
          "设计搜索、筛选与空状态，让用户能从记录直接回到当前任务。",
          "补充来源、时间和状态信息，便于团队在后续讨论中核对上下文。",
        ] },
        { columns: ["移动端服务流程", "体验设计", "2023.10 — 2024.05"], bullets: [
          "梳理预约、确认和改期过程中的信息依赖，统一表单字段与反馈方式。",
          "为异常输入和临时调整补充说明，减少流程中断后的重复填写。",
        ] },
      ],
    },
    {
      type: "education", title: "教育背景", entries: [
        { columns: ["2018 — 2022", "海岚大学 · 工业设计", "杭州"], bullets: ["课程涉及人机交互、服务设计与信息可视化，完成用户研究和交互原型相关项目。"] },
      ],
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = Date.now();
const directions = [
  { id: "d-current", name: "林亦舟 · 产品设计", updatedAt: now - 5 * 60_000, content: clone(sampleContent) },
  { id: "d-research", name: "林亦舟 · 用户研究", updatedAt: now - 24 * 60 * 60_000, content: clone(sampleContent) },
  { id: "d-systems", name: "林亦舟 · 设计系统", updatedAt: now - 4 * 24 * 60 * 60_000, content: clone(sampleContent) },
];
directions[1].content.sections[0].bullets[0] = "研究方法：把访谈问题、观察记录与待验证假设分开整理。";
directions[2].content.sections[0].bullets[0] = "组件治理：整理组件用途、交互状态与内容边界，方便团队共同维护。";

let activeId = directions[0].id;
let currentView = "editor";
let customZoom = null;
let pendingRenameId = null;
let pendingDeleteId = null;
let toastTimer = 0;
let draggedItem = null;

const byId = (id) => document.getElementById(id);
const elements = {
  shell: byId("app-shell"), topbar: byId("editor-topbar"), editor: byId("editor-view"),
  directionsView: byId("directions-view"), paperScroller: byId("paper-scroller"),
  paperSpace: byId("paper-space"), paper: byId("resume-paper"), paperContent: byId("paper-content"),
  safeZone: byId("safe-zone"), renameCurrent: byId("rename-current"), openDirections: byId("open-directions"),
  zoomOut: byId("zoom-out"), zoomIn: byId("zoom-in"), zoomReadout: byId("zoom-readout"),
  zoomInput: byId("zoom-input"), toggleGuide: byId("toggle-guide"), exportPdf: byId("export-pdf"),
  backEditor: byId("back-editor"), search: byId("direction-search"), count: byId("direction-count"),
  grid: byId("direction-grid"), emptyState: byId("empty-state"), clearSearch: byId("clear-search"),
  createDirection: byId("create-direction"), importDirection: byId("import-direction"),
  importFile: byId("import-file"), importStatus: byId("import-status"), toast: byId("toast"),
  directionDialog: byId("direction-dialog"), directionForm: byId("direction-form"),
  directionName: byId("direction-name"), directionTemplate: byId("direction-template"),
  renameDialog: byId("rename-dialog"), renameForm: byId("rename-form"), renameName: byId("rename-name"),
  deleteDialog: byId("delete-dialog"), deleteForm: byId("delete-form"), deleteCopy: byId("delete-copy"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function textFromField(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (typeof value.html === "string") {
    const doc = new DOMParser().parseFromString(value.html, "text/html");
    return (doc.body.textContent || "").trim();
  }
  if (typeof value.text === "string") return value.text;
  return "";
}

function svgIcon(name) {
  const paths = {
    phone: '<path d="M5 3.5h2l1.2 3-1.5 1.4a11 11 0 0 0 5.4 5.4l1.4-1.5 3 1.2v2c0 .6-.4 1-1 1C9 16 4 11 4 4.5c0-.6.4-1 1-1Z"/>',
    mail: '<rect x="2.5" y="4" width="15" height="12" rx="1"/><path d="m3 5 7 5.5L17 5"/>',
    chat: '<path d="M4 5.5c0-2 2.2-3.5 5-3.5s5 1.5 5 3.5S11.8 9 9 9c-.6 0-1.1-.1-1.6-.2L4 10l.8-2.2A3.5 3.5 0 0 1 4 5.5Z"/><path d="M9.5 12c.4 1.8 2.3 3 4.5 3 .6 0 1.1-.1 1.6-.2L18 16l-.6-1.9c.4-.5.6-1.1.6-1.8 0-2-2-3.5-4.5-3.5-.6 0-1.2.1-1.7.3"/>',
    link: '<path d="M8 11.5 12 7.5"/><path d="M7.2 13.8H5a3 3 0 0 1 0-6h3M12.8 5.2H15a3 3 0 0 1 0 6h-3"/>',
    github: '<path d="M10 2.2a7.8 7.8 0 0 0-2.5 15.2c.4.1.5-.2.5-.4v-1.4c-2 .4-2.5-.8-2.5-.8-.3-.7-.8-.9-.8-.9-.6-.4.1-.4.1-.4.7 0 1.1.7 1.1.7.6 1.1 1.6.8 2 .6.1-.4.3-.8.5-1-1.6-.2-3.3-.8-3.3-3.6 0-.8.3-1.4.7-1.9-.1-.2-.3-.9.1-1.9 0 0 .6-.2 2 .7a7 7 0 0 1 3.7 0c1.4-.9 2-.7 2-.7.4 1 .2 1.7.1 1.9.5.5.7 1.1.7 1.9 0 2.8-1.7 3.4-3.3 3.6.3.2.5.7.5 1.3V17c0 .2.1.5.5.4A7.8 7.8 0 0 0 10 2.2Z"/>',
    pencil: '<path d="m4 13.8-.7 3 3-.7L16 7.4a2.1 2.1 0 0 0-3-3L4 13.8Z"/><path d="m11.8 5.6 2.9 2.9"/>',
    trash: '<path d="M3.5 5.5h13M7 5.5v-2h6v2m-7.5 0 .7 11h6.6l.7-11M8.5 8.5v5m3-5v5"/>',
    grip: '<path d="M9 3.5a5.5 5.5 0 0 0-5.5 5.5v3a6.5 6.5 0 0 0 13 0V9A5.5 5.5 0 0 0 11 3.5"/><path d="M10 4v5m-5.8 1.5h11.6M10 6v1"/>',
  };
  const fill = name === "github" ? ' fill="currentColor" stroke="none"' : "";
  return `<svg viewBox="0 0 20 20"${fill} aria-hidden="true">${paths[name] || ""}</svg>`;
}

function makeContactPart(icon, value, field, editable = true) {
  if (!value) return "";
  return `<span class="contact-part">${svgIcon(icon)}<span class="run-${field === "email" || field === "wechat" || field === "github" || field === "personalWebsite" ? "en" : "num"}" data-field="${field}" ${editableAttr(editable, field)}>${escapeHtml(value)}</span></span>`;
}

function editableAttr(editable = true, label = "") {
  return editable ? `contenteditable="true" spellcheck="false"${label ? ` aria-label="${escapeHtml(label)}"` : ""}` : 'contenteditable="false"';
}

function makeContactRow(values, fields, icons, editable) {
  const parts = values.map((value, index) => makeContactPart(icons[index], value, fields[index], editable)).filter(Boolean);
  return parts.map((part, index) => `${index ? '<span class="contact-separator" aria-hidden="true">｜</span>' : ""}${part}`).join("");
}

function sortGrip(label = "拖动排序") {
  return `<button class="sort-grip" type="button" draggable="true" aria-label="${label}" title="从这里拖动排序">${svgIcon("grip")}</button>`;
}

function renderBulletList(bullets = [], editable = true, label = "简历要点") {
  if (!bullets.length) return "";
  return `<ul class="bullet-list" aria-label="${label}" data-sort-list="bullet">${bullets.map((bullet) => `<li class="bullet-row sortable" data-sortable="bullet">${sortGrip()}<span data-field="bullet" ${editableAttr(editable, label)}>${escapeHtml(bullet)}</span></li>`).join("")}</ul>`;
}

function renderEntry(entry, sectionType, editable = true) {
  const columns = (entry.columns || ["", "", ""]).slice(0, 3);
  while (columns.length < 3) columns.push("");
  const education = sectionType === "education";
  const heading = `<div class="entry-head${education ? " education-head" : ""}">${!education ? sortGrip("拖动整段经历排序") : ""}${columns.map((value, index) => `<span class="entry-field" data-field="column" data-column="${index}" ${editableAttr(editable, `第${index + 1}栏`)}>${escapeHtml(value)}</span>`).join("")}</div>`;
  return `<article class="experience${education ? " education-entry" : " sortable"}" ${!education ? 'data-sortable="entry"' : ""}>${heading}${renderBulletList(entry.bullets || [], editable, "经历要点")}</article>`;
}

function renderSection(section, editable = true) {
  const type = SECTION_ORDER.includes(section.type) ? section.type : "skills";
  const heading = `<div class="section-heading"><span class="section-title-edit" data-field="section-title" ${editableAttr(editable, "分区名称")}>${escapeHtml(section.title || SECTION_LABELS[type])}</span></div>`;
  let body = "";
  if (type === "skills") body = renderBulletList(section.bullets || [], editable, "专业技能要点");
  else body = (section.entries || []).map((entry) => renderEntry(entry, type, editable)).join("");
  return `<section class="resume-section" data-section-type="${type}">${heading}<div class="section-body">${body}</div></section>`;
}

function renderPaperMarkup(content, editable = true) {
  const identity = content.identity || {};
  const contacts = identity.contacts || {};
  const links = identity.links || {};
  const github = typeof links.github === "string" ? links.github : links.github?.href || links.github?.label || "";
  const website = typeof links.personalWebsite === "string" ? links.personalWebsite : links.personalWebsite?.href || links.personalWebsite?.label || "";
  const firstRow = makeContactRow([contacts.phone, contacts.email, contacts.wechat], ["phone", "email", "wechat"], ["phone", "mail", "chat"], editable);
  const secondParts = [];
  if (github) secondParts.push(`<span class="contact-part">${svgIcon("github")}<span class="run-en" data-field="github" ${editableAttr(editable, "GitHub 地址")}>${escapeHtml(github)}</span></span>`);
  if (website) secondParts.push(`<span class="contact-part">${svgIcon("link")}<span class="run-en" data-field="personalWebsite" ${editableAttr(editable, "个人网页")}>${escapeHtml(website)}</span></span>`);
  const secondRow = secondParts.map((part, index) => `${index ? '<span class="contact-separator" aria-hidden="true">｜</span>' : ""}${part}`).join("");
  const addMenu = editable && (!github || !website) ? `<div class="contact-add-menu" aria-label="添加可选联系方式">${!github ? '<button type="button" data-add-contact="github">＋ GitHub</button>' : ""}${!website ? '<button type="button" data-add-contact="personalWebsite">＋ 个人网页</button>' : ""}</div>` : "";
  const ordered = SECTION_ORDER.map((type) => content.sections?.find((section) => section.type === type)).filter(Boolean);
  const sections = ordered.map((section) => renderSection(section, editable)).join("");
  return `<div class="identity"><h1 class="name" data-field="name" ${editableAttr(editable, "姓名")}>${escapeHtml(identity.name || "未命名")}</h1><div class="contact-row">${firstRow}</div>${secondRow ? `<div class="contact-row">${secondRow}</div>` : ""}${addMenu}</div>${sections}`;
}

function activeDirection() { return directions.find((direction) => direction.id === activeId) || directions[0]; }

function capturePaper() {
  const content = { identity: { name: "", contacts: {}, links: {} }, sections: [] };
  content.identity.name = elements.paperContent.querySelector('[data-field="name"]')?.innerText.trim() || "";
  for (const field of ["phone", "email", "wechat"]) content.identity.contacts[field] = elements.paperContent.querySelector(`[data-field="${field}"]`)?.innerText.trim() || "";
  content.identity.links.github = elements.paperContent.querySelector('[data-field="github"]')?.innerText.trim() || "";
  content.identity.links.personalWebsite = elements.paperContent.querySelector('[data-field="personalWebsite"]')?.innerText.trim() || "";
  elements.paperContent.querySelectorAll(".resume-section").forEach((sectionElement) => {
    const type = sectionElement.dataset.sectionType;
    const section = { type, title: sectionElement.querySelector('[data-field="section-title"]')?.innerText.trim() || SECTION_LABELS[type] };
    if (type === "skills") section.bullets = [...sectionElement.querySelectorAll('[data-field="bullet"]')].map((element) => element.innerText.trim());
    else section.entries = [...sectionElement.querySelectorAll(".experience")].map((entry) => ({
      columns: [...entry.querySelectorAll('[data-field="column"]')].map((element) => element.innerText.trim()),
      bullets: [...entry.querySelectorAll('[data-field="bullet"]')].map((element) => element.innerText.trim()),
    }));
    content.sections.push(section);
  });
  return content;
}

function renderCurrentPaper() {
  elements.paperContent.innerHTML = renderPaperMarkup(activeDirection().content, true);
  elements.renameCurrent.textContent = activeDirection().name;
  updateZoom();
  checkOverflow();
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const current = new Date();
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "刚刚编辑";
  if (minutes < 60) return `${minutes} 分钟前`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const today = date.toDateString() === current.toDateString();
  const yesterday = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1).toDateString() === date.toDateString();
  if (today) return `今天 ${time}`;
  if (yesterday) return `昨天 ${time}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function resizeThumbs() {
  elements.grid.querySelectorAll(".thumb-frame").forEach((frame) => {
    const paper = frame.querySelector(".thumb-paper");
    if (!paper) return;
    paper.style.setProperty("--thumb-scale", String(frame.clientWidth / PAPER_WIDTH));
  });
}

function renderDirections() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const ordered = [...directions].sort((left, right) => right.updatedAt - left.updatedAt);
  const filtered = ordered.filter((direction) => !query || direction.name.toLocaleLowerCase().includes(query));
  elements.grid.replaceChildren();
  for (const direction of filtered) {
    const card = document.createElement("article");
    card.className = `direction-card${direction.id === activeId ? " is-active" : ""}`;
    card.dataset.directionId = direction.id;
    const title = escapeHtml(direction.name);
    const mini = renderPaperMarkup(direction.content, false);
    card.innerHTML = `<div class="card-head"><div class="card-title-group"><div class="card-title-line"><button class="card-title" type="button" data-action="open" aria-label="打开${title}">${title}</button>${direction.id === activeId ? '<span class="active-tag">当前</span>' : ""}</div><div class="card-time">最近编辑 · ${formatTime(direction.updatedAt)}</div></div><div class="card-actions"><button type="button" data-action="rename" aria-label="修改${title}名称" title="修改名称">${svgIcon("pencil")}</button><button type="button" data-action="delete" aria-label="删除${title}" title="删除方向" ${directions.length === 1 ? "disabled" : ""}>${svgIcon("trash")}</button></div></div><div class="thumb-frame" data-action="open" role="button" tabindex="0" aria-label="打开${title}"><div class="thumb-paper"><div class="paper-content">${mini}</div></div></div>`;
    elements.grid.append(card);
  }
  elements.count.textContent = `简历方向室 · ${filtered.length} 个方向`;
  elements.emptyState.hidden = filtered.length > 0;
  elements.grid.hidden = filtered.length === 0;
  requestAnimationFrame(resizeThumbs);
}

function setView(view) {
  currentView = view;
  const isEditor = view === "editor";
  elements.topbar.hidden = !isEditor;
  elements.editor.hidden = !isEditor;
  elements.directionsView.hidden = isEditor;
  if (isEditor) {
    renderCurrentPaper();
    requestAnimationFrame(() => elements.renameCurrent.focus({ preventScroll: true }));
  } else {
    activeDirection().content = capturePaper();
    renderDirections();
    requestAnimationFrame(() => elements.search.focus({ preventScroll: true }));
  }
}

function openDirection(id) {
  const target = directions.find((direction) => direction.id === id);
  if (!target) return;
  activeDirection().content = capturePaper();
  activeDirection().updatedAt = Date.now();
  activeId = id;
  elements.search.value = "";
  setView("editor");
}

function fitScale() {
  const width = Math.max(120, elements.paperScroller.clientWidth - 34);
  const height = Math.max(180, elements.paperScroller.clientHeight - 34);
  return Math.min(width / PAPER_WIDTH, height / PAPER_HEIGHT, 1);
}

function updateZoom() {
  if (!elements.paperScroller || !elements.paperSpace) return;
  const scale = customZoom === null ? fitScale() : Math.min(Math.max(customZoom / 100, .35), 1.6);
  elements.paperSpace.style.width = `${PAPER_WIDTH * scale + 28}px`;
  elements.paperSpace.style.height = `${PAPER_HEIGHT * scale + 28}px`;
  elements.paper.style.setProperty("--paper-scale", String(scale));
  elements.paper.style.left = "14px";
  elements.paper.style.top = "14px";
  elements.zoomReadout.textContent = `${Math.round(scale * 100)}%`;
  elements.zoomOut.disabled = customZoom !== null && customZoom <= 35;
  elements.zoomIn.disabled = customZoom !== null && customZoom >= 160;
}

function checkOverflow() {
  requestAnimationFrame(() => {
    const contentBottom = elements.paperContent.getBoundingClientRect().bottom;
    const lastBlock = elements.paperContent.lastElementChild;
    const visualBottom = lastBlock?.getBoundingClientRect().bottom ?? contentBottom;
    const over = elements.paperContent.scrollHeight > elements.paperContent.clientHeight + 2 || visualBottom > contentBottom + 2;
    elements.paper.classList.toggle("is-overflow", over);
    elements.exportPdf.disabled = over;
  });
}

function showToast(message, kind = "default") {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.kind = kind;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2600);
}

function openDialog(dialog, input) {
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => input?.focus({ preventScroll: true }));
}

function closeOpenDialog() {
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
}

function openCreateDialog() {
  activeDirection().content = capturePaper();
  elements.directionName.value = "";
  elements.directionTemplate.replaceChildren(...directions.map((direction) => {
    const option = document.createElement("option");
    option.value = direction.id;
    option.textContent = direction.name;
    return option;
  }));
  elements.directionTemplate.value = activeId;
  openDialog(elements.directionDialog, elements.directionName);
}

function createDirection(event) {
  event.preventDefault();
  const name = elements.directionName.value.trim();
  const template = directions.find((direction) => direction.id === elements.directionTemplate.value);
  if (!name || !template) return;
  const direction = { id: `d-${Date.now()}`, name, updatedAt: Date.now(), content: clone(template.content) };
  directions.push(direction);
  elements.directionDialog.close();
  activeId = direction.id;
  elements.search.value = "";
  setView("editor");
  showToast(`已创建「${name}」`);
}

function openRenameDialog(id) {
  const target = directions.find((direction) => direction.id === id);
  if (!target) return;
  pendingRenameId = id;
  elements.renameName.value = target.name;
  openDialog(elements.renameDialog, elements.renameName);
  elements.renameName.select();
}

function renameDirection(event) {
  event.preventDefault();
  const target = directions.find((direction) => direction.id === pendingRenameId);
  const name = elements.renameName.value.trim();
  if (!target || !name) return;
  target.name = name;
  elements.renameDialog.close();
  if (target.id === activeId) elements.renameCurrent.textContent = name;
  if (currentView === "directions") renderDirections();
  showToast("方向名称已更新");
}

function openDeleteDialog(id) {
  const target = directions.find((direction) => direction.id === id);
  if (!target || directions.length === 1) return;
  pendingDeleteId = id;
  elements.deleteCopy.textContent = `「${target.name}」删除后无法恢复，其中的内容也会一并删除。`;
  openDialog(elements.deleteDialog, elements.deleteDialog.querySelector("[data-close-dialog]"));
}

function deleteDirection(event) {
  event.preventDefault();
  if (directions.length <= 1) return;
  const index = directions.findIndex((direction) => direction.id === pendingDeleteId);
  if (index < 0) return;
  const [removed] = directions.splice(index, 1);
  const wasActive = activeId === removed.id;
  elements.deleteDialog.close();
  if (wasActive) activeId = directions[0].id;
  if (currentView === "directions") renderDirections();
  if (wasActive) renderCurrentPaper();
  showToast(`已删除「${removed.name}」`);
}

function normalizeImported(raw, fileName) {
  const wrapped = raw && typeof raw === "object" && !Array.isArray(raw) && raw.content && typeof raw.content === "object";
  const source = wrapped ? raw.content : raw;
  if (!source || typeof source !== "object" || !source.identity || !Array.isArray(source.sections)) {
    throw new Error("缺少 identity 或 sections 字段");
  }
  const byType = new Map(source.sections.map((section) => [section.type, section]));
  if (!SECTION_ORDER.every((type) => byType.has(type))) throw new Error("需要包含四个固定板块");
  const identity = source.identity;
  const contacts = identity.contacts || {};
  const links = identity.links || {};
  const getLink = (name) => {
    const link = links[name];
    return typeof link === "string" ? link : textFromField(link?.href || link?.label);
  };
  const content = {
    identity: {
      name: textFromField(identity.name),
      contacts: Object.fromEntries(["phone", "email", "wechat"].map((field) => [field, textFromField(contacts[field])])),
      links: { github: getLink("github"), personalWebsite: getLink("personalWebsite") },
    },
    sections: SECTION_ORDER.map((type) => {
      const section = byType.get(type);
      const output = { type, title: textFromField(section.title) || SECTION_LABELS[type] };
      if (type === "skills") output.bullets = (section.bullets || []).map((item) => textFromField(item.html ?? item));
      else if (type === "education" && Array.isArray(section.columns)) {
        output.entries = [{ columns: section.columns.map(textFromField), bullets: (section.bullets || []).map((item) => textFromField(item.html ?? item)) }];
      } else output.entries = (section.entries || []).map((entry) => ({
        columns: (entry.columns || []).map(textFromField),
        bullets: (entry.bullets || []).map((item) => textFromField(item.html ?? item)),
      }));
      return output;
    }),
  };
  const name = textFromField(wrapped ? raw.name : "") || content.identity.name || fileName.replace(/\.json$/i, "") || "导入的方向";
  return { name, content };
}

async function importFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = normalizeImported(parsed, file.name);
    const direction = { id: `d-${Date.now()}`, name: imported.name, updatedAt: Date.now(), content: imported.content };
    directions.push(direction);
    activeId = direction.id;
    elements.importStatus.hidden = false;
    elements.importStatus.textContent = `上次导入 · ${file.name}`;
    elements.importFile.value = "";
    setView("editor");
    showToast(`已导入「${direction.name}」`, "success");
  } catch (error) {
    showToast(`导入失败：${error.message}，未添加方向。`, "error");
    elements.importFile.value = "";
  }
}

function addContact(kind) {
  const direction = activeDirection();
  direction.content = capturePaper();
  if (kind === "github") direction.content.identity.links.github = "github.com/example";
  if (kind === "personalWebsite") direction.content.identity.links.personalWebsite = "portfolio.example.com";
  renderCurrentPaper();
  showToast(kind === "github" ? "已添加 GitHub" : "已添加个人网页");
}

function moveZoom(delta) {
  const current = customZoom === null ? Math.round(fitScale() * 100) : customZoom;
  customZoom = Math.min(160, Math.max(35, Math.round((current + delta) / 2) * 2));
  updateZoom();
}

function openZoomEditor() {
  elements.zoomInput.value = customZoom === null ? "" : String(customZoom);
  elements.zoomReadout.hidden = true;
  elements.zoomInput.hidden = false;
  elements.zoomInput.focus();
  elements.zoomInput.select();
}

function commitZoom() {
  const raw = elements.zoomInput.value.trim();
  if (!raw) customZoom = null;
  else {
    const value = Number.parseFloat(raw.replace(/%$/, ""));
    if (!Number.isFinite(value)) { showToast("请输入 35–160 之间的缩放比例", "error"); return; }
    customZoom = Math.min(160, Math.max(35, value));
  }
  elements.zoomInput.hidden = true;
  elements.zoomReadout.hidden = false;
  updateZoom();
}

function initializeOverflowState() {
  const params = new URLSearchParams(location.search);
  if (params.get("state") !== "overflow") return;
  const section = activeDirection().content.sections.find((item) => item.type === "work");
  const entry = section?.entries?.[0];
  if (!entry) return;
  entry.bullets.push(
    "补充项目说明：围绕使用场景核对资料、流程和责任边界，整理异常情况并持续完善交付记录。",
    "补充工作说明：把复杂的问题拆分成可执行步骤，和协作成员确认输入、输出与后续处理方式。",
    "补充项目说明：围绕不同角色整理信息层级，补充检索、回看与状态变化时所需的说明。",
    "补充工作说明：持续维护共享规范与交付文档，记录讨论结论并同步到相关页面。",
    "补充项目说明：根据反馈调整内容顺序与操作入口，确保每一项状态都能被看见和理解。",
    "补充工作说明：和团队一起复核常见流程及边界情况，让内容变化能被准确追踪。",
    "补充项目说明：围绕实际任务检查页面、文字与交互，逐步减少理解成本和重复确认。",
    "补充工作说明：对照不同角色的实际工作方式，检查信息顺序、字段含义和完成后的反馈是否一致。",
    "补充项目说明：整理状态变化、资料来源和操作权限，明确哪些内容需要进一步核对。",
    "补充工作说明：在需求变化时同步更新原型与说明，和团队一起确认影响范围及后续安排。",
    "补充项目说明：围绕搜索与回看任务调整页面结构，让重要信息能在合适的位置被找到。",
    "补充工作说明：参与页面走查和问题记录，依据实际结果补全边界情况与错误恢复方式。",
    "补充项目说明：统一常用信息的表达方式，减少同一内容在不同流程中的理解差异。",
    "补充工作说明：持续维护交付记录和待确认项，确保修改依据能够被协作者复查。",
    "补充项目说明：梳理资料创建、编辑和归档时的关键操作，明确每一步的当前状态。",
    "补充工作说明：根据团队反馈整理重复步骤，调整任务入口与必要提示，保留重要判断依据。",
    "补充项目说明：检查文字、表单和空状态之间的衔接，减少页面变化带来的操作中断。",
    "补充工作说明：协同产品与研发核对更新内容，跟进设计说明、验收记录和后续迭代。",
    "补充项目说明：整理长期维护所需的组件约定和页面说明，方便团队持续复用与更新。",
    "补充工作说明：回看问题从提出到处理的过程，补充必要上下文并记录尚未解决的事项。",
  );
}

function bindEvents() {
  elements.openDirections.addEventListener("click", () => setView(currentView === "directions" ? "editor" : "directions"));
  elements.backEditor.addEventListener("click", () => setView("editor"));
  elements.renameCurrent.addEventListener("click", () => openRenameDialog(activeId));
  elements.createDirection.addEventListener("click", openCreateDialog);
  elements.directionForm.addEventListener("submit", createDirection);
  elements.renameForm.addEventListener("submit", renameDirection);
  elements.deleteForm.addEventListener("submit", deleteDirection);
  elements.search.addEventListener("input", renderDirections);
  elements.clearSearch.addEventListener("click", () => { elements.search.value = ""; renderDirections(); elements.search.focus(); });
  elements.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest("[data-direction-id]");
    if (!card) return;
    const action = button.dataset.action;
    if (action === "rename") openRenameDialog(card.dataset.directionId);
    else if (action === "delete") openDeleteDialog(card.dataset.directionId);
    else openDirection(card.dataset.directionId);
  });
  elements.grid.addEventListener("keydown", (event) => {
    const frame = event.target.closest('.thumb-frame[role="button"]');
    if (frame && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openDirection(frame.closest("[data-direction-id]").dataset.directionId); }
  });
  elements.importDirection.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", () => importFile(elements.importFile.files?.[0]));
  elements.exportPdf.addEventListener("click", () => {
    checkOverflow();
    if (elements.paper.classList.contains("is-overflow")) { showToast("内容超过一页，请删减后再打印。", "error"); return; }
    window.print();
  });
  elements.toggleGuide.addEventListener("click", () => {
    const visible = elements.toggleGuide.getAttribute("aria-pressed") === "true";
    elements.toggleGuide.setAttribute("aria-pressed", String(!visible));
    elements.safeZone.classList.toggle("is-hidden", visible);
  });
  elements.zoomOut.addEventListener("click", () => moveZoom(-2));
  elements.zoomIn.addEventListener("click", () => moveZoom(2));
  elements.zoomReadout.addEventListener("click", openZoomEditor);
  elements.zoomInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); commitZoom(); }
    if (event.key === "Escape") { elements.zoomInput.hidden = true; elements.zoomReadout.hidden = false; }
  });
  elements.zoomInput.addEventListener("blur", commitZoom);
  elements.paperContent.addEventListener("input", (event) => {
    if (!event.target.closest("[contenteditable='true']")) return;
    activeDirection().content = capturePaper();
    activeDirection().updatedAt = Date.now();
    checkOverflow();
  });
  elements.paperContent.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-contact]");
    if (add) addContact(add.dataset.addContact);
  });
  elements.paperContent.addEventListener("dragstart", (event) => {
    const grip = event.target.closest(".sort-grip");
    if (!grip) { event.preventDefault(); return; }
    draggedItem = grip.closest("[data-sortable]");
    if (!draggedItem) return;
    draggedItem.classList.add("drag-source");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "resume-item");
  });
  elements.paperContent.addEventListener("dragover", (event) => {
    const target = event.target.closest("[data-sortable]");
    if (!draggedItem || !target || target === draggedItem || target.parentElement !== draggedItem.parentElement) return;
    event.preventDefault();
    target.classList.add("drag-over");
    const bounds = target.getBoundingClientRect();
    const after = event.clientY > bounds.top + bounds.height / 2;
    target.parentElement.insertBefore(draggedItem, after ? target.nextElementSibling : target);
  });
  elements.paperContent.addEventListener("drop", (event) => { if (draggedItem) event.preventDefault(); });
  elements.paperContent.addEventListener("dragend", () => {
    elements.paperContent.querySelectorAll(".drag-source,.drag-over").forEach((item) => item.classList.remove("drag-source", "drag-over"));
    if (draggedItem) { activeDirection().content = capturePaper(); activeDirection().updatedAt = Date.now(); }
    draggedItem = null;
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeOpenDialog));
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f" && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      if (currentView === "directions") setView("editor"); else setView("directions");
    }
    if (event.key === "Escape" && currentView === "directions" && !document.querySelector("dialog[open]")) setView("editor");
  });
  const observer = new ResizeObserver(() => { updateZoom(); resizeThumbs(); });
  observer.observe(elements.paperScroller);
  observer.observe(elements.shell);
}

initializeOverflowState();
renderCurrentPaper();
bindEvents();
const query = new URLSearchParams(location.search);
if (query.get("screen") === "directions") setView("directions");
if (query.get("dialog") === "create") openCreateDialog();
if (query.get("dialog") === "delete") openDeleteDialog(directions[2].id);
