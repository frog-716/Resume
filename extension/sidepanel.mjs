import { fitResumeLayout } from './domain-auto-layout.mjs';
import { createEmptyResumeContent, validateResumeContent, normalizeLinkHref, repairResumeContent } from './domain-resume-content.mjs';
import { runsHtml, applyRunsToElement, normalizeFieldRuns } from './text-runs.mjs';
import { supportsFileSystemAccess, pickImportFile, saveImportHandle, loadImportSource, readTextFromHandle } from './import-source.mjs';

const PAPER_WIDTH_PX = 793.7;
const PAPER_HEIGHT_PX = 1122.5;
const STORE_KEY = 'resume-sidepanel-store-v1';
const DEFAULT_LAYOUT = Object.freeze({ marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } });
const SECTION_LABELS = { skills: '专业技能', work: '工作经历', projects: '项目经历', education: '教育背景' };
const COLUMN_PLACEHOLDERS = ['单位 / 项目', '岗位 / 职责', '日期'];

const byId = (id) => document.getElementById(id);
const elements = {
  title: byId('resume-title'), editor: byId('editor-view'),
  paperScroller: byId('paper-scroller'), paperSpace: byId('paper-space'), paper: byId('resume-paper'),
  paperContent: byId('paper-content'), directionView: byId('direction-view'), directionSearch: byId('direction-search'),
  directionGrid: byId('direction-grid'), directionDialog: byId('direction-dialog'), directionForm: byId('direction-form'),
  directionName: byId('direction-name'), directionTemplate: byId('direction-template'), renameDialog: byId('rename-dialog'),
  renameForm: byId('rename-form'), renameName: byId('rename-name'), confirmDialog: byId('confirm-dialog'),
  confirmForm: byId('confirm-form'), confirmTitle: byId('confirm-title'), confirmMessage: byId('confirm-message'),
  confirmAction: byId('confirm-action'), toast: byId('toast'), export: byId('export-pdf'), sortHandle: byId('sort-handle'),
  importButton: byId('import-direction'), importFile: byId('import-file'), importStatus: byId('import-status'),
};

const ICONS = {
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z',
  email: 'M3 5.5h18v13H3z M3.5 6.2 12 12.5l8.5-6.3',
  wechat: 'M8.5 6.2c-3.1 0-5.7 2-5.7 4.6 0 1.5.8 2.8 2.2 3.7l-.6 2 2.3-1.2c.6.2 1.2.3 1.8.3h.5c-.1-.4-.2-.8-.2-1.2 0-2.7 2.7-4.9 6-4.9h.5c-.2-1.9-2.3-3.3-4.8-3.3H8.5Zm6.6 4.7c-2.5 0-4.6 1.5-4.6 3.4s2.1 3.4 4.6 3.4c.5 0 1-.1 1.5-.2l1.8.9-.5-1.5c1.1-.6 1.8-1.5 1.8-2.6 0-1.9-2.1-3.4-4.6-3.4Z',
  website: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
  github: '<svg class="github-cat" role="img" aria-label="GitHub白猫" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9 7V4.8h6V7m-8.4 0 1 13h8.8l-1-13M10 10.2v6.8m4-6.8v6.8"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M5 19l3-1 9.2-9.2a1.8 1.8 0 0 0-2.5-2.5L5.6 15.4 5 19Z"/><path d="M14.5 6.5l3 3"/></svg>',
};

let storeState = null;
let activeDirection = null;
let draft = null;
let layout = null;
let currentView = 'editor';
let viewMode = 'fit';
let zoomFactor = 1;
let showGuide = true;
let currentPaperScale = 1;
let currentOverflowPx = 0;
let exportBlockedReason = '';
let fitFrame = 0;
let saveTimer = null;
let saveInFlight = null;
let draftRevision = 0;
let savedRevision = 0;
let undoStack = [];
let undoLastAt = 0;
let undoInProgress = false;
let composing = false;
let dragState = null;
let sortHover = null;
let pendingRenameId = null;
let toastTimer = null;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uid(prefix = 'item') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}
function nowIso() { return new Date().toISOString(); }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function showToast(message, kind = '', retry) {
  clearTimeout(toastTimer);
  elements.toast.replaceChildren();
  elements.toast.dataset.kind = kind;
  const text = document.createElement('span');
  text.textContent = message;
  elements.toast.append(text);
  if (typeof retry === 'function') {
    const button = document.createElement('button');
    button.className = 'toast-retry';
    button.type = 'button';
    button.textContent = '重试';
    button.addEventListener('click', () => { elements.toast.classList.add('hidden'); retry(); });
    elements.toast.append(button);
  }
  elements.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), retry ? 10000 : 3800);
}
function fmtMinute(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
function makeDirection(name, content = createEmptyResumeContent(), currentLayout = DEFAULT_LAYOUT) {
  const createdAt = nowIso();
  return {
    id: uid('direction'),
    name: String(name || '我的简历').trim() || '我的简历',
    createdAt,
    currentDraft: { content: clone(content), layout: clone(currentLayout), updatedAt: createdAt },
  };
}
function initialState() {
  const direction = makeDirection('我的简历');
  return { schemaVersion: 1, lastOpenedDirectionId: direction.id, directions: [direction], lastImport: null };
}
function extensionStorageGet(key) {
  if (globalThis.chrome?.storage?.local) return new Promise((resolve, reject) => chrome.storage.local.get(key, (value) => chrome.runtime?.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(value[key])));
  // 本地存储里的内容可能是被外部改坏的 JSON。解析失败时返回 undefined
  // （当作"没有存档"），而不是让异常冒泡把整个扩展打开流程打断。
  try {
    const raw = localStorage.getItem(key);
    return Promise.resolve(raw ? JSON.parse(raw) : undefined);
  } catch { return Promise.resolve(undefined); }
}
function extensionStorageSet(key, value) {
  if (globalThis.chrome?.storage?.local) return new Promise((resolve, reject) => chrome.storage.local.set({ [key]: value }, () => chrome.runtime?.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));
  localStorage.setItem(key, JSON.stringify(value));
  return Promise.resolve();
}
async function loadStore() {
  const saved = await extensionStorageGet(STORE_KEY);
  if (!saved || saved.schemaVersion !== 1 || !Array.isArray(saved.directions)) {
    storeState = initialState();
    return;
  }
  // 结构完整的方向一律保留。校验/修复只用于"内容有问题"的提示，绝不用于丢弃：
  // 一旦把方向从内存里过滤掉，后续 persistStore 会用内存态覆盖磁盘，
  // 用户的数据就被静默销毁了（空模板覆盖原方向）。
  // 因此即使方向缺 id / name / currentDraft，也只做"补齐"而不整条丢弃。
  const directions = [];
  const issues = [];
  for (const raw of saved.directions) {
    if (!raw || typeof raw !== 'object') { issues.push('有一条方向数据无法读取，已跳过。'); continue; }
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : uid('direction');
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '未命名简历';
    const currentDraft = raw.currentDraft && typeof raw.currentDraft === 'object' ? raw.currentDraft : {};
    const repaired = repairResumeContent(currentDraft.content);
    if (repaired.repaired) issues.push(`${name}：${repaired.issues[0]}`);
    directions.push({
      ...raw,
      id,
      name,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
      currentDraft: {
        ...currentDraft,
        content: repaired.content,
        layout: currentDraft.layout && typeof currentDraft.layout === 'object' ? currentDraft.layout : clone(DEFAULT_LAYOUT),
        updatedAt: typeof currentDraft.updatedAt === 'string' ? currentDraft.updatedAt : nowIso(),
      },
    });
  }
  // lastImport 只是"上次导入来源"的展示与再导入元数据，随 store 原样保留（旧版本无此字段时为 null）。
  storeState = directions.length
    ? { schemaVersion: 1, lastOpenedDirectionId: saved.lastOpenedDirectionId, directions, lastImport: saved.lastImport || null }
    : initialState();
  if (!storeState.directions.some((item) => item.id === storeState.lastOpenedDirectionId)) storeState.lastOpenedDirectionId = storeState.directions[0].id;
  if (issues.length) showToast(`${issues.length} 个方向的内容已自动修复：${issues.slice(0, 2).join('；')}`, 'error');
  // 修复后的内容要落盘，否则磁盘上仍是坏数据，下次启动会再修一次、
  // 再弹一次提示，用户会以为"每次打开都在损坏我的简历"。
  if (issues.length) await persistStore();
}
async function persistStore(snapshot = storeState) {
  await extensionStorageSet(STORE_KEY, clone(snapshot));
}
function findDirection(id) { return storeState?.directions.find((direction) => direction.id === id) || null; }
function resetEditorState(direction) {
  activeDirection = direction;
  draft = clone(direction.currentDraft.content);
  layout = clone(direction.currentDraft.layout || DEFAULT_LAYOUT);
  undoStack = [];
  undoLastAt = 0;
  draftRevision = 0;
  savedRevision = 0;
  clearTimeout(saveTimer);
  saveTimer = null;
  saveInFlight = null;
  storeState.lastOpenedDirectionId = direction.id;
}
function captureDraft() {
  if (!activeDirection || !draft) return;
  activeDirection.currentDraft = { content: clone(draft), layout: clone(layout || DEFAULT_LAYOUT), updatedAt: activeDirection.currentDraft.updatedAt || nowIso() };
}
function scheduleSave() {
  if (!activeDirection || !draft) return;
  draftRevision += 1;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveNow().catch(() => {}); }, 360);
}
async function saveNow() {
  if (!activeDirection || !draft) return false;
  clearTimeout(saveTimer);
  saveTimer = null;
  if (saveInFlight) {
    await saveInFlight;
    if (savedRevision < draftRevision) return saveNow();
    return true;
  }
  const directionId = activeDirection.id;
  const revision = draftRevision;
  const nextDraft = { content: clone(draft), layout: clone(layout || DEFAULT_LAYOUT), updatedAt: nowIso() };
  activeDirection.currentDraft = nextDraft;
  storeState.lastOpenedDirectionId = directionId;
  const snapshot = clone(storeState);
  saveInFlight = persistStore(snapshot).then(() => {
    savedRevision = Math.max(savedRevision, revision);
    if (activeDirection?.id === directionId) activeDirection.currentDraft.updatedAt = nextDraft.updatedAt;
    return true;
  }).catch((error) => {
    showToast(`保存失败，内容仍在当前页面。原因：${error.message}`, 'error', () => saveNow());
    return false;
  }).finally(() => { saveInFlight = null; });
  const ok = await saveInFlight;
  if (ok && savedRevision < draftRevision) return saveNow();
  return ok;
}
function pushUndo(force = false) {
  if (!activeDirection || !draft) return;
  const now = Date.now();
  // 限流只在"距上次快照够久"时生效。注意被限流时不能更新 undoLastAt：
  // 否则连续输入会把时间戳一直往后推，850ms 窗口永远不到期，
  // 一次连续输入就只会留下一个快照，撤销粒度完全丧失。
  if (!force && now - undoLastAt < 850) return;
  undoStack.push({ directionId: activeDirection.id, content: clone(draft), layout: clone(layout), name: activeDirection.name });
  if (undoStack.length > 180) undoStack.shift();
  undoLastAt = now;
}
async function undo() {
  if (undoInProgress || !undoStack.length || !activeDirection) return;
  undoInProgress = true;
  try {
    // 撤销栈可能残留其它方向的快照（切方向时旧栈未清干净）。
    // 丢弃这些跨方向条目再回退，否则栈顶永远不匹配，撤销会被永久卡死。
    while (undoStack.length && undoStack[undoStack.length - 1].directionId !== activeDirection.id) undoStack.pop();
    if (!undoStack.length) return;
    const previous = undoStack.pop();
    draft = clone(previous.content);
    layout = clone(previous.layout);
    activeDirection.name = previous.name;
    elements.title.textContent = previous.name;
    renderPaper();
    scheduleFit();
    scheduleSave();
  } finally { undoInProgress = false; }
}
function safeFragment(html) {
  const source = document.createElement('template');
  source.innerHTML = String(html || '');
  const out = document.createElement('template');
  function copyNode(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.nodeValue || '')); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') { parent.append(document.createElement('br')); return; }
    if (tag === 'b' || tag === 'strong') {
      const safe = document.createElement(tag);
      Array.from(node.childNodes).forEach((child) => copyNode(child, safe));
      parent.append(safe);
      return;
    }
    Array.from(node.childNodes).forEach((child) => copyNode(child, parent));
  }
  Array.from(source.content.childNodes).forEach((node) => copyNode(node, out.content));
  return out.innerHTML;
}
function plainTextFromHtml(html) {
  const node = document.createElement('div');
  node.innerHTML = safeFragment(html);
  return node.innerText || node.textContent || '';
}
function serializeEditable(element) {
  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    const inner = Array.from(node.childNodes).map(serialize).join('');
    if (tag === 'b' || tag === 'strong') return `<${tag}>${inner}</${tag}>`;
    if (tag === 'div' || tag === 'p') return `${inner}<br>`;
    return inner;
  }
  return Array.from(element.childNodes).map(serialize).join('').replace(/(?:<br>)+$/i, '');
}
function makeEditable(html, editKey, label, extraClass = '', align, placeholder) {
  const span = document.createElement('span');
  span.className = extraClass;
  span.innerHTML = safeFragment(html);
  if (align) span.style.textAlign = align;
  if (placeholder) span.dataset.placeholder = placeholder;
  span.contentEditable = 'true';
  span.spellcheck = false;
  span.dataset.edit = editKey;
  span.setAttribute('aria-label', label || '简历文字');
  applyRunsToElement(span);
  return span;
}
function textSpan(value, align) {
  const span = document.createElement('span');
  span.innerHTML = safeFragment(value);
  if (align) span.style.textAlign = align;
  applyRunsToElement(span);
  return span;
}
function contactIconSvg(kind, label) {
  return `<svg viewBox="0 0 24 24" role="img" aria-label="${label}"><path d="${ICONS[kind]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${kind === 'wechat' ? ' transform="translate(-2.4 -2.4) scale(1.2)"' : ''}></path></svg>`;
}
function createBullet(item, sectionType, editable) {
  const li = document.createElement('li');
  li.className = 'bullet sortable';
  li.dataset.itemId = item.id;
  li.dataset.sortKind = 'bullet';
  li.dataset.section = sectionType;
  if (item.align) li.style.textAlign = item.align;
  li.append(editable ? makeEditable(item.html, `bullet|${sectionType}|${item.id}`, '要点', '', item.align, '要点') : textSpan(item.html, item.align));
  return li;
}
function createBulletList(items, sectionType, editable) {
  const ul = document.createElement('ul');
  ul.className = 'bullet-list';
  for (const item of items || []) ul.append(createBullet(item, sectionType, editable));
  return ul;
}
function createExperience(entry, sectionType, editable) {
  const block = document.createElement('article');
  block.className = `experience sortable${entry.bullets?.length ? ' has-bullets' : ''}`;
  block.dataset.itemId = entry.id;
  block.dataset.sortKind = 'experience';
  block.dataset.section = sectionType;
  const head = document.createElement('div');
  head.className = 'experience-head';
  entry.columns.forEach((column, index) => {
    const placeholder = sectionType === 'education' ? '' : COLUMN_PLACEHOLDERS[index];
    head.append(editable
      ? makeEditable(column.html, `column|${sectionType}|${entry.id}|${index}`, `条目第${index + 1}栏`, 'entry-field', column.align, placeholder)
      : textSpan(column.html, column.align));
  });
  block.append(head);
  if (sectionType !== 'education') block.append(createBulletList(entry.bullets, sectionType, editable));
  return block;
}
function createSection(contentSection, editable, isFirst) {
  const section = document.createElement('section');
  section.className = `resume-section${isFirst ? ' first-section' : ''}`;
  section.dataset.type = contentSection.type;
  const heading = document.createElement('h2');
  heading.className = 'section-heading';
  const label = editable
    ? makeEditable(contentSection.title.html, `title|${contentSection.type}`, '分区标题', 'section-label', contentSection.title.align)
    : textSpan(contentSection.title.html, contentSection.title.align);
  label.classList.add('section-label');
  heading.append(label);
  section.append(heading);
  const body = document.createElement('div');
  body.className = 'section-body';
  if (contentSection.type === 'skills') body.append(createBulletList(contentSection.bullets, 'skills', editable));
  else if (contentSection.type === 'education') {
    const row = document.createElement('div');
    row.className = 'experience-head education-head';
    contentSection.columns.forEach((column, index) => row.append(editable
      ? makeEditable(column.html, `column|education||${index}`, `教育信息第${index + 1}栏`, 'entry-field', column.align)
      : textSpan(column.html, column.align)));
    body.append(row, createBulletList(contentSection.bullets, 'education', editable));
  } else for (const entry of contentSection.entries || []) body.append(createExperience(entry, contentSection.type, editable));
  section.append(body);
  return section;
}
function createIdentity(identity, editable) {
  const wrapper = document.createElement('header');
  wrapper.className = 'identity';
  const name = editable ? makeEditable(identity.name.html, 'name', '姓名', 'person-name', identity.name.align) : textSpan(identity.name.html, identity.name.align);
  name.classList.add('person-name');
  wrapper.append(name);
  const contactRow = document.createElement('div');
  contactRow.className = 'contact-row';
  [['phone', '电话'], ['email', '邮箱'], ['wechat', '微信']].forEach(([type, label], index) => {
    if (index) { const separator = document.createElement('span'); separator.className = 'contact-separator'; separator.textContent = '｜'; contactRow.append(separator); }
    const item = document.createElement('span'); item.className = 'contact-item';
    const icon = document.createElement('span'); icon.className = 'contact-icon'; icon.innerHTML = contactIconSvg(type, label); item.append(icon);
    const value = identity.contacts[type];
    item.append(editable ? makeEditable(value.html, `contact|${type}`, label, '', value.align) : textSpan(value.html, value.align));
    contactRow.append(item);
  });
  wrapper.append(contactRow);
  const linksRow = document.createElement('div');
  linksRow.className = 'contact-row contact-links';
  const links = identity.links || {};
  [['github', links.github], ['personalWebsite', links.personalWebsite]].forEach(([type, link]) => {
    if (!link) return;
    if (linksRow.childNodes.length) { const separator = document.createElement('span'); separator.className = 'contact-separator'; separator.textContent = '｜'; linksRow.append(separator); }
    const item = document.createElement('span'); item.className = 'link-item';
    const icon = document.createElement('span');
    if (type === 'github') { icon.className = 'github-icon'; icon.innerHTML = ICONS.github; }
    else { icon.className = 'contact-icon'; icon.innerHTML = contactIconSvg('website', '个人网站'); }
    item.append(icon);
    const anchor = document.createElement('a');
    // 只渲染 http(s) 链接：扩展页是高权限来源，javascript:/data: 之类必须挡住；
    // 空 href 是"链接已添加但还没填完"的中间态（D-03），不给可点击目标。
    const safeHref = /^https?:\/\//i.test(link.href || '') ? link.href : '';
    if (safeHref) anchor.href = safeHref;
    anchor.innerHTML = runsHtml(link.href || '');
    anchor.style.textAlign = link.align || '';
    if (editable) {
      anchor.contentEditable = 'true'; anchor.spellcheck = false; anchor.dataset.edit = type === 'github' ? 'githubHref' : 'websiteHref'; anchor.setAttribute('aria-label', type === 'github' ? 'GitHub 链接' : '个人网页链接');
      if (!link.href) anchor.dataset.placeholder = type === 'github' ? '填写 GitHub 地址' : '填写个人网页地址';
    }
    item.append(anchor); linksRow.append(item);
  });
  if (linksRow.childNodes.length) wrapper.append(linksRow);
  if (editable) {
    const addMenu = document.createElement('div');
    addMenu.className = 'contact-add-menu';
    for (const type of ['github', 'personalWebsite']) {
      if (links[type]) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.addLink = type; button.textContent = type === 'github' ? '＋ GitHub' : '＋ 个人网页'; addMenu.append(button);
    }
    if (addMenu.childNodes.length) wrapper.append(addMenu);
  }
  return wrapper;
}
function buildPaperContent(target, content, editable) {
  const flow = document.createElement('div');
  flow.className = 'resume-flow';
  flow.append(createIdentity(content.identity, editable));
  content.sections.forEach((section, index) => flow.append(createSection(section, editable, index === 0)));
  target.replaceChildren(flow);
}
function renderPaper() {
  if (!draft || !activeDirection) return;
  sortHover = null;
  elements.title.textContent = activeDirection.name;
  document.title = activeDirection.name;
  buildPaperContent(elements.paperContent, draft, true);
  elements.paper.classList.toggle('guide-on', showGuide);
  updateCurrentSortSelection();
}
function pathToValue(key) {
  const [kind, a, b, c] = key.split('|');
  if (kind === 'name') return draft.identity.name;
  if (kind === 'contact') return draft.identity.contacts[a];
  if (kind === 'title') return draft.sections.find((section) => section.type === a)?.title;
  if (kind === 'githubHref' || kind === 'websiteHref') return draft.identity.links[kind === 'githubHref' ? 'github' : 'personalWebsite'];
  if (kind === 'bullet') {
    // 要点键统一为 `bullet|<sectionType>|<bulletId>`（见 createBullet）。
    // bulletId 在整份文档内唯一，因此按板块 + bulletId 定位即可：
    // skills/education 的要点直接挂在板块上，work/projects 的要点挂在
    // 某条经历内，需要在该板块的各条经历里找出持有该 bulletId 的那条。
    if (a === 'skills') return draft.sections.find((item) => item.type === 'skills')?.bullets.find((item) => item.id === b);
    const section = draft.sections.find((item) => item.type === a);
    if (a === 'education') return section?.bullets.find((item) => item.id === b);
    for (const entry of section?.entries || []) {
      const found = entry.bullets.find((item) => item.id === b);
      if (found) return found;
    }
    return undefined;
  }
  if (kind === 'column' && a === 'education') return draft.sections.find((item) => item.type === 'education')?.columns[Number(c)];
  if (kind === 'column') return draft.sections.find((item) => item.type === a)?.entries.find((item) => item.id === b)?.columns[Number(c)];
  return null;
}
function updateContentFromElement(element) {
  const key = element.dataset.edit;
  if (!key) return;
  const value = pathToValue(key);
  // 定位不到目标时不能静默返回：否则用户的输入既没保存、界面也没提示，
  // 看起来像"打了字没反应"。至少要留下可诊断的记录。
  if (!value) { console.warn('[resume] 无法定位编辑目标，已跳过保存：', key); return; }
  // 链接输入统一归一化：自动补 https://，拒掉 javascript:/data: 等协议。
  // 否则用户填 "github.com/x" 会存成非 http(s) 地址，重开时整份简历被判
  // invalid 而丢弃（见 loadStore）。
  if (key === 'githubHref' || key === 'websiteHref') value.href = normalizeLinkHref(element.innerText || '');
  else if (Object.hasOwn(value, 'html')) value.html = serializeEditable(element);
  if (element.style.textAlign && Object.hasOwn(value, 'align')) value.align = element.style.textAlign;
}
function applySpacing(bodyPt, slack, spacing) {
  const style = elements.paper.style;
  style.setProperty('--body-size', `${bodyPt.toFixed(2)}pt`);
  style.setProperty('--body-line', `${spacing.bodyLineHeightPt.toFixed(4)}pt`);
  style.setProperty('--entry-line', `${spacing.threeColumnTitleLineHeightPt.toFixed(4)}pt`);
  style.setProperty('--bullet-gap', `${spacing.sameGroupBulletGapPt.toFixed(4)}pt`);
  style.setProperty('--section-gap', `${spacing.sectionBeforeGapPt.toFixed(4)}pt`);
  style.setProperty('--title-bullet-gap', `${spacing.largeTitleToFirstBulletGapPt.toFixed(4)}pt`);
  style.setProperty('--title-entry-gap', `${spacing.largeTitleToFirstThreeColumnGapPt.toFixed(4)}pt`);
  style.setProperty('--exp-gap', `${spacing.previousExperienceBulletToNextThreeColumnGapPt.toFixed(4)}pt`);
  style.setProperty('--entry-bullet-gap', `${spacing.threeColumnToFirstBulletGapPt.toFixed(4)}pt`);
  layout = { ...(layout || DEFAULT_LAYOUT), bodyPt, slack, marginsMm: { ...DEFAULT_LAYOUT.marginsMm } };
}
function applyAutoFit() {
  if (!draft || !elements.paperContent.querySelector('.resume-flow')) return;
  const flow = elements.paperContent.querySelector('.resume-flow');
  const available = elements.paperContent.clientHeight;
  const fit = fitResumeLayout({
    availableHeightPx: available,
    measureContentHeightPx: ({ bodyPt, slack, spacing }) => {
      applySpacing(bodyPt, slack, spacing);
      return flow.getBoundingClientRect().height / Math.max(currentPaperScale, 0.01);
    },
  });
  applySpacing(fit.bodyPt, fit.slack, fit.spacing);
  elements.paper.classList.toggle('is-overflow', !fit.fits);
  currentOverflowPx = fit.fits ? 0 : fit.overflowPx;
  const contactRows = Array.from(elements.paperContent.querySelectorAll('.contact-row'));
  contactRows.forEach((row) => row.classList.toggle('overflow', row.scrollWidth > row.clientWidth + 1));
  const contactConflict = contactRows.some((row) => row.classList.contains('overflow'));
  exportBlockedReason = !fit.fits ? '当前内容在最小字号下仍超过一页，请删减文字后再打印。' : contactConflict ? '联系方式超过固定两行的宽度，请修改联系方式。' : '';
  elements.export.disabled = Boolean(exportBlockedReason);
  elements.export.title = exportBlockedReason;
  updateViewScale();
  updateSortHandle();
}
function updateViewScale() {
  const style = getComputedStyle(elements.paperScroller);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availableWidth = Math.max(220, elements.paperScroller.clientWidth - horizontalPadding - 8);
  const availableHeight = Math.max(220, elements.paperScroller.clientHeight - verticalPadding - 8);
  const fitBase = Math.min(availableWidth / PAPER_WIDTH_PX, availableHeight / PAPER_HEIGHT_PX, 1);
  const scale = fitBase * zoomFactor;
  currentPaperScale = Math.max(0.25, Math.min(2.5, scale));
  document.documentElement.style.setProperty('--paper-scale', String(currentPaperScale));
  document.documentElement.style.setProperty('--paper-width', `${PAPER_WIDTH_PX}px`);
  document.documentElement.style.setProperty('--paper-height', `${PAPER_HEIGHT_PX}px`);
  elements.paperSpace.style.width = `${PAPER_WIDTH_PX * currentPaperScale}px`;
  elements.paperSpace.style.height = `${(PAPER_HEIGHT_PX + currentOverflowPx) * currentPaperScale}px`;
  byId('zoom-readout').textContent = zoomFactor === 1 ? '整页' : `${Math.round(currentPaperScale * 100)}%`;
  updateSortHandle();
}
function scheduleFit() {
  if (fitFrame) cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => { fitFrame = 0; applyAutoFit(); });
}
function updateCurrentSortSelection() {
  elements.paperContent.querySelectorAll('.sortable').forEach((item) => item.classList.remove('selected'));
  const active = document.activeElement;
  if (active?.dataset?.edit) {
    const parts = active.dataset.edit.split('|');
    if (parts[0] === 'bullet') {
      const item = elements.paperContent.querySelector(`.bullet[data-item-id="${CSS.escape(parts[2])}"]`);
      item?.classList.add('selected');
    } else if (parts[0] === 'column') {
      const item = elements.paperContent.querySelector(`.experience[data-item-id="${CSS.escape(parts[2])}"]`);
      item?.classList.add('selected');
    }
  }
  updateSortHandle();
}
function updateSortHandle() {
  const handle = elements.sortHandle;
  // 拖动进行中：保持手柄当前可见/隐藏状态，不被焦点竞态（focusout 触发
  // 的 updateCurrentSortSelection）中途隐藏，否则 setPointerCapture 目标
  // 被隐藏会触发 pointercancel，导致拖动在开始前被取消。
  if (dragState) return;
  const target = elements.paperContent.querySelector('.sortable.selected') || sortHover;
  if (!target || currentView !== 'editor') { handle.hidden = true; return; }
  const rect = target.getBoundingClientRect();
  const paperRect = elements.paper.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) { handle.hidden = true; return; }
  handle.style.left = `${Math.max(2, paperRect.left + 1)}px`;
  handle.style.top = `${Math.max(2, Math.min(window.innerHeight - 34, rect.top + (rect.height - 32) / 2))}px`;
  handle.hidden = false;
}
function focusEditable(element, selectAll = false) {
  if (!element) return;
  element.focus();
  if (selectAll) {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
}
// 定位某个要点所属的数组。找不到时返回 null，调用方必须判空后再操作，
// 否则会出现 "Cannot read properties of null (reading 'splice')" 之类的崩溃。
function findBulletList(sectionType, bulletId) {
  const section = draft.sections.find((item) => item.type === sectionType);
  if (!section) return null;
  if (sectionType === 'skills' || sectionType === 'education') return Array.isArray(section.bullets) ? section.bullets : null;
  for (const entry of section.entries || []) if (entry.bullets?.some((item) => item.id === bulletId)) return entry.bullets;
  return null;
}
function addBulletAfter(element, initialHtml = '') {
  const [kind, sectionType, bulletId] = element.dataset.edit.split('|');
  if (kind !== 'bullet') return;
  const list = findBulletList(sectionType, bulletId);
  if (!list) return;
  pushUndo(true);
  const item = { id: uid(`${sectionType}-bullet`), html: initialHtml };
  // findIndex 返回 -1（锚点不在列表里）时应追加到末尾，而不是静默插到最前面。
  const anchorIndex = list.findIndex((entry) => entry.id === bulletId);
  list.splice(anchorIndex < 0 ? list.length : anchorIndex + 1, 0, item);
  renderPaper(); scheduleFit(); scheduleSave();
  focusEditable(elements.paperContent.querySelector(`[data-edit="bullet|${CSS.escape(sectionType)}|${CSS.escape(item.id)}"]`));
}
function addExperienceAfter(sectionType, entryId) {
  const section = draft.sections.find((item) => item.type === sectionType);
  if (!section || !['work', 'projects'].includes(sectionType)) return;
  pushUndo(true);
  const item = { id: uid(`${sectionType}-entry`), columns: [{ html: '' }, { html: '' }, { html: '' }], bullets: [] };
  const anchorIndex = section.entries.findIndex((entry) => entry.id === entryId);
  section.entries.splice(anchorIndex < 0 ? section.entries.length : anchorIndex + 1, 0, item);
  renderPaper(); scheduleFit(); scheduleSave();
  focusEditable(elements.paperContent.querySelector(`[data-edit="column|${CSS.escape(sectionType)}|${CSS.escape(item.id)}|0"]`));
}
function removeBullet(element) {
  const [, sectionType, bulletId] = element.dataset.edit.split('|');
  const list = findBulletList(sectionType, bulletId);
  const index = list?.findIndex((item) => item.id === bulletId) ?? -1;
  if (index < 0) return;
  pushUndo(true); list.splice(index, 1); renderPaper(); scheduleFit(); scheduleSave();
}
function removeExperience(sectionType, entryId) {
  const section = draft.sections.find((item) => item.type === sectionType);
  const index = section?.entries.findIndex((item) => item.id === entryId) ?? -1;
  if (index < 0) return;
  pushUndo(true); section.entries.splice(index, 1); renderPaper(); scheduleFit(); scheduleSave();
}
function addLink(type) {
  pushUndo(true);
  draft.identity.links[type] = { type, href: '', label: { html: type === 'github' ? 'GitHub' : '个人网页' } };
  renderPaper(); scheduleFit(); scheduleSave();
  focusEditable(elements.paperContent.querySelector(`[data-edit="${type === 'github' ? 'githubHref' : 'websiteHref'}"]`), true);
}
function removeLink(type) {
  pushUndo(true); draft.identity.links[type] = null; renderPaper(); scheduleFit(); scheduleSave();
}
function setFieldAlignment(element, alignment) {
  const value = pathToValue(element.dataset.edit);
  const target = element.closest('.bullet') || element;
  if (getComputedStyle(target).textAlign === alignment) return;
  pushUndo(true); target.style.textAlign = alignment; element.style.textAlign = alignment;
  if (value) value.align = alignment;
  scheduleFit(); scheduleSave();
}
function onEditorKeydown(event) {
  const element = event.target.closest('[data-edit]');
  if (!element || !elements.paperContent.contains(element)) return;
  const parts = element.dataset.edit.split('|');
  const kind = parts[0];
  if (event.metaKey && ['i', 'u'].includes(event.key.toLowerCase())) { event.preventDefault(); return; }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (kind === 'bullet' && event.shiftKey) { document.execCommand('insertLineBreak'); return; }
    if (kind === 'bullet') { addBulletAfter(element); return; }
    if (kind === 'column' && ['work', 'projects'].includes(parts[1])) { addExperienceAfter(parts[1], parts[2]); return; }
    element.blur(); return;
  }
  if ((event.key === 'Backspace' || event.key === 'Delete') && kind === 'bullet' && !plainTextFromHtml(serializeEditable(element)).trim()) { event.preventDefault(); removeBullet(element); return; }
  if ((event.key === 'Backspace' || event.key === 'Delete') && kind === 'column' && ['work', 'projects'].includes(parts[1]) && !plainTextFromHtml(serializeEditable(element)).trim()) { event.preventDefault(); removeExperience(parts[1], parts[2]); return; }
  if ((event.key === 'Backspace' || event.key === 'Delete') && ['githubHref', 'websiteHref'].includes(kind) && !element.innerText.trim()) { event.preventDefault(); removeLink(kind === 'githubHref' ? 'github' : 'personalWebsite'); return; }
  if (event.metaKey && event.key.toLowerCase() === 'a') { event.preventDefault(); focusEditable(element, true); return; }
  if (event.metaKey && !event.shiftKey && event.key === 'ArrowLeft') { event.preventDefault(); setFieldAlignment(element, 'left'); }
  if (event.metaKey && !event.shiftKey && event.key === 'ArrowRight') { event.preventDefault(); setFieldAlignment(element, 'right'); }
  if (event.metaKey && !event.shiftKey && event.key === 'ArrowDown') { event.preventDefault(); setFieldAlignment(element, 'center'); }
  if (event.metaKey && event.key.toLowerCase() === 'b' && kind === 'bullet') { event.preventDefault(); document.execCommand('bold'); updateContentFromElement(element); normalizeFieldRuns(element); scheduleFit(); scheduleSave(); }
}
function onPaste(event) {
  const element = event.target.closest('[data-edit]');
  if (!element || !elements.paperContent.contains(element)) return;
  event.preventDefault();
  const raw = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text/html').replace(/<br\s*\/?\s*>|<\/(p|div|li)>/gi, '\n').replace(/<[^>]*>/g, '');
  const parts = element.dataset.edit.split('|');
  if (parts[0] === 'bullet') {
    const lines = raw.replace(/\r/g, '').split('\n');
    const first = lines.shift() || '';
    document.execCommand('insertText', false, first);
    updateContentFromElement(element);
    let previousId = parts[2];
    for (const line of lines) {
      const list = findBulletList(parts[1], previousId);
      // 列表定位不到（数据不完整）时停止追加，避免对 null 调用 splice 崩溃。
      if (!list) break;
      const item = { id: uid(`${parts[1]}-bullet`), html: escapeHtml(line) };
      list.splice(Math.max(0, list.findIndex((entry) => entry.id === previousId) + 1), 0, item);
      previousId = item.id;
    }
    if (lines.length) renderPaper();
  } else { document.execCommand('insertText', false, raw.replace(/\r?\n/g, ' ')); updateContentFromElement(element); }
  normalizeFieldRuns(element); scheduleFit(); scheduleSave();
}
function onCompositionStart() {
  // 输入法组字期间 beforeinput 不会压入撤销快照，若这里也不压，
  // 整段中文输入就完全没有撤销点（违反 E-05：文字改动可用 ⌘Z 撤销）。
  if (!composing) pushUndo(true);
  composing = true;
}
function onCompositionEnd(event) { composing = false; const element = event.target.closest('[data-edit]'); if (element) { updateContentFromElement(element); normalizeFieldRuns(element); scheduleFit(); scheduleSave(); } }
function onInput(event) { const element = event.target.closest('[data-edit]'); if (!element || composing) return; updateContentFromElement(element); scheduleFit(); scheduleSave(); }
function onBeforeInput(event) { const element = event.target.closest('[data-edit]'); if (element && !composing) pushUndo(false); }
function onFocusIn(event) { if (event.target.closest('[data-edit]')) updateCurrentSortSelection(); }
function onFocusOut(event) { const element = event.target.closest('[data-edit]'); if (element && !composing) normalizeFieldRuns(element); if (!dragState) setTimeout(updateCurrentSortSelection, 0); }
function installDrag() {
  elements.sortHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const item = elements.paperContent.querySelector('.sortable.selected') || sortHover;
    const list = item?.parentElement;
    if (!item || !list) return;
    event.preventDefault();
    dragState = { item, list, section: item.dataset.section, kind: item.dataset.sortKind, moved: false };
    item.classList.add('dragging'); elements.sortHandle.classList.add('is-dragging');
    try { elements.sortHandle.setPointerCapture(event.pointerId); } catch {}
  });
  document.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sortable');
    if (!target || target === dragState.item || target.parentElement !== dragState.list || target.dataset.sortKind !== dragState.kind) return;
    const rect = target.getBoundingClientRect();
    dragState.list.insertBefore(dragState.item, event.clientY > rect.top + rect.height / 2 ? target.nextSibling : target);
    dragState.moved = true; elements.sortHandle.hidden = true;
  });
  document.addEventListener('pointerup', finishDrag); document.addEventListener('pointercancel', finishDrag);
  // 悬停即显示手柄：Mac 三指拖动是直接手势，不要求先点进字段聚焦。
  // 这样即便未聚焦，鼠标/触控移到某行时手柄也会在该行左侧出现，可直接起拖。
  elements.paperContent.addEventListener('mouseover', (event) => {
    const item = event.target.closest('.sortable');
    if (item !== sortHover) { sortHover = item; updateSortHandle(); }
  });
  elements.paperContent.addEventListener('mouseout', (event) => {
    if (sortHover && !event.relatedTarget?.closest?.('.sortable')) { sortHover = null; updateSortHandle(); }
  });
}
function finishDrag() {
  if (!dragState) return;
  const state = dragState; dragState = null; elements.sortHandle.classList.remove('is-dragging'); state.item.classList.remove('dragging');
  if (!state.moved) { updateSortHandle(); return; }
  pushUndo(true);
  const ids = Array.from(state.list.querySelectorAll(':scope > .sortable')).map((item) => item.dataset.itemId);
  if (state.kind === 'experience') {
    const section = draft.sections.find((item) => item.type === state.section);
    if (!section?.entries) { renderPaper(); scheduleFit(); scheduleSave(); return; }
    const map = new Map(section.entries.map((item) => [item.id, item])); section.entries = ids.map((id) => map.get(id)).filter(Boolean);
  } else {
    // 列表定位不到时安全退出：DOM 顺序已经变了，但草稿不乱写，
    // 重新渲染回到数据里的顺序即可（避免对 null 调用 splice 崩溃）。
    const list = findBulletList(state.section, ids[0]);
    if (!list) { renderPaper(); scheduleFit(); scheduleSave(); return; }
    const map = new Map(list.map((item) => [item.id, item]));
    const sorted = ids.map((id) => map.get(id)).filter(Boolean); list.splice(0, list.length, ...sorted);
  }
  renderPaper(); scheduleFit(); scheduleSave();
}
function setView(view) {
  currentView = view;
  elements.editor.classList.toggle('hidden', view !== 'editor');
  elements.directionView.classList.toggle('hidden', view !== 'directions');
  if (view !== 'editor') elements.sortHandle.hidden = true;
  if (view === 'directions') { renderDirections(); setTimeout(() => elements.directionSearch.focus(), 40); }
  else updateSortHandle();
}
function renderDirections() {
  const query = elements.directionSearch.value.trim().toLowerCase();
  const directions = storeState.directions.filter((direction) => !query || direction.name.toLowerCase().includes(query));
  elements.directionGrid.replaceChildren(...directions.map(renderDirectionCard));
  renderImportStatus();
  updateCardScales();
}
function renderDirectionCard(direction) {
  const article = document.createElement('article'); article.className = 'library-card direction-card'; article.dataset.directionId = direction.id;
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const info = document.createElement('div'); info.className = 'card-info';
  const kind = document.createElement('span'); kind.className = 'card-kind'; kind.textContent = direction.id === activeDirection?.id ? '当前方向' : '简历方向'; info.append(kind);
  const title = document.createElement('button'); title.type = 'button'; title.className = 'card-name'; title.textContent = direction.name; title.dataset.renameDirection = direction.id; title.title = '点击修改方向名称'; info.append(title);
  const time = document.createElement('div'); time.className = 'card-time'; time.textContent = `最近编辑 ${fmtMinute(direction.currentDraft.updatedAt)}`; info.append(time);
  meta.append(info);
  const actions = document.createElement('div'); actions.className = 'card-actions';
  const renameButton = document.createElement('button'); renameButton.type = 'button'; renameButton.dataset.renameDirection = direction.id; renameButton.setAttribute('aria-label', '修改方向名称'); renameButton.title = '修改方向名称'; renameButton.innerHTML = ICONS.pencil; actions.append(renameButton);
  const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.dataset.deleteDirection = direction.id; deleteButton.setAttribute('aria-label', '删除方向'); deleteButton.title = '删除方向'; deleteButton.innerHTML = ICONS.trash; actions.append(deleteButton); meta.append(actions); article.append(meta);
  const frame = document.createElement('div'); frame.className = 'card-paper-frame'; frame.dataset.openDirection = direction.id; frame.setAttribute('role', 'button'); frame.setAttribute('tabindex', '0'); frame.setAttribute('aria-label', `打开${direction.name}`);
  const mini = document.createElement('div'); mini.className = 'card-paper'; mini.style.setProperty('--body-size', `${Number(direction.currentDraft.layout?.bodyPt || 10.5).toFixed(2)}pt`); const inner = document.createElement('div'); inner.className = 'paper-content'; buildPaperContent(inner, direction.currentDraft.content, false); mini.append(inner); frame.append(mini); article.append(frame); return article;
}
function updateCardScales() {
  elements.directionGrid.querySelectorAll('.card-paper-frame').forEach((frame) => frame.querySelector('.card-paper')?.style.setProperty('--card-scale', String(frame.clientWidth / PAPER_WIDTH_PX)));
}
async function openDirection(id) {
  const direction = findDirection(id); if (!direction) return;
  if (activeDirection?.id !== id && !(await saveNow())) return;
  resetEditorState(direction); renderPaper(); setView('editor'); scheduleFit(); await persistStore();}
function openDirections() { setView('directions'); }
function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function confirmAction(message, title = '请确认', actionText = '确认') {
  elements.confirmTitle.textContent = title; elements.confirmMessage.textContent = message; elements.confirmAction.textContent = actionText; openDialog(elements.confirmDialog);
  return new Promise((resolve) => {
    const done = () => { elements.confirmDialog.removeEventListener('close', done); resolve(elements.confirmDialog.returnValue === 'confirm'); };
    elements.confirmDialog.addEventListener('close', done);
  });
}
function openCreateDirection() {
  elements.directionName.value = '';
  elements.directionTemplate.replaceChildren(...storeState.directions.map((direction) => { const option = document.createElement('option'); option.value = direction.id; option.textContent = direction.name; return option; }));
  if (activeDirection) elements.directionTemplate.value = activeDirection.id;
  openDialog(elements.directionDialog); elements.directionName.focus();
}
async function createDirection() {
  const name = elements.directionName.value.trim(); const template = findDirection(elements.directionTemplate.value) || activeDirection;
  if (!name || !template) return;
  if (!(await saveNow())) return;
  const direction = makeDirection(name, template.currentDraft.content, template.currentDraft.layout);
  storeState.directions.push(direction); resetEditorState(direction); await persistStore();
  elements.directionDialog.close('created'); renderPaper(); setView('editor'); scheduleFit();}
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * Import a resume direction from a JSON file. Accepts either a bare resume
 * content document or a wrapper `{ name, content }`. Validation reuses the
 * same domain validator as storage loading, so an invalid file never enters
 * the store. The new direction is independent after import (S-03).
 *
 * `handle`（可选）是 File System Access 的文件句柄：传入时连同 lastImport
 * 元数据一起持久化，使"导入的路径"在会话之间可靠保留，重开会话后可一键
 * 重新导入同一文件；不传（input 降级路径）时只记录文件名。
 */
async function importDirectionFromFile(file, handle = null) {
  let parsed;
  try {
    parsed = JSON.parse(await readFileAsText(file));
  } catch (error) {
    showToast(`导入失败：文件不是有效的 JSON。原因：${error.message}`, 'error');
    return;
  }
  const content = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.content && typeof parsed.content === 'object'
    ? parsed.content
    : parsed;
  const nameFromWrapper = typeof parsed?.name === 'string' ? parsed.name.trim() : '';
  const nameFromContent = content?.identity?.name?.html ? plainTextFromHtml(content.identity.name.html).trim() : '';
  // 先修复再校验：外部文件常见的轻微不合规（链接缺协议、板块缺字段、
  // id 重复、链接地址没填完）应该被自动修好，而不是整份拒绝导入。
  // 修复过程保留全部正文内容，绝不丢字。
  const repaired = repairResumeContent(content);
  const validation = validateResumeContent(repaired.content);
  if (!validation.valid) {
    showToast(`导入失败：简历内容不符合格式。${validation.errors.slice(0, 2).join('；')}`, 'error');
    return;
  }
  if (!(await saveNow())) return;
  const direction = makeDirection(nameFromWrapper || nameFromContent || '导入的方向', repaired.content, DEFAULT_LAYOUT);
  storeState.directions.push(direction);
  resetEditorState(direction);
  storeState.lastImport = { fileName: file.name || handle?.name || '未命名文件', importedAt: nowIso(), directionId: direction.id, persisted: Boolean(handle) };
  // 先把方向数据落盘（await），再（尽力）记住文件来源句柄。来源写入若被
  // 关闭侧边栏打断或失败，不阻塞数据持久化，避免“导入后一关侧边栏方向从未
  // 写盘、重开即丢”的竞态。S-08 此前把 persistStore 排在 saveImportHandle
  // 之后，正是这一竞态的根因。
  await persistStore();
  if (handle) { try { await saveImportHandle(handle); } catch (error) { showToast(`已导入，但记住文件来源失败：${error.message}`, 'error'); } }
  elements.importFile.value = '';
  renderPaper(); setView('editor'); scheduleFit();  showToast(`已导入「${direction.name}」，可开始编辑。`, 'success');
}

/**
 * 从上次记住的来源文件重新导入（数据持久化的消费端）。
 * 在手势内触发：queryPermission 已过期时 requestPermission 才合规。
 */
async function reimportFromLastSource() {
  let source = null;
  try { source = await loadImportSource(); } catch { source = null; }
  if (!source?.handle) {
    showToast('没有可重新导入的来源记录，请用“导入”按钮选择文件。', 'error');
    return;
  }
  try {
    const text = await readTextFromHandle(source.handle);
    await importDirectionFromFile(new File([text], source.fileName, { type: 'application/json' }), source.handle);
  } catch (error) {
    if (error && (error.message === 'NEED_PERMISSION' || error.message === 'PERMISSION_DENIED')) {
      showToast(`读取「${source.fileName}」需要重新授权，请用“导入”按钮再选一次该文件。`, 'error');
      return;
    }
    showToast(`重新导入失败：${error.message}`, 'error');
  }
}

/** 方向室渲染"上次导入"状态条：文件名 + 时间 + 重新导入按钮（有持久句柄时）。 */
function renderImportStatus() {
  const last = storeState.lastImport;
  if (!last) { elements.importStatus.hidden = true; elements.importStatus.replaceChildren(); return; }
  elements.importStatus.hidden = false;
  const label = document.createElement('span');
  label.className = 'import-status-text';
  const when = (last.importedAt || '').replace('T', ' ').slice(0, 16);
  label.textContent = `上次导入：${last.fileName}${when ? ` · ${when}` : ''}`;
  label.title = last.persisted ? '该来源已记住，可一键重新导入' : '该来源未记住文件句柄，重新导入需重新选择文件';
  elements.importStatus.replaceChildren(label);
  if (last.persisted) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiet-button import-reimport';
    button.textContent = '重新导入';
    button.title = '重新读取上次导入的文件并生成新方向';
    button.addEventListener('click', () => { reimportFromLastSource().catch((error) => showToast(`重新导入失败：${error.message}`, 'error')); });
    elements.importStatus.append(button);
  }
}

function openRenameDirection(id) {
  const direction = findDirection(id); if (!direction) return;
  pendingRenameId = id; elements.renameName.value = direction.name; openDialog(elements.renameDialog); elements.renameName.focus(); elements.renameName.select();
}
async function renameDirection(name) {
  const direction = findDirection(pendingRenameId); pendingRenameId = null; if (!direction || !name.trim()) return;
  const value = name.trim(); if (value === direction.name) return;
  if (direction.id === activeDirection?.id) pushUndo(true);
  direction.name = value; if (direction.id === activeDirection?.id) elements.title.textContent = value;
  await persistStore(); if (currentView === 'directions') renderDirections();}
async function deleteDirection(id) {
  if (storeState.directions.length <= 1) { showToast('至少要保留一份简历方向。', 'error'); return; }
  const direction = findDirection(id); if (!direction) return;
  if (!await confirmAction(`“${direction.name}”会被永久删除，不能恢复。`, '删除简历方向', '删除')) return;
  const wasActive = activeDirection?.id === id;
  const index = storeState.directions.findIndex((item) => item.id === id);
  storeState.directions.splice(index, 1);
  if (wasActive) resetEditorState(storeState.directions[Math.min(index, storeState.directions.length - 1)]);
  await persistStore();
  if (wasActive) { renderPaper(); setView('editor'); scheduleFit(); }
  else renderDirections();
}
const PRINT_PAYLOAD_KEY = 'print-payload';
async function printPdf() {
  // Re-measure immediately so a click made during the autosave debounce cannot
  // print a stale layout decision.
  applyAutoFit();
  if (exportBlockedReason) { showToast(exportBlockedReason, 'error'); return; }
  if (!(await saveNow())) return;
  // Chrome 侧边栏是受限渲染面，window.print() 不可靠（Chromium 已知缺陷）。
  // 改为把当前已适配好的纸面快照交给独立打印页，在真实标签页里打印：
  // 输出与侧边栏所见一致，A4 与 @media print 规则稳定生效。
  const paper = elements.paper.cloneNode(true);
  paper.querySelectorAll('[contenteditable]').forEach((element) => {
    element.removeAttribute('contenteditable');
    element.removeAttribute('data-edit');
    element.removeAttribute('data-placeholder');
  });
  paper.querySelectorAll('.safe-zone,.boundary').forEach((element) => element.remove());
  paper.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
  paper.classList.remove('guide-on', 'is-overflow');
  try {
    await extensionStorageSet(PRINT_PAYLOAD_KEY, { html: paper.outerHTML, name: activeDirection?.name || '简历' });
    await chrome.tabs.create({ url: chrome.runtime.getURL('print.html') });
  } catch (error) {
    showToast(`打开打印页失败：${error.message}`, 'error');
  }
}
function installEvents() {
  elements.paperContent.addEventListener('keydown', onEditorKeydown);
  elements.paperContent.addEventListener('paste', onPaste);
  elements.paperContent.addEventListener('beforeinput', onBeforeInput);
  elements.paperContent.addEventListener('input', onInput);
  elements.paperContent.addEventListener('compositionstart', onCompositionStart);
  elements.paperContent.addEventListener('compositionend', onCompositionEnd);
  elements.paperContent.addEventListener('focusin', onFocusIn);
  elements.paperContent.addEventListener('focusout', onFocusOut);
  elements.paperContent.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-link]'); if (add) { event.preventDefault(); addLink(add.dataset.addLink); return; }
    if (event.target.closest('a[data-edit]')) event.preventDefault();
  });
  elements.title.addEventListener('click', () => openRenameDirection(activeDirection?.id));
  // 方向室入口：⌘F（SPEC P-03/S-07 冻结快捷键）与方向室内的"返回编辑"。
  // 顶栏按方向 A 设计稿只保留 PDF 一个主动作，不再放"方向室"按钮。
  byId('back-editor').addEventListener('click', () => setView('editor'));
  byId('create-direction').addEventListener('click', openCreateDirection);
  elements.importButton.addEventListener('click', async () => {
    // 优先 File System Access API：拿到可持久化的文件句柄，"导入的来源"
    // 才能随 IndexedDB 跨会话保留，重开会话后可一键重新导入。
    if (supportsFileSystemAccess()) {
      let handle;
      try {
        handle = await pickImportFile();
      } catch { handle = null; }
      if (handle === undefined) return; // 用户在选取器里取消
      if (handle) {
        const file = await handle.getFile();
        await importDirectionFromFile(file, handle).catch((error) => showToast(`导入失败：${error.message}`, 'error'));
        return;
      }
    }
    elements.importFile.click(); // 降级：普通文件选择（不记来源句柄）
  });
  elements.importFile.addEventListener('change', async () => {
    const file = elements.importFile.files?.[0];
    elements.importFile.value = '';
    if (file) await importDirectionFromFile(file).catch((error) => showToast(`导入失败：${error.message}`, 'error'));
  });
  elements.directionSearch.addEventListener('input', renderDirections);
  elements.directionGrid.addEventListener('click', async (event) => {
    const rename = event.target.closest('[data-rename-direction]'); if (rename) { event.stopPropagation(); openRenameDirection(rename.dataset.renameDirection); return; }
    const remove = event.target.closest('[data-delete-direction]'); if (remove) { event.stopPropagation(); await deleteDirection(remove.dataset.deleteDirection); return; }
    const frame = event.target.closest('[data-open-direction]'); if (frame) await openDirection(frame.dataset.openDirection);
  });
  elements.directionGrid.addEventListener('keydown', async (event) => { const frame = event.target.closest('[data-open-direction]'); if (frame && ['Enter', ' '].includes(event.key)) { event.preventDefault(); await openDirection(frame.dataset.openDirection); } });
  elements.directionForm.addEventListener('submit', (event) => { if (event.submitter?.value === 'create') { event.preventDefault(); createDirection().catch((error) => showToast(`新建失败：${error.message}`, 'error')); } });
  elements.renameForm.addEventListener('submit', (event) => { if (event.submitter?.value === 'rename') { event.preventDefault(); const value = elements.renameName.value; elements.renameDialog.close('renamed'); renameDirection(value).catch((error) => showToast(`改名失败：${error.message}`, 'error')); } });
  elements.confirmForm.addEventListener('submit', (event) => { if (!event.submitter) { event.preventDefault(); elements.confirmDialog.close('cancel'); } });
  byId('zoom-out').addEventListener('click', () => { zoomFactor = Math.max(0.5, Number((zoomFactor - 0.05).toFixed(2))); updateViewScale(); });
  byId('zoom-in').addEventListener('click', () => { zoomFactor = Math.min(2, Number((zoomFactor + 0.05).toFixed(2))); updateViewScale(); });
  byId('zoom-readout').addEventListener('click', () => { zoomFactor = 1; updateViewScale(); });
  byId('toggle-guide').addEventListener('click', () => { showGuide = !showGuide; elements.paper.classList.toggle('guide-on', showGuide); byId('toggle-guide').setAttribute('aria-pressed', String(showGuide)); });
  elements.export.addEventListener('click', printPdf);
  window.addEventListener('resize', updateViewScale);
  window.addEventListener('scroll', updateSortHandle, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow().catch(() => {});
  });
  window.addEventListener('pagehide', () => {
    saveNow().catch(() => {});
  });
  window.addEventListener('keydown', async (event) => {
    const key = event.key.toLowerCase();
    if (event.metaKey && key === 's') { event.preventDefault(); return; }
    if (event.metaKey && key === 'f') { event.preventDefault(); openDirections(); return; }
    if (event.metaKey && key === 'z') { event.preventDefault(); if (!event.shiftKey) await undo(); return; }
    if (event.metaKey && ['i', 'u'].includes(key)) { event.preventDefault(); return; }
    if (event.key === 'Escape' && !elements.directionDialog.open && !elements.renameDialog.open && !elements.confirmDialog.open) { if (currentView === 'directions') setView('editor'); }
  }, true);
}
function installDragObservers() {
  new ResizeObserver(updateViewScale).observe(elements.paperScroller);
  new ResizeObserver(updateCardScales).observe(elements.directionGrid);
  installDrag();
}
async function boot() {
  installEvents(); installDragObservers();
  try {
    await loadStore();
    const direction = findDirection(storeState.lastOpenedDirectionId) || storeState.directions[0];
    resetEditorState(direction); renderPaper();    requestAnimationFrame(() => { applyAutoFit(); updateViewScale(); });
  } catch (error) {
    // 打开失败时必须留一个可用的内存态：storeState 若为 null，
    // 后续"新建方向"会在 storeState.directions.push 上抛 TypeError，
    // 用户就彻底卡死在一个打不开也建不了新简历的状态里。
    if (!storeState) storeState = initialState();
    showToast(`简历没有打开，已新建一份空白简历。原因：${error.message}`, 'error');
    const fallback = storeState.directions[0];
    resetEditorState(fallback); renderPaper();
    requestAnimationFrame(() => { applyAutoFit(); updateViewScale(); });
  }
}

boot();
