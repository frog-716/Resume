import { fitResumeLayout } from '/domain/auto-layout.mjs';
import { createEmptyResumeContent, validateResumeContent } from '/domain/resume-content.mjs';
import { runsHtml, applyRunsToElement, normalizeFieldRuns } from '/text-runs.mjs';

const byId = (id) => document.getElementById(id);
const elements = {
  app: byId('app'), title: byId('resume-title'), saveStatus: byId('save-status'),
  editor: byId('editor-view'), paperScroller: byId('paper-scroller'), paperSpace: byId('paper-space'),
  paper: byId('resume-paper'), paperContent: byId('paper-content'),
  library: byId('library-view'), trash: byId('trash-view'), libraryGrid: byId('library-grid'),
  trashGrid: byId('trash-grid'), librarySearch: byId('library-search'), trashSearch: byId('trash-search'),
  trashEmpty: byId('trash-empty'), snapshotDialog: byId('snapshot-dialog'), snapshotForm: byId('snapshot-form'),
  snapshotName: byId('snapshot-name'), confirmDialog: byId('confirm-dialog'), confirmForm: byId('confirm-form'),
  confirmTitle: byId('confirm-title'), confirmMessage: byId('confirm-message'), confirmAction: byId('confirm-action'),
  toast: byId('toast'), export: byId('export-pdf'),
};

const PAPER_WIDTH_PX = 793.7;
const PAPER_HEIGHT_PX = 1122.5;
const SECTION_LABELS = { skills: '专业技能', work: '工作经历', projects: '项目经历', education: '教育背景' };
const ICONS = {
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z',
  email: 'M3 5.5h18v13H3z M3.5 6.2 12 12.5l8.5-6.3',
  wechat: 'M8.5 6.2c-3.1 0-5.7 2-5.7 4.6 0 1.5.8 2.8 2.2 3.7l-.6 2 2.3-1.2c.6.2 1.2.3 1.8.3h.5c-.1-.4-.2-.8-.2-1.2 0-2.7 2.7-4.9 6-4.9h.5c-.2-1.9-2.3-3.3-4.8-3.3H8.5Zm6.6 4.7c-2.5 0-4.6 1.5-4.6 3.4s2.1 3.4 4.6 3.4c.5 0 1-.1 1.5-.2l1.8.9-.5-1.5c1.1-.6 1.8-1.5 1.8-2.6 0-1.9-2.1-3.4-4.6-3.4Z',
  website: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
  github: '<svg class="github-cat" role="img" aria-label="GitHub" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="xMidYMid meet"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9 7V4.8h6V7m-8.4 0 1 13h8.8l1-13M10 10.2v6.8m4-6.8v6.8"/></svg>',
  restore: '<svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1.5 7M4 5v5h5"/><path d="M12 8v4l2.5 1.5"/></svg>',
  permanent: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9 7V4.8h6V7m-8.4 0 1 13h8.8l1-13M10 10.2v6.8m4-6.8v6.8"/></svg>',
};

/** Contact icons match the V34 prototype: stroked 24px glyphs, GitHub uses the inline cat mark. */
function contactIconSvg(kind, label) {
  return '<svg viewBox="0 0 24 24" role="img" aria-label="' + label + '"><path d="' + ICONS[kind] + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + (kind === 'wechat' ? ' transform="translate(-2.4 -2.4) scale(1.2)"' : '') + '></path></svg>';
}

let libraryState = null;
let activeResume = null;
let draft = null;
let layout = null;
let currentView = 'editor';
let viewMode = 'fit';
let showGuide = true;
let saveTimer = null;
let savePromise = null;
let draftRevision = 0;
let savedRevision = 0;
let fitFrame = 0;
let toastTimer = null;
let composing = false;
let lastEditElement = null;
let undoStack = [];
let undoLastAt = 0;
let undoInProgress = false;
let dragState = null;
let exportBlockedReason = '';
let currentPaperScale = 1;
let currentOverflowPx = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uid(prefix) { return (prefix || 'item') + '-' + crypto.randomUUID(); }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
      for (const child of node.childNodes) copyNode(child, safe);
      parent.append(safe);
      return;
    }
    for (const child of node.childNodes) copyNode(child, parent);
  }
  for (const node of source.content.childNodes) copyNode(node, out.content);
  return out.innerHTML;
}
function plainTextFromHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = safeFragment(html);
  return tmp.innerText || tmp.textContent || '';
}
function setStatus(text, state) {
  elements.saveStatus.textContent = text;
  elements.saveStatus.dataset.state = state || '';
}
function api(path, options) {
  const init = options || {};
  init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
  return fetch('/api' + path, init).then(async (response) => {
    let body;
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) throw new Error(body.error || body.message || '本机操作失败（' + response.status + '）。');
    return body;
  });
}
function showToast(message, kind, retry) {
  clearTimeout(toastTimer);
  elements.toast.replaceChildren();
  elements.toast.dataset.kind = kind || '';
  const text = document.createElement('span');
  text.textContent = message;
  elements.toast.append(text);
  if (typeof retry === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-retry';
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
function saveDraftSoon() {
  if (!activeResume || !draft) return;
  draftRevision += 1;
  clearTimeout(saveTimer);
  setStatus('正在保存…', 'saving');
  saveTimer = setTimeout(saveDraftNow, 420);
}
async function saveDraftNow() {
  if (!activeResume || !draft) return false;
  clearTimeout(saveTimer);
  saveTimer = null;
  if (savePromise) {
    if (savedRevision < draftRevision) setStatus('正在保存…', 'saving');
    const saved = await savePromise;
    if (!saved) return false;
    if (savedRevision < draftRevision) return saveDraftNow();
    return true;
  }
  const resumeId = activeResume.id;
  const revision = draftRevision;
  const content = clone(draft);
  const currentLayout = clone(layout);
  setStatus('正在保存…', 'saving');
  savePromise = (async () => {
    try {
      const result = await api('/resumes/' + encodeURIComponent(resumeId) + '/draft', {
        method: 'PUT', body: JSON.stringify({ content, layout: currentLayout }),
      });
      if (activeResume && activeResume.id === resumeId) {
        activeResume.currentDraft = result.currentDraft || result;
        if (libraryState) {
          const found = libraryState.resumes.find((item) => item.id === resumeId);
          if (found) found.currentDraft = clone(activeResume.currentDraft);
        }
      }
      savedRevision = Math.max(savedRevision, revision);
      setStatus('已保存', 'saved');
      return true;
    } catch (error) {
      setStatus('保存失败', 'error');
      elements.saveStatus.title = error.message;
      showToast('这次没存成功。内容还在页面里。原因：' + error.message, 'error', () => saveDraftNow());
      return false;
    }
  })();
  const saved = await savePromise;
  savePromise = null;
  if (!saved) return false;
  if (savedRevision < draftRevision) return saveDraftNow();
  return true;
}
function resetDraftSaveTracking() {
  clearTimeout(saveTimer);
  saveTimer = null;
  draftRevision = 0;
  savedRevision = 0;
  savePromise = null;
}
function pushUndo(force) {
  const now = Date.now();
  if (!force && now - undoLastAt < 850) { undoLastAt = now; return; }
  undoStack.push({ kind: 'draft', resumeId: activeResume && activeResume.id, content: clone(draft), layout: clone(layout), resumeName: activeResume ? activeResume.name : '' });
  if (undoStack.length > 180) undoStack.shift();
  undoLastAt = now;
}
function pushUndoRecord(record) {
  undoStack.push(record);
  if (undoStack.length > 180) undoStack.shift();
  undoLastAt = 0;
}
async function undo() {
  if (undoInProgress) return;
  undoInProgress = true;
  try { return await performUndo(); }
  finally { undoInProgress = false; }
}
async function performUndo() {
  if (!undoStack.length) return;
  const state = undoStack[undoStack.length - 1];
  if (state.kind === 'snapshot-name') {
    try {
      const result = await api('/snapshots/' + encodeURIComponent(state.snapshotId), { method: 'PATCH', body: JSON.stringify({ name: state.previousName }) });
      undoStack.pop();
      await refreshLibraryState();
      renderLibrary();
      showToast('已撤销快照改名。', 'success');
      return result;
    } catch (error) {
      showToast('撤销快照改名失败。原因：' + error.message, 'error');
      return;
    }
  }
  if (state.kind === 'resume-created') {
    if (!activeResume || activeResume.id !== state.resumeId || !await saveDraftNow()) return;
    try {
      const createdResponse = await api('/resumes/' + encodeURIComponent(state.resumeId));
      const createdResume = createdResponse.resume || createdResponse;
      if (createdResume.snapshots.length) {
        showToast('这份简历已经有快照，不能用撤销把它删除。', 'error');
        return;
      }
      await api('/resumes/' + encodeURIComponent(state.resumeId), {
        method: 'DELETE',
        body: JSON.stringify({
          previousResumeId: state.previousResumeId,
          expectedDraft: { content: state.expectedDraft.content, layout: state.expectedDraft.layout },
        }),
      });
      const previousResponse = await api('/resumes/' + encodeURIComponent(state.previousResumeId));
      activeResume = previousResponse.resume || previousResponse;
      await api('/last-opened', { method: 'PUT', body: JSON.stringify({ resumeId: activeResume.id }) });
      undoStack = [];
      undoLastAt = 0;
      resetDraftSaveTracking();
      draft = clone(activeResume.currentDraft.content);
      layout = clone(activeResume.currentDraft.layout);
      await refreshLibraryState();
      renderPaper();
      setView('editor');
      scheduleFit();
      showToast('已撤销新建简历，回到上一份简历。', 'success');
    } catch (error) {
      showToast('撤销新建简历失败。原因：' + error.message, 'error');
    }
    return;
  }
  if (state.kind !== 'draft' || !activeResume || state.resumeId !== activeResume.id) return;
  const previousName = activeResume.name;
  if (previousName !== state.resumeName) {
    try {
      await api('/resumes/' + encodeURIComponent(activeResume.id), {
        method: 'PATCH', body: JSON.stringify({ name: state.resumeName }),
      });
      if (libraryState) {
        const resume = libraryState.resumes.find((item) => item.id === activeResume.id);
        if (resume) resume.name = state.resumeName;
      }
    } catch (error) {
      showToast('撤销改名没有保存。原因：' + error.message, 'error');
      return;
    }
  }
  undoStack.pop();
  undoLastAt = 0;
  draft = state.content;
  layout = state.layout;
  activeResume.name = state.resumeName;
  elements.title.textContent = activeResume.name;
  renderPaper();
  scheduleFit();
  saveDraftSoon();
  setStatus('已撤销，正在保存…', 'saving');
}

function makeEditable(html, editKey, label, extraClass, align, placeholder) {
  const span = document.createElement('span');
  span.className = extraClass || '';
  span.innerHTML = safeFragment(html);
  if (align) span.style.textAlign = align;
  if (placeholder) span.setAttribute('data-placeholder', placeholder);
  span.setAttribute('contenteditable', 'true');
  span.setAttribute('spellcheck', 'false');
  span.setAttribute('data-edit', editKey);
  span.setAttribute('aria-label', label || '简历文字');
  applyRunsToElement(span);
  return span;
}
const COLUMN_PLACEHOLDERS = ['单位 / 项目', '岗位 / 职责', '日期'];
function createBullet(item, sectionType, editable) {
  const li = document.createElement('li');
  li.className = 'bullet sortable';
  li.dataset.itemId = item.id;
  li.dataset.sortKind = 'bullet';
  li.dataset.section = sectionType;
  if (item.align) li.style.textAlign = item.align;
  if (editable) {
    li.append(makeEditable(item.html, 'bullet|' + sectionType + '|' + item.id, '要点', '', item.align, '要点'));
  } else {
    const span = document.createElement('span');
    span.innerHTML = safeFragment(item.html);
    applyRunsToElement(span);
    li.append(span);
  }
  return li;
}
function createBulletList(items, sectionType, editable) {
  const ul = document.createElement('ul');
  ul.className = 'bullet-list';
  for (const item of items || []) ul.append(createBullet(item, sectionType, editable));
  return ul;
}
function createSection(contentSection, editable, isFirst) {
  const section = document.createElement('section');
  section.className = 'resume-section' + (isFirst ? ' first-section' : '');
  section.dataset.type = contentSection.type;
  const heading = document.createElement('h2');
  heading.className = 'section-heading';
  const label = editable
    ? makeEditable(contentSection.title.html, 'title|' + contentSection.type, '分区标题', 'section-label', contentSection.title.align)
    : document.createElement('span');
  if (!editable) { label.className = 'section-label'; label.innerHTML = safeFragment(contentSection.title.html); applyRunsToElement(label); label.style.textAlign = contentSection.title.align || ''; }
  heading.append(label);
  section.append(heading);
  const body = document.createElement('div');
  body.className = 'section-body';
  if (contentSection.type === 'skills') {
    body.append(createBulletList(contentSection.bullets, 'skills', editable));
  } else if (contentSection.type === 'education') {
    const row = document.createElement('div');
    row.className = 'experience-head education-head';
    contentSection.columns.forEach((column, index) => {
      if (editable) row.append(makeEditable(column.html, 'column|education||' + index, '教育信息第' + (index + 1) + '栏', 'entry-field', column.align));
      else {
        const field = document.createElement('span');
        field.className = 'entry-field';
        field.innerHTML = safeFragment(column.html);
        applyRunsToElement(field);
        field.style.textAlign = column.align || '';
        row.append(field);
      }
    });
    body.append(row);
    body.append(createBulletList(contentSection.bullets, 'education', editable));
  } else {
    for (const entry of contentSection.entries || []) body.append(createExperience(entry, contentSection.type, editable));
  }
  section.append(body);
  return section;
}
function createExperience(entry, sectionType, editable) {
  const block = document.createElement('article');
  block.className = 'experience sortable' + (entry.bullets && entry.bullets.length ? ' has-bullets' : '');
  block.dataset.itemId = entry.id;
  block.dataset.sortKind = 'experience';
  block.dataset.section = sectionType;
  const head = document.createElement('div');
  head.className = 'experience-head' + (sectionType === 'education' ? ' education-head' : '');
  entry.columns.forEach((column, index) => {
    const placeholder = sectionType === 'education' ? '' : COLUMN_PLACEHOLDERS[index];
    if (editable) head.append(makeEditable(column.html, 'column|' + sectionType + '|' + entry.id + '|' + index, '条目第' + (index + 1) + '栏', 'entry-field', column.align, placeholder));
    else {
      const field = document.createElement('span');
      field.className = 'entry-field';
      field.innerHTML = safeFragment(column.html);
      applyRunsToElement(field);
      field.style.textAlign = column.align || '';
      head.append(field);
    }
  });
  block.append(head);
  if (sectionType !== 'education') block.append(createBulletList(entry.bullets, sectionType, editable));
  return block;
}
function createIdentity(identity, editable) {
  const wrapper = document.createElement('header');
  wrapper.className = 'identity';
  const name = editable
    ? makeEditable(identity.name.html, 'name', '姓名', 'person-name', identity.name.align)
    : document.createElement('div');
  if (!editable) { name.className = 'person-name'; name.innerHTML = safeFragment(identity.name.html); applyRunsToElement(name); name.style.textAlign = identity.name.align || ''; }
  wrapper.append(name);
  const row = document.createElement('div');
  row.className = 'contact-row';
  const values = [
    ['phone', '电话', identity.contacts.phone.html],
    ['email', '邮箱', identity.contacts.email.html],
    ['wechat', '微信', identity.contacts.wechat.html],
  ];
  values.forEach((item, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'contact-separator';
      separator.textContent = '｜';
      row.append(separator);
    }
    const part = document.createElement('span');
    part.className = 'contact-item';
    const icon = document.createElement('span');
    icon.className = 'contact-icon';
    icon.innerHTML = contactIconSvg(item[0], item[1]);
    part.append(icon);
    const contactValue = identity.contacts[item[0]];
    part.append(editable
      ? makeEditable(item[2], 'contact|' + item[0], item[1], '', contactValue.align)
      : textSpan(item[2], contactValue.align));
    row.append(part);
  });
  wrapper.append(row);
  const linksRow = document.createElement('div');
  linksRow.className = 'contact-row contact-links';
  const present = [];
  const links = identity.links || {};
  if (links.github) present.push(['github', links.github]);
  if (links.personalWebsite) present.push(['personalWebsite', links.personalWebsite]);
  present.forEach((tuple, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'contact-separator';
      separator.textContent = '｜';
      linksRow.append(separator);
    }
    const type = tuple[0];
    const link = tuple[1];
    const item = document.createElement('span');
    item.className = 'link-item';
    const icon = document.createElement('span');
    if (type === 'github') { icon.className = 'github-icon'; icon.innerHTML = ICONS.github; }
    else { icon.className = 'contact-icon'; icon.innerHTML = contactIconSvg('website', '个人网站'); }
    item.append(icon);
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.style.textAlign = link.align || '';
    anchor.innerHTML = runsHtml(link.href);
    if (editable) {
      anchor.setAttribute('data-edit', type === 'github' ? 'githubHref' : 'websiteHref');
      anchor.setAttribute('contenteditable', 'true');
      anchor.setAttribute('spellcheck', 'false');
      anchor.setAttribute('aria-label', type === 'github' ? 'GitHub 链接' : '个人网页链接');
    }
    item.append(anchor);
    linksRow.append(item);
  });
  if (linksRow.childNodes.length) wrapper.append(linksRow);
  if (editable) {
    const menu = document.createElement('div');
    menu.className = 'contact-add-menu';
    menu.setAttribute('aria-label', '添加可选联系方式');
    for (const type of ['github', 'personalWebsite']) {
      if (links[type]) continue;
      const add = document.createElement('button');
      add.type = 'button';
      add.dataset.addLink = type;
      add.textContent = type === 'github' ? '＋ GitHub' : '＋ 个人网页';
      menu.append(add);
    }
    if (menu.childNodes.length) wrapper.append(menu);
  }
  return wrapper;
}
function textSpan(value, align) {
  const span = document.createElement('span');
  span.innerHTML = safeFragment(value);
  applyRunsToElement(span);
  span.style.textAlign = align || '';
  return span;
}
function buildPaperContent(target, content, editable) {
  const flow = document.createElement('div');
  flow.className = 'resume-flow';
  flow.append(createIdentity(content.identity, editable));
  content.sections.forEach((section, index) => flow.append(createSection(section, editable, index === 0)));
  target.replaceChildren(flow);
}
function renderPaper() {
  if (!draft) return;
  elements.title.textContent = activeResume ? activeResume.name : '';
  buildPaperContent(elements.paperContent, draft, true);
  elements.paper.classList.toggle('guide-on', showGuide);
  updateCurrentSortSelection();
}
function pathToValue(key) {
  const [kind, a, b, c] = key.split('|');
  if (kind === 'name') return draft.identity.name;
  if (kind === 'contact') return draft.identity.contacts[a];
  if (kind === 'title') return draft.sections.find((section) => section.type === a).title;
  if (kind === 'bullet') {
    if (a === 'skills') return draft.sections[0].bullets.find((bullet) => bullet.id === b);
    if (a === 'education') return draft.sections.find((item) => item.type === 'education').bullets.find((bullet) => bullet.id === b);
    const section = draft.sections.find((item) => item.type === a);
    const entry = section && section.entries.find((item) => item.id === b);
    return entry && entry.bullets.find((bullet) => bullet.id === c);
  }
  if (kind === 'column' && a === 'education') return draft.sections.find((item) => item.type === 'education').columns[Number(c)];
  if (kind === 'column') {
    const section = draft.sections.find((item) => item.type === a);
    const entry = section && section.entries.find((item) => item.id === b);
    return entry && entry.columns[Number(c)];
  }
  return null;
}
function updateContentFromElement(element) {
  const key = element.dataset.edit;
  if (!key) return;
  if (key === 'githubHref' || key === 'websiteHref') {
    const type = key === 'githubHref' ? 'github' : 'personalWebsite';
    const link = draft.identity.links[type];
    if (link) {
      link.href = (element.innerText || '').trim();
      if (element.style.textAlign) link.align = element.style.textAlign;
    }
    return;
  }
  const value = pathToValue(key);
  if (!value || !Object.hasOwn(value, 'html')) return;
  value.html = serializeEditable(element);
  if (element.style.textAlign) value.align = element.style.textAlign;
}
function serializeEditable(element) {
  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    const inner = Array.from(node.childNodes).map(serialize).join('');
    if (tag === 'b' || tag === 'strong') return '<' + tag + '>' + inner + '</' + tag + '>';
    if (tag === 'div' || tag === 'p') return inner + '<br>';
    return inner;
  }
  return Array.from(element.childNodes).map(serialize).join('').replace(/(?:<br>)+$/i, '');
}
function scheduleFit() {
  if (fitFrame) cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => { fitFrame = 0; applyAutoFit(); });
}
function applySpacing(bodyPt, slack, spacing) {
  const style = elements.paper.style;
  style.setProperty('--body-size', bodyPt.toFixed(2) + 'pt');
  style.setProperty('--body-line', spacing.bodyLineHeightPt.toFixed(4) + 'pt');
  style.setProperty('--entry-line', spacing.threeColumnTitleLineHeightPt.toFixed(4) + 'pt');
  style.setProperty('--bullet-gap', spacing.sameGroupBulletGapPt.toFixed(4) + 'pt');
  style.setProperty('--section-gap', spacing.sectionBeforeGapPt.toFixed(4) + 'pt');
  style.setProperty('--title-bullet-gap', spacing.largeTitleToFirstBulletGapPt.toFixed(4) + 'pt');
  style.setProperty('--title-entry-gap', spacing.largeTitleToFirstThreeColumnGapPt.toFixed(4) + 'pt');
  style.setProperty('--exp-gap', spacing.previousExperienceBulletToNextThreeColumnGapPt.toFixed(4) + 'pt');
  style.setProperty('--entry-bullet-gap', spacing.threeColumnToFirstBulletGapPt.toFixed(4) + 'pt');
  layout = Object.assign({}, layout || {}, { bodyPt, slack, marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } });
}
function applyAutoFit() {
  if (!draft || !elements.paperContent.querySelector('.resume-flow')) return;
  const flow = elements.paperContent.querySelector('.resume-flow');
  const available = elements.paperContent.clientHeight;
  const fit = fitResumeLayout({
    availableHeightPx: available,
    measureContentHeightPx: ({ bodyPt, slack, spacing }) => {
      applySpacing(bodyPt, slack, spacing);
      return flow.getBoundingClientRect().height / currentPaperScale;
    },
  });
  applySpacing(fit.bodyPt, fit.slack, fit.spacing);
  elements.paper.classList.toggle('is-overflow', !fit.fits);
  currentOverflowPx = fit.fits ? 0 : fit.overflowPx;
  const contactRows = Array.from(elements.paperContent.querySelectorAll('.contact-row'));
  contactRows.forEach((row) => row.classList.toggle('overflow', row.scrollWidth > row.clientWidth + 1));
  const contactConflict = contactRows.some((row) => row.classList.contains('overflow'));
  exportBlockedReason = !fit.fits ? '当前内容在最小字号下仍超过一页。请删减文字后再导出。' : contactConflict ? '联系方式超过固定两行的宽度，请修改电话、邮箱、微信或链接。' : '';
  elements.export.disabled = Boolean(exportBlockedReason);
  elements.export.title = exportBlockedReason;
  updateViewScale();
  updateSortHandle();
}
function updateViewScale() {
  const scroller = elements.paperScroller;
  const style = getComputedStyle(scroller);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availableWidth = Math.max(200, scroller.clientWidth - horizontalPadding - 22);
  const availableHeight = Math.max(200, scroller.clientHeight - verticalPadding - 12);
  const scale = viewMode === 'actual' ? 1 : Math.min(availableWidth / PAPER_WIDTH_PX, availableHeight / PAPER_HEIGHT_PX, 1);
  currentPaperScale = scale;
  byId('view-page').setAttribute('aria-pressed', String(viewMode === 'fit'));
  byId('view-actual').setAttribute('aria-pressed', String(viewMode === 'actual'));
  document.documentElement.style.setProperty('--paper-scale', String(scale));
  document.documentElement.style.setProperty('--paper-width', PAPER_WIDTH_PX + 'px');
  document.documentElement.style.setProperty('--paper-height', PAPER_HEIGHT_PX + 'px');
  elements.paperSpace.style.width = (PAPER_WIDTH_PX * scale) + 'px';
  elements.paperSpace.style.height = ((PAPER_HEIGHT_PX + currentOverflowPx) * scale) + 'px';
  if (elements.library.classList.contains('hidden') === false || elements.trash.classList.contains('hidden') === false) updateCardScales();
}

function updateCurrentSortSelection() {
  elements.paperContent.querySelectorAll('.sortable').forEach((item) => item.classList.remove('selected'));
  const active = document.activeElement;
  if (active && active.dataset && active.dataset.edit) {
    const key = active.dataset.edit.split('|');
    if (key[0] === 'bullet') {
      const item = elements.paperContent.querySelector('.bullet[data-item-id="' + CSS.escape(key[2]) + '"]');
      if (item) item.classList.add('selected');
    } else if (key[0] === 'column') {
      const item = elements.paperContent.querySelector('.experience[data-item-id="' + CSS.escape(key[2]) + '"]');
      if (item) item.classList.add('selected');
    }
  }
  updateSortHandle();
}

/** One fixed handle sits in the left margin, centered on the selected row — same as V34. */
function updateSortHandle() {
  const handle = byId('sort-handle');
  if (!handle) return;
  const target = elements.paperContent.querySelector('.sortable.selected');
  if (!target || (dragState && dragState.moved)) { handle.hidden = true; return; }
  const rect = target.getBoundingClientRect();
  const paperRect = elements.paper.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) { handle.hidden = true; return; }
  handle.style.left = Math.max(2, paperRect.left + 1) + 'px';
  handle.style.top = Math.max(2, Math.min(window.innerHeight - 34, rect.top + (rect.height - 32) / 2)) + 'px';
  handle.hidden = false;
}
function focusEditable(element, selectAll) {
  if (!element) return;
  element.focus();
  if (selectAll) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
function findBulletItem(sectionType, id) {
  if (sectionType === 'skills') return draft.sections[0].bullets.find((item) => item.id === id);
  const section = draft.sections.find((item) => item.type === sectionType);
  for (const entry of section.entries) {
    const bullet = entry.bullets.find((item) => item.id === id);
    if (bullet) return bullet;
  }
  return null;
}
function addBulletAfter(element, initialHtml) {
  const key = element.dataset.edit.split('|');
  const sectionType = key[1];
  const bulletId = key[2];
  pushUndo(true);
  const fresh = { id: uid(sectionType + '-bullet'), html: initialHtml || '' };
  if (sectionType === 'skills' || sectionType === 'education') {
    const list = draft.sections[0].bullets;
    const actualList = sectionType === 'skills' ? list : draft.sections.find((section) => section.type === 'education').bullets;
    actualList.splice(actualList.findIndex((item) => item.id === bulletId) + 1, 0, fresh);
  } else {
    const section = draft.sections.find((item) => item.type === sectionType);
    for (const entry of section.entries) {
      const index = entry.bullets.findIndex((item) => item.id === bulletId);
      if (index >= 0) { entry.bullets.splice(index + 1, 0, fresh); break; }
    }
  }
  renderPaper();
  const next = elements.paperContent.querySelector('[data-edit="bullet|' + CSS.escape(sectionType) + '|' + CSS.escape(fresh.id) + '"]');
  focusEditable(next, false);
  scheduleFit();
  saveDraftSoon();
}
function addExperienceAfter(sectionType, entryId) {
  const section = draft.sections.find((item) => item.type === sectionType);
  if (!section || !['work', 'projects'].includes(sectionType)) return;
  pushUndo(true);
  const newEntry = { id: uid(sectionType + '-entry'), columns: [{ html: '' }, { html: '' }, { html: '' }], bullets: [] };
  const index = section.entries.findIndex((item) => item.id === entryId);
  section.entries.splice(index + 1, 0, newEntry);
  renderPaper();
  const field = elements.paperContent.querySelector('[data-edit="column|' + CSS.escape(sectionType) + '|' + CSS.escape(newEntry.id) + '|0"]');
  focusEditable(field, false);
  scheduleFit();
  saveDraftSoon();
}
function removeBullet(element) {
  const key = element.dataset.edit.split('|');
  const sectionType = key[1];
  const id = key[2];
  pushUndo(true);
  if (sectionType === 'skills' || sectionType === 'education') {
    const list = sectionType === 'skills' ? draft.sections[0].bullets : draft.sections.find((item) => item.type === 'education').bullets;
    const index = list.findIndex((item) => item.id === id);
    list.splice(index, 1);
  } else {
    const section = draft.sections.find((item) => item.type === sectionType);
    for (const entry of section.entries) {
      const index = entry.bullets.findIndex((item) => item.id === id);
      if (index >= 0) { entry.bullets.splice(index, 1); break; }
    }
  }
  renderPaper();
  scheduleFit();
  saveDraftSoon();
}
function removeExperience(sectionType, entryId) {
  const section = draft.sections.find((item) => item.type === sectionType);
  if (!section) return;
  const index = section.entries.findIndex((item) => item.id === entryId);
  if (index < 0) return;
  pushUndo(true);
  section.entries.splice(index, 1);
  renderPaper();
  scheduleFit();
  saveDraftSoon();
}
function addLink(type) {
  pushUndo(true);
  draft.identity.links[type] = {
    type,
    href: '',
    label: { html: type === 'github' ? 'GitHub' : '个人网页' },
  };
  renderPaper();
  scheduleFit();
  const field = elements.paperContent.querySelector('[data-edit="' + (type === 'github' ? 'githubHref' : 'websiteHref') + '"]');
  focusEditable(field, true);
  saveDraftSoon();
}
function removeLink(type) {
  pushUndo(true);
  draft.identity.links[type] = null;
  renderPaper();
  scheduleFit();
  saveDraftSoon();
}
function setFieldAlignment(element, alignment) {
  const editKey = element.dataset.edit || '';
  const value = editKey === 'githubHref'
    ? draft.identity.links.github
    : editKey === 'websiteHref'
      ? draft.identity.links.personalWebsite
      : pathToValue(editKey);
  const target = element.closest('.bullet') || element;
  if (getComputedStyle(target).textAlign === alignment) return;
  pushUndo(true);
  target.style.textAlign = alignment;
  element.style.textAlign = alignment;
  if (value) value.align = alignment;
  scheduleFit();
  saveDraftSoon();
}
function onEditorKeydown(event) {
  const element = event.target.closest('[data-edit]');
  if (!element || !elements.paperContent.contains(element)) return;
  const key = event.key;
  const parts = element.dataset.edit.split('|');
  const kind = parts[0];
  if (event.metaKey && key.toLowerCase() === 'i' || event.metaKey && key.toLowerCase() === 'u') {
    event.preventDefault();
    return;
  }
  if (key === 'Enter') {
    if (kind === 'bullet') {
      event.preventDefault();
      if (event.shiftKey) document.execCommand('insertLineBreak');
      else addBulletAfter(element);
      return;
    }
    if (kind === 'column' && (parts[1] === 'work' || parts[1] === 'projects')) {
      event.preventDefault();
      addExperienceAfter(parts[1], parts[2]);
      return;
    }
    event.preventDefault();
    element.blur();
    return;
  }
  if ((key === 'Backspace' || key === 'Delete') && kind === 'bullet' && !plainTextFromHtml(serializeEditable(element)).trim()) {
    event.preventDefault();
    removeBullet(element);
    return;
  }
  if ((key === 'Backspace' || key === 'Delete') && kind === 'column' && (parts[1] === 'work' || parts[1] === 'projects') && !plainTextFromHtml(serializeEditable(element)).trim()) {
    event.preventDefault();
    removeExperience(parts[1], parts[2]);
    return;
  }
  if ((key === 'Backspace' || key === 'Delete') && (kind === 'githubHref' || kind === 'websiteHref') && !element.innerText.trim()) {
    event.preventDefault();
    removeLink(kind === 'githubHref' ? 'github' : 'personalWebsite');
  }
  if (event.metaKey && key === 'a') {
    event.preventDefault();
    focusEditable(element, true);
  }
  if (event.metaKey && !event.shiftKey && key === 'ArrowLeft') { event.preventDefault(); setFieldAlignment(element, 'left'); }
  if (event.metaKey && !event.shiftKey && key === 'ArrowRight') { event.preventDefault(); setFieldAlignment(element, 'right'); }
  if (event.metaKey && !event.shiftKey && key === 'ArrowDown') { event.preventDefault(); setFieldAlignment(element, 'center'); }
  if (event.metaKey && key.toLowerCase() === 'b') {
    event.preventDefault();
    if (kind === 'bullet') {
      document.execCommand('bold');
      updateContentFromElement(element);
      scheduleFit();
      saveDraftSoon();
    }
  }
  if (event.metaKey && (key === 'ArrowUp')) event.preventDefault();
}
function onPaste(event) {
  const element = event.target.closest('[data-edit]');
  if (!element || !elements.paperContent.contains(element)) return;
  event.preventDefault();
  const raw = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text/html').replace(/<br\s*\/?\s*>|<\/(p|div|li)>/gi, '\n').replace(/<[^>]*>/g, '');
  const key = element.dataset.edit.split('|');
  if (key[0] === 'bullet') {
    const lines = raw.replace(/\r/g, '').split('\n');
    const first = lines.shift() || '';
    document.execCommand('insertText', false, first);
    if (lines.length) {
      let previous = element;
      lines.forEach((line) => {
        const cloneElement = element.cloneNode(true);
        cloneElement.dataset.edit = 'bullet|' + key[1] + '|' + uid(key[1] + '-bullet');
        cloneElement.innerHTML = '';
        previous.after(cloneElement);
        const item = { id: cloneElement.dataset.edit.split('|')[2], html: escapeHtml(line) };
        if (key[1] === 'skills') {
          const list = draft.sections[0].bullets;
          const at = list.findIndex((entry) => entry.id === key[2]);
          list.splice(at + 1, 0, item);
          key[2] = item.id;
        } else {
          const section = draft.sections.find((part) => part.type === key[1]);
          for (const entry of section.entries) {
            const at = entry.bullets.findIndex((point) => point.id === key[2]);
            if (at >= 0) { entry.bullets.splice(at + 1, 0, item); key[2] = item.id; break; }
          }
        }
        previous = cloneElement;
      });
      renderPaper();
    }
  } else {
    document.execCommand('insertText', false, raw.replace(/\r?\n/g, ' '));
  }
  normalizeFieldRuns(element);
  scheduleFit();
  saveDraftSoon();
}
function onCompositionStart() { composing = true; }
function onCompositionEnd(event) {
  composing = false;
  const element = event.target.closest('[data-edit]');
  if (element) {
    updateContentFromElement(element);
    normalizeFieldRuns(element);
    scheduleFit();
    saveDraftSoon();
  }
}
function onInput(event) {
  const element = event.target.closest('[data-edit]');
  if (!element || composing) return;
  updateContentFromElement(element);
  lastEditElement = element;
  scheduleFit();
  saveDraftSoon();
}
function onBeforeInput(event) {
  const element = event.target.closest('[data-edit]');
  if (element && !composing) pushUndo(false);
}
function onFocusIn(event) {
  const element = event.target.closest('[data-edit]');
  if (element) {
    lastEditElement = element;
    updateCurrentSortSelection();
  }
}
function onFocusOut(event) {
  const element = event.target.closest('[data-edit]');
  if (element && !composing) normalizeFieldRuns(element);
  setTimeout(updateCurrentSortSelection, 0);
}

function installDrag() {
  const handle = byId('sort-handle');
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const item = elements.paperContent.querySelector('.sortable.selected');
    const list = item && item.parentElement;
    if (!item || !list) return;
    event.preventDefault();
    dragState = { item, list, section: item.dataset.section, kind: item.dataset.sortKind, moved: false };
    item.classList.add('dragging');
    handle.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sortable');
    if (!target || target === dragState.item || target.parentElement !== dragState.list || target.dataset.sortKind !== dragState.kind) return;
    const rect = target.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    dragState.list.insertBefore(dragState.item, after ? target.nextSibling : target);
    if (!dragState.moved) {
      dragState.moved = true;
      handle.hidden = true;
    }
  });
  document.addEventListener('pointerup', () => finishDrag());
  document.addEventListener('pointercancel', () => finishDrag());
}
function finishDrag() {
  if (!dragState) return;
  const state = dragState;
  dragState = null;
  const handle = byId('sort-handle');
  handle.classList.remove('is-dragging');
  state.item.classList.remove('dragging');
  if (!state.moved) { updateSortHandle(); return; }
  pushUndo(true);
  if (state.kind === 'bullet') {
    const ids = Array.from(state.list.querySelectorAll(':scope > .bullet')).map((item) => item.dataset.itemId);
    if (state.section === 'skills') {
      const map = new Map(draft.sections[0].bullets.map((item) => [item.id, item]));
      draft.sections[0].bullets = ids.map((id) => map.get(id)).filter(Boolean);
    } else if (state.section === 'education') {
      draft.sections.find((section) => section.type === 'education').bullets = ids.map((id) => {
        return draft.sections.find((section) => section.type === 'education').bullets.find((point) => point.id === id);
      }).filter(Boolean);
    } else {
      const section = draft.sections.find((item) => item.type === state.section);
      const owner = section.entries.find((entry) => entry.bullets.some((point) => point.id === ids[0]));
      if (owner) {
        const map = new Map(owner.bullets.map((item) => [item.id, item]));
        owner.bullets = ids.map((id) => map.get(id)).filter(Boolean);
      }
    }
  } else if (state.kind === 'experience') {
    const section = draft.sections.find((item) => item.type === state.section);
    const ids = Array.from(state.list.querySelectorAll(':scope > .experience')).map((item) => item.dataset.itemId);
    const map = new Map(section.entries.map((item) => [item.id, item]));
    section.entries = ids.map((id) => map.get(id)).filter(Boolean);
  }
  renderPaper();
  scheduleFit();
  saveDraftSoon();
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}
function confirm(message, title, actionText) {
  elements.confirmTitle.textContent = title || '请确认';
  elements.confirmMessage.textContent = message;
  elements.confirmAction.textContent = actionText || '确认';
  openDialog(elements.confirmDialog);
  return new Promise((resolve) => {
    const closed = () => { elements.confirmDialog.removeEventListener('close', closed); resolve(elements.confirmDialog.returnValue === 'confirm'); };
    elements.confirmDialog.addEventListener('close', closed);
  });
}
function promptSnapshotName() {
  elements.snapshotName.value = (activeResume ? activeResume.name : '简历') + ' 快照 ' + fmtMinute(new Date().toISOString());
  openDialog(elements.snapshotDialog);
  elements.snapshotName.focus();
  elements.snapshotName.select();
  return new Promise((resolve) => {
    const closed = () => { elements.snapshotDialog.removeEventListener('close', closed); resolve(elements.snapshotDialog.returnValue === 'save' ? elements.snapshotName.value.trim() : null); };
    elements.snapshotDialog.addEventListener('close', closed);
  });
}
async function createSnapshot() {
  if (!activeResume) return;
  const name = await promptSnapshotName();
  if (!name) return;
  const saved = await saveDraftNow();
  if (!saved) return;
  try {
    const response = await api('/resumes/' + encodeURIComponent(activeResume.id) + '/snapshots', { method: 'POST', body: JSON.stringify({ name }) });
    undoStack = undoStack.filter((item) => !(item.kind === 'resume-created' && item.resumeId === activeResume.id));
    showToast('只读快照已保存，当前稿仍可继续编辑。', 'success');
    await refreshLibraryState();
  } catch (error) { showToast('快照没有保存。原因：' + error.message, 'error'); }
}
async function refreshLibraryState() {
  libraryState = await api('/state');
  return libraryState;
}
function setView(view) {
  currentView = view;
  elements.editor.classList.toggle('hidden', view !== 'editor');
  elements.library.classList.toggle('hidden', view !== 'library');
  elements.trash.classList.toggle('hidden', view !== 'trash');
  if (view !== 'editor') byId('sort-handle').hidden = true;
  if (view === 'library' || view === 'trash') { refreshLibraryState().then(renderLibrary).catch((error) => showToast(error.message, 'error')); }
  if (view === 'library') setTimeout(() => elements.librarySearch.focus(), 40);
}
function flattenLibrary(state) {
  const cards = [];
  for (const resume of state.resumes || []) {
    cards.push({ kind: 'current', resume, time: resume.currentDraft.updatedAt, content: resume.currentDraft.content, layout: resume.currentDraft.layout });
    for (const snapshot of resume.snapshots || []) cards.push({ kind: 'snapshot', resume, snapshot, time: snapshot.createdAt, content: snapshot.content, layout: snapshot.layout });
  }
  cards.sort((a, b) => new Date(b.time) - new Date(a.time));
  return cards;
}
function makeCardAction(icon, label, action, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}
function renderCard(card, trashed) {
  const article = document.createElement('article');
  article.className = 'library-card';
  article.dataset.kind = card.kind || 'snapshot';
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const info = document.createElement('div');
  info.className = 'card-info';
  const kind = document.createElement('span');
  kind.className = 'card-kind';
  kind.textContent = trashed ? '废纸篓' : (card.kind === 'current' ? '当前稿' : '快照');
  info.append(kind);
  const title = document.createElement(trashed || card.kind !== 'snapshot' ? 'div' : 'button');
  title.className = 'card-name';
  title.textContent = card.kind === 'current' ? card.resume.name : card.snapshot.name;
  if (!trashed && card.kind === 'snapshot') { title.type = 'button'; title.dataset.renameSnapshot = card.snapshot.id; title.title = '点击修改快照名'; }
  info.append(title);
  const sub = document.createElement('div');
  sub.className = card.kind === 'snapshot' || trashed ? 'card-owner' : 'card-time';
  sub.textContent = card.kind === 'snapshot' || trashed ? card.resume.name + ' · 保存于 ' + fmtMinute(card.time) : '最近编辑 ' + fmtMinute(card.time);
  info.append(sub);
  if (trashed) {
    const time = document.createElement('div');
    time.className = 'card-time';
    time.textContent = '删除于 ' + fmtMinute(card.trashedAt);
    info.append(time);
  }
  meta.append(info);
  const actions = document.createElement('div');
  actions.className = 'card-actions' + (trashed ? ' trash-card-actions' : '');
  if (trashed) {
    actions.append(makeCardAction(ICONS.restore, '还原', 'restore', card.id));
    actions.append(makeCardAction(ICONS.permanent, '彻底删除', 'permanent-delete', card.id));
  } else if (card.kind === 'snapshot') {
    actions.append(makeCardAction(ICONS.trash, '移入废纸篓', 'trash', card.snapshot.id));
  }
  if (actions.childNodes.length) meta.append(actions);
  article.append(meta);
  const frame = document.createElement('div');
  frame.className = 'card-paper-frame';
  if (!trashed) {
    frame.dataset.openKind = card.kind;
    frame.dataset.resumeId = card.resume.id;
    if (card.snapshot) frame.dataset.snapshotId = card.snapshot.id;
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-label', card.kind === 'current' ? '打开当前稿' : '复制快照为新简历');
  }
  const mini = document.createElement('div');
  mini.className = 'card-paper';
  const inner = document.createElement('div');
  inner.className = 'paper-content';
  buildPaperContent(inner, card.content, false);
  mini.append(inner);
  frame.append(mini);
  article.append(frame);
  return article;
}
function renderLibrary() {
  if (!libraryState) return;
  const query = elements.librarySearch.value.trim().toLowerCase();
  const cards = flattenLibrary(libraryState).filter((card) => {
    const name = card.kind === 'current' ? card.resume.name : card.snapshot.name;
    return !query || (name + ' ' + card.resume.name).toLowerCase().includes(query);
  });
  elements.libraryGrid.replaceChildren(...cards.map((card) => renderCard(card, false)));
  renderTrash();
  updateCardScales();
}
function renderTrash() {
  if (!libraryState) return;
  const query = elements.trashSearch.value.trim().toLowerCase();
  const byResume = new Map((libraryState.resumes || []).map((resume) => [resume.id, resume]));
  const cards = (libraryState.trash || []).map((item) => Object.assign({ kind: 'snapshot', resume: byResume.get(item.resumeId) || { name: '已删除的简历' }, snapshot: item, time: item.createdAt }, item));
  const filtered = cards.filter((card) => !query || (card.snapshot.name + ' ' + card.resume.name).toLowerCase().includes(query));
  elements.trashGrid.replaceChildren(...filtered.map((card) => renderCard(card, true)));
  elements.trashEmpty.classList.toggle('hidden', cards.length > 0);
  byId('empty-trash').disabled = cards.length === 0;
}
function updateCardScales() {
  document.querySelectorAll('.card-paper-frame').forEach((frame) => {
    const mini = frame.querySelector('.card-paper');
    if (mini) mini.style.setProperty('--card-scale', String(frame.clientWidth / PAPER_WIDTH_PX));
  });
}
async function openResume(resumeId) {
  try {
    if (!await saveDraftNow()) return;
    const response = await api('/resumes/' + encodeURIComponent(resumeId));
    activeResume = response.resume || response;
    resetDraftSaveTracking();
    await api('/last-opened', { method: 'PUT', body: JSON.stringify({ resumeId }) });
    draft = clone(activeResume.currentDraft.content);
    layout = clone(activeResume.currentDraft.layout);
    undoStack = [];
    undoLastAt = 0;
    renderPaper();
    setView('editor');
    scheduleFit();
  } catch (error) { showToast('这份简历暂时打不开。原因：' + error.message, 'error'); }
}
async function openSnapshotCopy(snapshotId) {
  try {
    if (!await saveDraftNow()) return;
    const previousResumeId = activeResume && activeResume.id;
    const response = await api('/snapshots/' + encodeURIComponent(snapshotId) + '/copy', { method: 'POST', body: '{}' });
    const resume = response.resume || response;
    await refreshLibraryState();
    activeResume = resume;
    resetDraftSaveTracking();
    draft = clone(resume.currentDraft.content);
    layout = clone(resume.currentDraft.layout);
    undoStack = [{
      kind: 'resume-created',
      resumeId: resume.id,
      previousResumeId,
      expectedDraft: { content: clone(resume.currentDraft.content), layout: clone(resume.currentDraft.layout) },
    }];
    undoLastAt = 0;
    renderPaper();
    setView('editor');
    scheduleFit();
  } catch (error) { showToast('复制快照失败。原因：' + error.message, 'error'); }
}
function startInlineRename(button, save) {
  if (button.dataset.renaming === 'true') return;
  const input = document.createElement('input');
  input.className = 'inline-name-input';
  input.value = button.textContent;
  input.maxLength = 80;
  button.dataset.renaming = 'true';
  button.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (commit) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (commit && value) await save(value);
    input.replaceWith(button);
    button.textContent = commit && value ? value : button.textContent;
    delete button.dataset.renaming;
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}
async function renameActiveResume(name) {
  if (!activeResume || !name || name === activeResume.name) return;
  const previous = activeResume.name;
  pushUndo(true);
  activeResume.name = name;
  elements.title.textContent = name;
  try {
    await api('/resumes/' + encodeURIComponent(activeResume.id), { method: 'PATCH', body: JSON.stringify({ name }) });
    undoLastAt = 0;
    setStatus('已保存', 'saved');
  } catch (error) {
    undoStack.pop();
    undoLastAt = 0;
    activeResume.name = previous;
    elements.title.textContent = previous;
    showToast('名称没有保存。原因：' + error.message, 'error');
  }
}
async function renameSnapshot(snapshotId, name) {
  if (!name) return;
  const previous = libraryState && [...libraryState.resumes.flatMap((resume) => resume.snapshots), ...libraryState.trash].find((item) => item.id === snapshotId);
  try {
    const result = await api('/snapshots/' + encodeURIComponent(snapshotId), { method: 'PATCH', body: JSON.stringify({ name }) });
    if (previous && previous.name !== result.name) pushUndoRecord({ kind: 'snapshot-name', resumeId: result.resumeId, snapshotId, previousName: previous.name });
    await refreshLibraryState(); renderLibrary();
  }
  catch (error) { showToast('快照名没有保存。原因：' + error.message, 'error'); }
}
async function handleLibraryAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'trash') {
    if (!await confirm('这份快照会移到废纸篓，可以之后还原。', '移入废纸篓', '移入')) return;
    try { await api('/snapshots/' + encodeURIComponent(id) + '/trash', { method: 'POST', body: '{}' }); await refreshLibraryState(); renderLibrary(); }
    catch (error) { showToast('快照没有移入废纸篓。原因：' + error.message, 'error'); }
  }
  if (action === 'restore') {
    try { await api('/trash/' + encodeURIComponent(id) + '/restore', { method: 'POST', body: '{}' }); await refreshLibraryState(); renderLibrary(); }
    catch (error) { showToast('还原失败。原因：' + error.message, 'error'); }
  }
  if (action === 'permanent-delete') {
    if (!await confirm('彻底删除后，这份快照无法恢复。', '彻底删除快照', '彻底删除')) return;
    try { await api('/trash/' + encodeURIComponent(id), { method: 'DELETE' }); await refreshLibraryState(); renderLibrary(); }
    catch (error) { showToast('没有删除。原因：' + error.message, 'error'); }
  }
}
async function emptyTrash() {
  if (!libraryState || !libraryState.trash.length) return;
  if (!await confirm('废纸篓里的快照都会彻底删除，无法恢复。', '清空废纸篓', '彻底删除')) return;
  try { await api('/trash', { method: 'DELETE' }); await refreshLibraryState(); renderLibrary(); }
  catch (error) { showToast('废纸篓没有清空。原因：' + error.message, 'error'); }
}
async function createResume() {
  if (!await saveDraftNow()) return;
  const previousResumeId = activeResume && activeResume.id;
  const response = await api('/resumes', { method: 'POST', body: JSON.stringify({ name: '未命名简历', content: createEmptyResumeContent(), layout: { marginsMm: { top: 9, right: 9, bottom: 9, left: 9 } } }) });
  const resume = response.resume || response;
  await refreshLibraryState();
  activeResume = resume;
  resetDraftSaveTracking();
  undoStack = [{
    kind: 'resume-created',
    resumeId: resume.id,
    previousResumeId,
    expectedDraft: { content: clone(resume.currentDraft.content), layout: clone(resume.currentDraft.layout) },
  }];
  undoLastAt = 0;
  draft = clone(resume.currentDraft.content);
  layout = clone(resume.currentDraft.layout);
  renderPaper();
  setView('editor');
  scheduleFit();
}
async function exportPdf() {
  if (exportBlockedReason) { showToast(exportBlockedReason, 'error'); return; }
  await saveDraftNow();
  elements.export.disabled = true;
  const originalText = elements.export.textContent;
  elements.export.textContent = '正在导出…';
  try {
    const result = await api('/export-pdf', { method: 'POST', body: JSON.stringify({ resumeId: activeResume.id, content: draft, layout, name: activeResume.name }) });
    showToast('PDF 已保存到“下载”文件夹：' + (result.filename || ''), 'success');
  } catch (error) {
    showToast('PDF没有导出，当前内容已保留。原因：' + error.message, 'error', exportPdf);
  } finally {
    elements.export.textContent = originalText;
    elements.export.disabled = Boolean(exportBlockedReason);
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
    const add = event.target.closest('[data-add-link]');
    if (add) { event.preventDefault(); addLink(add.dataset.addLink); return; }
    const anchor = event.target.closest('a[data-edit]');
    if (anchor) event.preventDefault();
  });
  elements.title.addEventListener('click', () => startInlineRename(elements.title, renameActiveResume));
  byId('view-page').addEventListener('click', () => { viewMode = 'fit'; updateViewScale(); });
  byId('view-actual').addEventListener('click', () => { viewMode = 'actual'; updateViewScale(); });
  byId('toggle-guide').addEventListener('click', () => {
    showGuide = !showGuide;
    elements.paper.classList.toggle('guide-on', showGuide);
    byId('toggle-guide').setAttribute('aria-pressed', String(showGuide));
  });
  elements.export.addEventListener('click', exportPdf);
  byId('show-trash').addEventListener('click', () => setView('trash'));
  byId('back-library').addEventListener('click', () => setView('library'));
  byId('empty-trash').addEventListener('click', emptyTrash);
  byId('create-resume').addEventListener('click', () => createResume().catch((error) => showToast('新简历没有建立。原因：' + error.message, 'error')));
  elements.librarySearch.addEventListener('input', renderLibrary);
  elements.trashSearch.addEventListener('input', renderTrash);
  elements.libraryGrid.addEventListener('click', async (event) => {
    const name = event.target.closest('[data-rename-snapshot]');
    if (name) { event.stopPropagation(); startInlineRename(name, (value) => renameSnapshot(name.dataset.renameSnapshot, value)); return; }
    await handleLibraryAction(event);
    const frame = event.target.closest('[data-open-kind]');
    if (!frame) return;
    if (frame.dataset.openKind === 'current') await openResume(frame.dataset.resumeId);
    else await openSnapshotCopy(frame.dataset.snapshotId);
  });
  elements.libraryGrid.addEventListener('keydown', async (event) => {
    const frame = event.target.closest('[data-open-kind]');
    if (frame && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (frame.dataset.openKind === 'current') await openResume(frame.dataset.resumeId);
      else await openSnapshotCopy(frame.dataset.snapshotId);
    }
  });
  elements.trashGrid.addEventListener('click', handleLibraryAction);
  elements.snapshotForm.addEventListener('submit', (event) => {
    if (event.submitter && event.submitter.value === 'save') return;
    event.preventDefault();
    elements.snapshotDialog.close('cancel');
  });
  elements.confirmForm.addEventListener('submit', (event) => {
    if (!event.submitter) { event.preventDefault(); elements.confirmDialog.close('cancel'); }
  });
  window.addEventListener('resize', updateViewScale);
  window.addEventListener('scroll', updateSortHandle, true);
  window.addEventListener('keydown', async (event) => {
    if (event.metaKey && event.key.toLowerCase() === 's') { event.preventDefault(); await createSnapshot(); return; }
    if (event.metaKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setView('library'); return; }
    if (event.metaKey && ['i', 'u'].includes(event.key.toLowerCase())) { event.preventDefault(); return; }
    if (event.metaKey && event.key.toLowerCase() === 'a' && !(document.activeElement && document.activeElement.closest('[data-edit],input,textarea'))) { event.preventDefault(); return; }
    if (event.key === 'Escape' && !elements.snapshotDialog.open && !elements.confirmDialog.open) {
      if (currentView === 'trash') { setView('library'); return; }
      if (currentView === 'library') { setView('editor'); return; }
    }
    if (event.metaKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (!event.shiftKey) undo();
      return;
    }
    if (event.metaKey && event.key.toLowerCase() === 'b' && !event.defaultPrevented) {
      const active = document.activeElement;
      if (active && active.closest('[data-edit]')) {
        event.preventDefault();
        const kind = active.dataset.edit.split('|')[0];
        if (kind === 'bullet') {
          document.execCommand('bold');
          updateContentFromElement(active);
          scheduleFit(); saveDraftSoon();
        }
      }
    }
  });
}

async function boot() {
  installDrag();
  installEvents();
  try {
    libraryState = await api('/state');
    const id = libraryState.lastOpenedResumeId || (libraryState.resumes[0] && libraryState.resumes[0].id);
    const active = (libraryState.resumes || []).find((item) => item.id === id) || libraryState.resumes[0];
    if (!active) throw new Error('本机还没有简历资料。');
    activeResume = clone(active);
    resetDraftSaveTracking();
    draft = clone(active.currentDraft.content);
    layout = clone(active.currentDraft.layout);
    renderPaper();
    await api('/last-opened', { method: 'PUT', body: JSON.stringify({ resumeId: activeResume.id }) });
    setStatus('已保存', 'saved');
    requestAnimationFrame(() => { applyAutoFit(); updateViewScale(); });
  } catch (error) {
    setStatus('打开失败', 'error');
    showToast('简历没有打开。原因：' + error.message, 'error');
  }
}

new ResizeObserver(updateViewScale).observe(elements.paperScroller);
new ResizeObserver(updateCardScales).observe(elements.libraryGrid);
new ResizeObserver(updateCardScales).observe(elements.trashGrid);
boot();
