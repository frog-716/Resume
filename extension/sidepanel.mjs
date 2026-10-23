import { fitResumeLayout } from './domain-auto-layout.mjs';
import { createEmptyResumeContent, createSampleResumeContent, normalizeLinkHref, repairResumeContent } from './domain-resume-content.mjs';
import { runsHtml, applyRunsToElement, normalizeFieldRuns } from './text-runs.mjs';

const PAPER_WIDTH_PX = 793.7;
const PAPER_HEIGHT_PX = 1122.5;
const STORE_KEY = 'resume-sidepanel-store-v1';
const UNREADABLE_BACKUP_KEY = `${STORE_KEY}-unreadable-backup`;
const DEFAULT_LAYOUT = Object.freeze({ marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } });
const SECTION_LABELS = { skills: '专业技能', work: '工作经历', projects: '项目经历', education: '教育背景' };
const COLUMN_PLACEHOLDERS = ['单位 / 项目', '岗位 / 职责', '日期'];
const REQUIRED_FONTS = [
  { family: '"PingFang SC"', sample: '简历', role: '中文字体（苹方）' },
  { family: '"Times New Roman"', sample: 'Resume', role: '英文与数字字体（Times New Roman）' },
];

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
};

const ICONS = {
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z',
  email: 'M3 5.5h18v13H3z M3.5 6.2 12 12.5l8.5-6.3',
  wechat: 'M8.5 6.2c-3.1 0-5.7 2-5.7 4.6 0 1.5.8 2.8 2.2 3.7l-.6 2 2.3-1.2c.6.2 1.2.3 1.8.3h.5c-.1-.4-.2-.8-.2-1.2 0-2.7 2.7-4.9 6-4.9h.5c-.2-1.9-2.3-3.3-4.8-3.3H8.5Zm6.6 4.7c-2.5 0-4.6 1.5-4.6 3.4s2.1 3.4 4.6 3.4c.5 0 1-.1 1.5-.2l1.8.9-.5-1.5c1.1-.6 1.8-1.5 1.8-2.6 0-1.9-2.1-3.4-4.6-3.4Z',
  website: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
  github: '<svg class="github-cat" role="img" aria-label="GitHub白猫" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>',
};

let storeState = null;
let activeDirection = null;
let draft = null;
let layout = null;
let currentView = 'editor';
let viewMode = 'fit';
let zoomFactor = 1;
let currentFitBase = 1;
let showGuide = true;
let currentPaperScale = 1;
let currentOverflowPx = 0;
let exportBlockedReason = '';
let fontMissingReason = '';
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
  const direction = makeDirection('我的简历', createSampleResumeContent());
  return { schemaVersion: 1, lastOpenedDirectionId: direction.id, directions: [direction] };
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
// 磁盘上有一份读不懂的存档（schemaVersion 变化、版本回退、被外部改坏）时，
// 先原样备份再进入空白态。否则接下来的第一次编辑就会用空模板覆盖磁盘，
// 旧数据静默消失——这正是"导入/保存把用户数据写没了"类事故的标准入口。
async function backupUnreadableStore(saved) {
  try {
    const existing = await extensionStorageGet(UNREADABLE_BACKUP_KEY);
    // 只保留第一份：重复覆盖会把更早（也更可能真的是用户数据）的副本冲掉。
    if (existing !== undefined) return;
    await extensionStorageSet(UNREADABLE_BACKUP_KEY, saved);
    showToast('读不到已保存的简历数据，已按空白简历打开；原数据已备份到本地存储，可联系开发者找回。', 'error');
  } catch (error) {
    showToast(`读不到已保存的简历数据，已按空白简历打开。原因：${error.message}`, 'error');
  }
}
async function loadStore() {
  const saved = await extensionStorageGet(STORE_KEY);
  if (!saved || saved.schemaVersion !== 1 || !Array.isArray(saved.directions)) {
    if (saved) await backupUnreadableStore(saved);
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
  storeState = directions.length
    ? { schemaVersion: 1, lastOpenedDirectionId: saved.lastOpenedDirectionId, directions }
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
// E-06 空列表补充入口。绝对定位、不参与纸面流：不占用排版空间，也不进
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
  } else {
    for (const entry of contentSection.entries || []) body.append(createExperience(entry, contentSection.type, editable));
  }
  section.append(body);
  return section;
}
function createIdentity(identity, editable) {
  const wrapper = document.createElement('header');
  wrapper.className = 'identity';
  const name = editable ? makeEditable(identity.name.html, 'name', '姓名', 'person-name', identity.name.align, '姓名') : textSpan(identity.name.html, identity.name.align);
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
  // 方向室视图下纸面容器是 display:none，clientHeight 为 0：此时重算会把
  // 结果判成"最小字号也放不下"并错误禁用 PDF。切回编辑器时 ResizeObserver
  // 与 setView 会自然重算，这里直接跳过。
  if (currentView !== 'editor') return;
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
  refreshExportBlock();
  updateViewScale();
  updateSortHandle();
}
// L-14：缺失字体必须明确提示，不能默默用替代字体冒充；S-04：字体缺失与
// 超页、联系冲突一样要暂停打印并说明原因。这里把两类原因合并到同一个
// 出口，避免"字号适配说能打、字体说不能打"互相覆盖。
function refreshExportBlock() {
  const reason = exportBlockedReason || fontMissingReason;
  elements.export.disabled = Boolean(reason);
  elements.export.title = reason;
}
// 只在系统里真的找不到这两个字族时才报警。document.fonts.check 对已安装的
// 系统字体返回 true；浏览器不支持 FontFaceSet 时不做判断（不误报）。
async function checkRequiredFonts() {
  if (!globalThis.document?.fonts?.check) return;
  try { await document.fonts.ready; } catch { /* 超时也继续，按当前可用字体判断 */ }
  const missing = REQUIRED_FONTS.filter((item) => {
    try { return !document.fonts.check(`12pt ${item.family}`, item.sample); } catch { return false; }
  });
  if (!missing.length) return;
  fontMissingReason = `缺少${missing.map((item) => item.role).join('、')}，PDF 会与屏幕显示不一致。请安装字体后重新加载扩展。`;
  showToast(`缺少${missing.map((item) => item.role).join('、')}，已暂停 PDF 导出；简历会先用替代字体显示。`, 'error');
  refreshExportBlock();
}
function updateViewScale() {
  // 方向室视图下纸面不可见（纸面容器尺寸为 0），此时重算会把 fitBase 打到
  // 下限 25%，顶栏缩放读数显示假值；切回编辑器时 ResizeObserver 会自然重算。
  if (currentView !== 'editor') return;
  const style = getComputedStyle(elements.paperScroller);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availableWidth = Math.max(220, elements.paperScroller.clientWidth - horizontalPadding - 8);
  const availableHeight = Math.max(220, elements.paperScroller.clientHeight - verticalPadding - 8);
  const fitBase = Math.min(availableWidth / PAPER_WIDTH_PX, availableHeight / PAPER_HEIGHT_PX, 1);
  currentFitBase = fitBase;
  const scale = fitBase * zoomFactor;
  currentPaperScale = Math.max(0.25, Math.min(2.5, scale));
  document.documentElement.style.setProperty('--paper-scale', String(currentPaperScale));
  document.documentElement.style.setProperty('--paper-width', `${PAPER_WIDTH_PX}px`);
  document.documentElement.style.setProperty('--paper-height', `${PAPER_HEIGHT_PX}px`);
  elements.paperSpace.style.width = `${PAPER_WIDTH_PX * currentPaperScale}px`;
  elements.paperSpace.style.height = `${(PAPER_HEIGHT_PX + currentOverflowPx) * currentPaperScale}px`;
  // 只显示数字不带 %：读数是"当前真实缩放比例"，不是模式名。
  // 注意不能加 hidden 守卫：输入框应用时按钮还处于隐藏态，写了看不见，
  // 但下次显示时必须是新值（否则读数会比实际缩放慢一步）。
  byId('zoom-readout').textContent = String(Math.round(currentPaperScale * 100));
  updateSortHandle();
}
// 步进按"绝对百分点"走：顶栏看到的是 50→52→54。若按 zoomFactor 的 5% 步进，
// 在 fit 基准 0.5 下每次只跳 2.5 个百分点，手感忽大忽小。
function nudgeZoom(deltaPoints) {
  const target = Math.max(0.25, Math.min(2.5, currentPaperScale + deltaPoints / 100));
  zoomFactor = Number((target / Math.max(currentFitBase, 0.01)).toFixed(4));
  updateViewScale();
}
// 点读数 → 变成可编辑数字框：回车/失焦应用，Esc 取消。
function showZoomEditor() {
  const input = byId('zoom-input');
  input.value = String(Math.round(currentPaperScale * 100));
  byId('zoom-readout').hidden = true;
  input.hidden = false;
  input.focus();
  input.select();
}
function hideZoomEditor(apply) {
  const input = byId('zoom-input');
  if (apply && !input.hidden) {
    const raw = input.value.trim().replace(/[%％\s]/g, '');
    // L-03 的"整页"：留空回车即回到按可用宽高适配。原实现对空值/非数字
    // 静默不应用，等于这个已确认的观看档位根本没有入口。
    if (!raw) { zoomFactor = 1; updateViewScale(); }
    else {
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) {
        const pct = Math.max(25, Math.min(250, n));
        zoomFactor = Number(((pct / 100) / Math.max(currentFitBase, 0.01)).toFixed(4));
        updateViewScale();
      }
    }
  }
  input.hidden = true;
  byId('zoom-readout').hidden = false;
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
// 手柄尺寸与 CSS 的 .sort-handle 保持一致（只包住鼠标图形，不带白底方框）。
const SORT_HANDLE_W = 17;
const SORT_HANDLE_H = 19;
// 手柄右缘与安全区虚线框之间的极小间隔。
const SORT_HANDLE_GAP = 3;
// 安全区（虚线框）是纸面内缩 9mm；按纸宽 210mm 换算成比例，
// 与当前缩放无关（paperRect 已经是缩放后的尺寸）。
function sortHandleLeft() {
  const paperRect = elements.paper.getBoundingClientRect();
  const safeLeft = paperRect.left + paperRect.width * (9 / 210);
  // 落在纸面左边距里、虚线框外侧，确保鼠标图形永远不压正文。
  return Math.max(2, Math.round(safeLeft - SORT_HANDLE_W - SORT_HANDLE_GAP));
}
function sortHandleTop(rect) {
  const centered = rect.top + (rect.height - SORT_HANDLE_H) / 2;
  return Math.max(2, Math.min(window.innerHeight - SORT_HANDLE_H - 2, centered));
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
  if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) { handle.hidden = true; return; }
  handle.style.left = `${sortHandleLeft()}px`;
  handle.style.top = `${sortHandleTop(rect)}px`;
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
  // 新建经历时自动带一条空要点（带"要点"占位），不用再手动起头。
  const item = { id: uid(`${sectionType}-entry`), columns: [{ html: '' }, { html: '' }, { html: '' }], bullets: [{ id: uid(`${sectionType}-bullet`), html: '' }] };
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
// 只有正文要点和条目三栏支持对齐：姓名/联系方式/分区标题/链接在纸面上由版面
// 固定居中（L-11/L-13），text-align 对 inline-flex / inline 元素不产生任何
// 视觉效果。这些字段上照单全收只会往数据里写一个永不生效的 align，
// 看起来像"按了快捷键却没反应"，因此明确告知而不静默吞掉。
const ALIGNABLE_KINDS = new Set(['bullet', 'column']);
function setFieldAlignment(element, alignment) {
  const value = pathToValue(element.dataset.edit);
  if (!ALIGNABLE_KINDS.has(element.dataset.edit.split('|')[0])) {
    showToast('姓名、联系方式、分区标题与链接按版面固定居中，不支持对齐调整。');
    return;
  }
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
  // 输入法组字期间（isComposing）按 Enter 是"确认候选字"，不是"结束编辑"。
  // 这时若走下面的 Enter 分支，会 blur/插要点把组字宿主连锅端掉，整段候选
  // 丢失（违反 E-04：组字期间不丢字）。候选确认由 compositionend 收尾。
  if (event.isComposing) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    if (event.shiftKey) {
      // E-02：Shift+Enter 只在正文要点内换行；分区标题、教育三栏、工作/项目
      // 三栏、姓名、联系方式与链接一律"不插入换行且不执行额外操作"——
      // 既不新建经历也不 blur。
      if (kind === 'bullet') document.execCommand('insertLineBreak');
      return;
    }
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
  if (event.metaKey && event.key.toLowerCase() === 'b') {
    // E-01 只允许"正文选区可加粗"；L-10 又要求条目标题/日期固定字重。
    // 其余字段（分区标题、三栏、姓名、联系方式、链接）一律抑制原生加粗：
    // styleWithCSS=false 下 Chrome 会插入 <b> 并原样落库，把不允许加粗的
    // 字段污染成带标记的数据（且日期栏还被 CSS 强制 400，视觉上根本看不出来）。
    event.preventDefault();
    if (kind !== 'bullet') return;
    document.execCommand('bold'); updateContentFromElement(element); normalizeFieldRuns(element); scheduleFit(); scheduleSave();
  }
}
// 把 text/html 转成纯文本：块级元素的边界变成换行，实体由 DOM 自动解码
// （正则版会把 &amp; 原样留下，粘出去就是字面量 "&amp;"）。行首/行尾不补
// 额外空行，避免"粘两段变三条要点（含一条空）"。
function htmlToPlainText(html) {
  const source = document.createElement('template');
  source.innerHTML = String(html || '');
  const BLOCK_TAGS = new Set(['p', 'div', 'li', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'section', 'article', 'blockquote', 'pre']);
  const lines = [];
  let current = '';
  const flush = () => { lines.push(current); current = ''; };
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) { current += node.nodeValue || ''; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') { flush(); return; }
    const block = BLOCK_TAGS.has(tag);
    if (block && current) flush();
    Array.from(node.childNodes).forEach(walk);
    if (block) flush();
  };
  Array.from(source.content.childNodes).forEach(walk);
  flush();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}
function onPaste(event) {
  const element = event.target.closest('[data-edit]');
  if (!element || !elements.paperContent.contains(element)) return;
  event.preventDefault();
  const html = event.clipboardData.getData('text/html');
  // E-03：只粘文字。text/plain 拿不到时（少数网页不提供）才从 text/html 提文字。
  const raw = event.clipboardData.getData('text/plain') || (html ? htmlToPlainText(html) : '');
  const parts = element.dataset.edit.split('|');
  if (parts[0] === 'bullet') {
    const lines = raw.replace(/\r/g, '').split('\n');
    // 剪贴板末尾的换行（复制时多带了一个 \n）会凭空多建一条空要点，
    // 尾部空行一律剥掉。
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
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
// 取消组字（候选框按 Esc / 焦点被移走 / 输入目标变更）不会派发 compositionend。
// 不在这里收尾，composing 会永久卡在 true：onInput 从此直接 return，
// 用户之后打的每一个字都不落盘，关掉侧边栏即全部丢失。
function onCompositionCancel(event) {
  composing = false;
  const element = event.target.closest('[data-edit]');
  if (element) { updateContentFromElement(element); normalizeFieldRuns(element); scheduleFit(); scheduleSave(); }
}
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
    const rect = item.getBoundingClientRect();
    // 拖动期：被拖条目自己变成"空位框"（内容隐藏、保留占位不脱离布局），
    // 其余条目围着这个框实时重排——指针指向的那一行会"让位"下移，空位框停
    // 在它的位置上。于是要替代的是哪一行一眼可见，不必再猜 2px 指示线。
    item.classList.add('drag-source');
    const ghost = item.cloneNode(true);
    ghost.classList.remove('drag-source', 'selected', 'dragging');
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.margin = '0';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.append(ghost);
    dragState = {
      item, list, section: item.dataset.section, kind: item.dataset.sortKind, moved: false,
      pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
      width: rect.width, height: rect.height, ghost, rafId: 0, lastX: event.clientX, lastY: event.clientY,
      // 起拖时的顺序：落点没变就不记撤销、不落盘。
      originalIds: Array.from(list.querySelectorAll(':scope > .sortable')).map((el) => el.dataset.itemId),
    };
    elements.sortHandle.classList.add('is-dragging');
    try { elements.sortHandle.setPointerCapture(event.pointerId); } catch {}
    // 起手立刻排一次：手柄在行左侧，指针 Y 可能落在上一行，先校正位置。
    moveDraggedToTarget(event.clientY);
    followHandleToFrame();
  });
  document.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    dragState.lastX = event.clientX; dragState.lastY = event.clientY;
    // rAF 节流：每帧最多重算一次 ghost 与落点，避免高刷屏上一帧多次重排。
    if (dragState.rafId) return;
    dragState.rafId = requestAnimationFrame(() => {
      dragState.rafId = 0;
      if (!dragState) return;
      dragState.ghost.style.left = `${dragState.lastX - dragState.offsetX}px`;
      dragState.ghost.style.top = `${dragState.lastY - dragState.offsetY}px`;
      // 真实搬动空位框：被指向的行当场"让位"，其余行依次让开。
      moveDraggedToTarget(dragState.lastY);
      followHandleToFrame();
    });
  });
  document.addEventListener('pointerup', finishDrag); document.addEventListener('pointercancel', finishDrag);
  // 悬停即显示手柄：Mac 三指拖动是直接手势，不要求先点进字段聚焦。
  // 这样即便未聚焦，鼠标/触控移到某行时手柄也会在该行左侧出现，可直接起拖。
  elements.paperContent.addEventListener('mouseover', (event) => {
    const item = event.target.closest('.sortable');
    if (item !== sortHover) { sortHover = item; updateSortHandle(); }
  });
  elements.paperContent.addEventListener('mouseout', (event) => {
    if (!sortHover) return;
    const to = event.relatedTarget;
    // 指针移向手柄不算离开：手柄是 body 级的 fixed 元素、不在 paperContent 内，
    // 不这么判的话"悬停显示→移过去按"会形成死循环——手柄永远点不到。
    if (to && (to === elements.sortHandle || elements.sortHandle.contains(to))) return;
    if (!to?.closest?.('.sortable')) { sortHover = null; updateSortHandle(); }
  });
  // 指针离开手柄（且没回到另一行）时收手柄，避免它常驻挡住纸面。
  elements.sortHandle.addEventListener('mouseleave', () => {
    if (dragState) return;
    if (sortHover) { sortHover = null; updateSortHandle(); }
  });
}
// 同列表里紧跟在该元素之后的第一个可排项（跳过非可排的兄弟节点）。
function nextSortableAfter(element) {
  let node = element.nextElementSibling;
  while (node && !node.classList.contains('sortable')) node = node.nextElementSibling;
  return node;
}
// 落点计算与真实搬动：指针落在某一行上半部 → 插到它之前（那一行"让位"下移，
// 空位框停在它的位置）；落在下半部 → 落到它之后；越过末行 → 排到末尾。
// 被拖条目本身就在流里（它变成了空位框），所以其它行会实时围着它重排，
// 用户看到的就是"哪一行让开了、哪一格空着"。
function moveDraggedToTarget(clientY) {
  const { item, list } = dragState;
  const siblings = Array.from(list.children).filter((el) => el !== item && el.classList.contains('sortable'));
  let before = null;
  for (const sibling of siblings) {
    const rect = sibling.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) { before = sibling; break; }
  }
  const next = nextSortableAfter(item);
  // 位置没变就不搬：一次 insertBefore 会触发整列表重排，没必要就别动。
  if (before ? next === before : next === null) return;
  dragState.moved = true;
  if (before) list.insertBefore(item, before);
  else list.append(item);
}
// 拖动中手柄跟着空位框走，否则手柄留在原地、和真正要落的位置脱节。
function followHandleToFrame() {
  if (!dragState) return;
  const handle = elements.sortHandle;
  const rect = dragState.item.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  handle.hidden = false;
  handle.style.left = `${sortHandleLeft()}px`;
  handle.style.top = `${sortHandleTop(rect)}px`;
}
function finishDrag() {
  if (!dragState) return;
  const state = dragState; dragState = null;
  elements.sortHandle.classList.remove('is-dragging');
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.item.classList.remove('drag-source', 'dragging');
  state.ghost?.remove();
  // 落点是否真的变化：与起拖时的顺序对比，没变就不记撤销、不重排、不落盘。
  const ids = Array.from(state.list.querySelectorAll(':scope > .sortable')).map((item) => item.dataset.itemId);
  const changed = ids.length !== state.originalIds.length || ids.some((id, index) => id !== state.originalIds[index]);
  if (!changed) { updateSortHandle(); return; }
  pushUndo(true);
  // DOM 顺序在拖动期就已经是最终顺序，这里只把数据对齐到 DOM（不重建纸面）。
  if (state.kind === 'experience') {
    const section = draft.sections.find((item) => item.type === state.section);
    if (!section?.entries) { scheduleFit(); scheduleSave(); return; }
    const map = new Map(section.entries.map((item) => [item.id, item]));
    section.entries = ids.map((id) => map.get(id)).filter(Boolean);
  } else {
    // 列表定位不到时安全退出：DOM 顺序已经变了，但草稿不乱写，
    // 重新渲染回到数据里的顺序即可（避免对 null 调用 splice 崩溃）。
    const list = findBulletList(state.section, ids[0]);
    if (!list) { scheduleFit(); scheduleSave(); return; }
    const map = new Map(list.map((item) => [item.id, item]));
    const sorted = ids.map((id) => map.get(id)).filter(Boolean); list.splice(0, list.length, ...sorted);
  }
  // 不再 renderPaper()：拖动已通过 insertBefore 把真实 DOM 排好顺序，
  // 重建整页反而带来一次性大开销（销毁+重建全部 contenteditable）且让界面闪一下。
  // 只重新适配字号（scheduleFit）并防抖持久化（scheduleSave）。
  scheduleFit(); scheduleSave();
}
function setView(view) {
  currentView = view;
  elements.editor.classList.toggle('hidden', view !== 'editor');
  elements.directionView.classList.toggle('hidden', view !== 'directions');
  if (view !== 'editor') elements.sortHandle.hidden = true;
  if (view === 'directions') { renderDirections(); setTimeout(() => elements.directionSearch.focus(), 40); }
  else { updateSortHandle(); scheduleFit(); }
}
function renderDirections() {
  const query = elements.directionSearch.value.trim().toLowerCase();
  // S-07：方向室按最近编辑时间倒序。搜索只过滤、不改变相对顺序。
  const ordered = [...storeState.directions].sort((a, b) => directionSortKey(b) - directionSortKey(a));
  const directions = ordered.filter((direction) => !query || direction.name.toLowerCase().includes(query));
  elements.directionGrid.replaceChildren(...directions.map(renderDirectionCard));
  updateCardScales();
}
function directionSortKey(direction) {
  const raw = direction?.currentDraft?.updatedAt || direction?.createdAt || 0;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? 0 : time;
}
function renderDirectionCard(direction) {
  const article = document.createElement('article'); article.className = 'library-card direction-card'; article.dataset.directionId = direction.id;
  article.dataset.current = String(direction.id === activeDirection?.id);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const info = document.createElement('div'); info.className = 'card-info';
  const title = document.createElement('button'); title.type = 'button'; title.className = 'card-name'; title.textContent = direction.name; title.dataset.renameDirection = direction.id; title.title = '点击修改方向名称'; title.setAttribute('aria-label', `点击修改方向名称：${direction.name}`); info.append(title);
  const time = document.createElement('time'); time.className = 'card-time'; time.dateTime = direction.currentDraft.updatedAt || ''; time.textContent = fmtMinute(direction.currentDraft.updatedAt); info.append(time);
  meta.append(info);
  const actions = document.createElement('div'); actions.className = 'card-actions';
  const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.dataset.deleteDirection = direction.id; deleteButton.setAttribute('aria-label', '删除方向'); deleteButton.title = '删除方向'; deleteButton.textContent = '🗑️'; actions.append(deleteButton); meta.append(actions); article.append(meta);
  const frame = document.createElement('div'); frame.className = 'card-paper-frame'; frame.dataset.openDirection = direction.id; frame.setAttribute('role', 'button'); frame.setAttribute('tabindex', '0'); frame.setAttribute('aria-label', `打开${direction.name}`);
  const mini = document.createElement('div'); mini.className = 'card-paper'; mini.style.setProperty('--body-size', `${Number(direction.currentDraft.layout?.bodyPt || 10.5).toFixed(2)}pt`); const inner = document.createElement('div'); inner.className = 'paper-content'; buildPaperContent(inner, direction.currentDraft.content, false); mini.append(inner); frame.append(mini); article.append(frame); return article;
}
function updateCardScales() {
  if (currentView !== 'directions') return;
  elements.directionGrid.querySelectorAll('.card-paper-frame').forEach((frame) => {
    const mini = frame.querySelector('.card-paper');
    if (!mini) return;
    const scale = frame.clientWidth / PAPER_WIDTH_PX;
    mini.style.setProperty('--card-scale', String(scale));
    // S-07：缩略图至少显示完整 A4；超页正文则按实际内容向下延展，不裁切。
    // 用 offsetHeight（布局像素）而不是 getBoundingClientRect：后者被
    // transform:scale 缩过，量出来的是缩放后的视觉高度。
    const flow = mini.querySelector('.resume-flow');
    if (!flow) return;
    const paperPaddingPx = 2 * (9 / 25.4) * 96; // 上下各 9mm
    const naturalHeight = Math.max(PAPER_HEIGHT_PX, paperPaddingPx + flow.offsetHeight + 2);
    mini.style.height = `${naturalHeight.toFixed(2)}px`;
    frame.style.aspectRatio = 'auto';
    frame.style.height = `${(naturalHeight * scale).toFixed(2)}px`;
  });
}
async function openDirection(id) {
  const direction = findDirection(id); if (!direction) return;
  if (activeDirection?.id !== id && !(await saveNow())) return;
  resetEditorState(direction); renderPaper(); setView('editor'); scheduleFit(); await persistStore();}
function toggleDirections() { setView(currentView === 'directions' ? 'editor' : 'directions'); }
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
  // “示例模板”就是毛坯房：预填一份虚构示例（林舟），一来就有内容可改、
  // Enter 也能续加，而不是给你一个啥都没有、加不了的空壳。
  const sampleOption = document.createElement('option');
  sampleOption.value = '__sample__';
  sampleOption.textContent = '示例模板（带示例内容 · 毛坯房）';
  elements.directionTemplate.replaceChildren(sampleOption, ...storeState.directions.map((direction) => { const option = document.createElement('option'); option.value = direction.id; option.textContent = direction.name; return option; }));
  if (activeDirection) elements.directionTemplate.value = activeDirection.id;
  openDialog(elements.directionDialog); elements.directionName.focus();
}
async function createDirection() {
  const name = elements.directionName.value.trim();
  const templateValue = elements.directionTemplate.value;
  const useSample = templateValue === '__sample__';
  const template = useSample ? null : (findDirection(templateValue) || activeDirection);
  if (!name || (!useSample && !template)) return;
  if (!(await saveNow())) return;
  const content = useSample ? createSampleResumeContent() : template.currentDraft.content;
  const layout = useSample ? DEFAULT_LAYOUT : template.currentDraft.layout;
  const direction = makeDirection(name, content, layout);
  storeState.directions.push(direction); resetEditorState(direction); await persistStore();
  elements.directionDialog.close('created'); renderPaper(); setView('editor'); scheduleFit();}
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
  // PDF 是编辑器主动作。方向室视图下纸面是隐藏的（容器尺寸为 0）：此时测量
  // 只会得到垃圾结果，打印快照也会带上完全错误的布局，而用户看到的其实是
  // 方向室某张卡片、根本不是将要打印的那一页。先回到编辑页让用户确认内容，
  // 再点一次 PDF 才真正打印。
  if (currentView !== 'editor') {
    setView('editor');
    showToast('已返回编辑页，请再次点击 PDF 打印当前方向。');
    return;
  }
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
  // 空列表补充入口是编辑态控件，与 safe-zone/boundary 一样不进打印快照。
  paper.querySelectorAll('.safe-zone,.boundary,.empty-section-hint').forEach((element) => element.remove());
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
  elements.paperContent.addEventListener('compositioncancel', onCompositionCancel);
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
  // 取消按钮是 type="button"（不做表单默认按钮），否则含单文本输入框的表单
  // 会按 WHATWG 隐式提交规则把第一个提交按钮当成 Enter 默认按钮——而取消键
  // 排在确认键前面，于是回车等于"取消"（#10）。type="button" 后需自行关弹窗。
  for (const dialog of [elements.directionDialog, elements.renameDialog, elements.confirmDialog]) {
    const cancel = dialog.querySelector('[value="cancel"]');
    if (cancel) cancel.addEventListener('click', () => dialog.close('cancel'));
  }
  byId('zoom-out').addEventListener('click', () => nudgeZoom(-2));
  byId('zoom-in').addEventListener('click', () => nudgeZoom(2));
  byId('zoom-readout').addEventListener('click', showZoomEditor);
  byId('zoom-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); hideZoomEditor(true); }
    else if (event.key === 'Escape') { event.preventDefault(); hideZoomEditor(false); }
  });
  byId('zoom-input').addEventListener('blur', () => hideZoomEditor(true));
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
    if ((event.metaKey || event.ctrlKey) && key === 'f' && !elements.directionDialog.open && !elements.renameDialog.open && !elements.confirmDialog.open) { event.preventDefault(); toggleDirections(); return; }
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
  checkRequiredFonts();
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
