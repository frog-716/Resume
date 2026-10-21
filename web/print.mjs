import { calculateSpacing } from '/domain/auto-layout.mjs';
import { runsHtml, applyRunsToElement } from '/text-runs.mjs';

const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const contentNode = document.getElementById('print-content');
const paper = document.getElementById('print-paper');

function safeFragment(html) {
  const source = document.createElement('template');
  source.innerHTML = String(html || '');
  const out = document.createElement('template');
  function copy(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.nodeValue || '')); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') { parent.append(document.createElement('br')); return; }
    if (tag === 'b' || tag === 'strong') {
      const safe = document.createElement(tag);
      Array.from(node.childNodes).forEach((child) => copy(child, safe));
      parent.append(safe);
      return;
    }
    Array.from(node.childNodes).forEach((child) => copy(child, parent));
  }
  Array.from(source.content.childNodes).forEach((node) => copy(node, out.content));
  return out.innerHTML;
}
function editableText(html, className, align) {
  const element = document.createElement('span');
  element.className = className || '';
  element.innerHTML = safeFragment(html);
  if (align) element.style.textAlign = align;
  applyRunsToElement(element);
  return element;
}
const ICON_PATHS = {
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z',
  email: 'M3 5.5h18v13H3z M3.5 6.2 12 12.5l8.5-6.3',
  wechat: 'M8.5 6.2c-3.1 0-5.7 2-5.7 4.6 0 1.5.8 2.8 2.2 3.7l-.6 2 2.3-1.2c.6.2 1.2.3 1.8.3h.5c-.1-.4-.2-.8-.2-1.2 0-2.7 2.7-4.9 6-4.9h.5c-.2-1.9-2.3-3.3-4.8-3.3H8.5Zm6.6 4.7c-2.5 0-4.6 1.5-4.6 3.4s2.1 3.4 4.6 3.4c.5 0 1-.1 1.5-.2l1.8.9-.5-1.5c1.1-.6 1.8-1.5 1.8-2.6 0-1.9-2.1-3.4-4.6-3.4Z',
  website: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
};
const GITHUB_CAT_SVG = '<svg class="github-cat" role="img" aria-label="GitHub白猫" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>';
function icon(type) {
  const element = document.createElement('span');
  if (type === 'github') {
    element.className = 'github-icon';
    element.innerHTML = GITHUB_CAT_SVG;
    return element;
  }
  element.className = 'contact-icon';
  element.innerHTML = '<svg viewBox="0 0 24 24" role="img" aria-label="' + type + '"><path d="' + ICON_PATHS[type] + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + (type === 'wechat' ? ' transform="translate(-2.4 -2.4) scale(1.2)"' : '') + '></path></svg>';
  return element;
}
function addSeparator(row) {
  const separator = document.createElement('span');
  separator.className = 'contact-separator';
  separator.textContent = '｜';
  row.append(separator);
}
function makeBullets(items) {
  const ul = document.createElement('ul');
  ul.className = 'bullet-list';
  for (const item of items || []) {
    const li = document.createElement('li');
    li.className = 'bullet';
    if (item.align) li.style.textAlign = item.align;
    li.append(editableText(item.html, '', item.align));
    ul.append(li);
  }
  return ul;
}
function makeEntry(entry, type) {
  const article = document.createElement('article');
  article.className = 'experience' + (entry.bullets && entry.bullets.length ? ' has-bullets' : '');
  const head = document.createElement('div');
  head.className = 'experience-head' + (type === 'education' ? ' education-head' : '');
  entry.columns.forEach((column, index) => {
    const span = editableText(column.html, 'entry-field', column.align);
    if (index === 1) span.style.textAlign = 'center';
    if (index === 2) span.style.textAlign = 'right';
    head.append(span);
  });
  article.append(head);
  if (type !== 'education') article.append(makeBullets(entry.bullets));
  return article;
}
function makeSection(section, index) {
  const wrapper = document.createElement('section');
  wrapper.className = 'resume-section' + (index === 0 ? ' first-section' : '');
  wrapper.dataset.type = section.type;
  const heading = document.createElement('h2');
  heading.className = 'section-heading';
  heading.append(editableText(section.title.html, 'section-label', section.title.align));
  wrapper.append(heading);
  const body = document.createElement('div');
  body.className = 'section-body';
  if (section.type === 'skills') body.append(makeBullets(section.bullets));
  else if (section.type === 'education') {
    const row = document.createElement('div');
    row.className = 'experience-head education-head';
    section.columns.forEach((column, index) => {
      const field = editableText(column.html, 'entry-field', column.align);
      if (index === 1) field.style.textAlign = 'center';
      if (index === 2) field.style.textAlign = 'right';
      row.append(field);
    });
    body.append(row, makeBullets(section.bullets));
  } else for (const entry of section.entries || []) body.append(makeEntry(entry, section.type));
  wrapper.append(body);
  return wrapper;
}
function makeIdentity(identity) {
  const wrapper = document.createElement('header');
  wrapper.className = 'identity';
  wrapper.append(editableText(identity.name.html, 'person-name', identity.name.align));
  const contactRow = document.createElement('div');
  contactRow.className = 'contact-row';
  [['phone', identity.contacts.phone], ['email', identity.contacts.email], ['wechat', identity.contacts.wechat]].forEach((pair, index) => {
    if (index) addSeparator(contactRow);
    const item = document.createElement('span');
    item.className = 'contact-item';
    item.append(icon(pair[0]), editableText(pair[1].html, '', pair[1].align));
    contactRow.append(item);
  });
  wrapper.append(contactRow);
  const links = identity.links || {};
  const linkRow = document.createElement('div');
  linkRow.className = 'contact-row contact-links';
  const present = [];
  if (links.github) present.push(['github', links.github]);
  if (links.personalWebsite) present.push(['website', links.personalWebsite]);
  present.forEach((pair, index) => {
    if (index) addSeparator(linkRow);
    const item = document.createElement('span');
    item.className = 'link-item';
    const anchor = document.createElement('a');
    anchor.href = pair[1].href;
    anchor.style.textAlign = pair[1].align || '';
    anchor.innerHTML = runsHtml(pair[1].href);
    item.append(icon(pair[0]), anchor);
    linkRow.append(item);
  });
  if (linkRow.childNodes.length) wrapper.append(linkRow);
  return wrapper;
}
function render(content) {
  const flow = document.createElement('div');
  flow.className = 'resume-flow';
  flow.append(makeIdentity(content.identity));
  content.sections.forEach((section, index) => flow.append(makeSection(section, index)));
  contentNode.replaceChildren(flow);
}
async function run() {
  const response = await fetch('/api/print-data?token=' + encodeURIComponent(token), { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取待导出的简历');
  const payload = await response.json();
  const currentLayout = payload.layout || {};
  const bodyPt = Number(currentLayout.bodyPt) || 10.5;
  const slack = Number(currentLayout.slack) || 0;
  const spacing = calculateSpacing(bodyPt, slack);
  paper.style.setProperty('--body-size', bodyPt.toFixed(2) + 'pt');
  paper.style.setProperty('--body-line', spacing.bodyLineHeightPt.toFixed(4) + 'pt');
  paper.style.setProperty('--entry-line', spacing.threeColumnTitleLineHeightPt.toFixed(4) + 'pt');
  paper.style.setProperty('--bullet-gap', spacing.sameGroupBulletGapPt.toFixed(4) + 'pt');
  paper.style.setProperty('--section-gap', spacing.sectionBeforeGapPt.toFixed(4) + 'pt');
  paper.style.setProperty('--title-bullet-gap', spacing.largeTitleToFirstBulletGapPt.toFixed(4) + 'pt');
  paper.style.setProperty('--title-entry-gap', spacing.largeTitleToFirstThreeColumnGapPt.toFixed(4) + 'pt');
  paper.style.setProperty('--exp-gap', spacing.previousExperienceBulletToNextThreeColumnGapPt.toFixed(4) + 'pt');
  paper.style.setProperty('--entry-bullet-gap', spacing.threeColumnToFirstBulletGapPt.toFixed(4) + 'pt');
  render(payload.content);
  await document.fonts.ready;
  const flow = contentNode.querySelector('.resume-flow');
  const paperContent = document.getElementById('print-content');
  const flowHeight = flow ? flow.getBoundingClientRect().height : 0;
  const availableHeight = paperContent.clientHeight;
  const contact = paperContent.querySelector('.contact-row');
  const links = paperContent.querySelector('.contact-links');
  const contactOverflow = Boolean(
    (contact && contact.scrollWidth > contact.clientWidth + 1)
    || (links && links.scrollWidth > links.clientWidth + 1),
  );
  const preflight = await fetch('/api/print-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, flowHeight, availableHeight, contactOverflow }),
  });
  if (!preflight.ok) throw new Error('无法确认 PDF 内容是否完整。');
  const status = await preflight.json();
  if (!status.fits) throw new Error('简历内容超过一页。');
  if (contactOverflow) throw new Error('联系方式超过两行的宽度。');
  document.documentElement.dataset.printReady = 'true';
}
run().catch((error) => {
  document.documentElement.dataset.printError = error.message;
  document.body.textContent = 'PDF 导出失败：' + error.message;
});
