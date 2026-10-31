/**
 * Shared text-run splitting for resume fields.
 *
 * L-14: Chinese renders in PingFang SC; Latin letters and digits render in
 * Times New Roman. Splitting happens at render time only — stored HTML stays
 * plain text plus b/strong/br, so editing round-trips without migration.
 * Ported from the approved V34 prototype (prototypes/a4-spacing-eight-gaps-demo-v34.html).
 */

const ESCAPE_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

/** Return the text wrapped in run spans: Chinese in PingFang SC, Latin/digits in Times New Roman. */
export function runsHtml(text) {
  const chars = Array.from(String(text ?? ''));
  const parts = [];
  let last = '';
  let buffer = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    let kind;
    if (/[0-9]/.test(char)) kind = 'num';
    else if (/\p{Script=Latin}/u.test(char)) kind = 'en';
    else if (/[^\x00-\x7F]/.test(char)) kind = 'zh';
    else if (/[0-9]/.test(chars[index - 1] || '') || /[0-9]/.test(chars[index + 1] || '')) kind = 'num';
    else kind = last || 'en';
    if (kind !== last && buffer) {
      parts.push('<span class="run-' + last + '">' + escapeText(buffer) + '</span>');
      buffer = '';
    }
    buffer += char;
    last = kind;
  }
  if (buffer) parts.push('<span class="run-' + last + '">' + escapeText(buffer) + '</span>');
  return parts.join('');
}

/** Wrap bare text nodes inside root with run spans, skipping nodes already inside a run span. */
export function applyRunsToElement(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue) continue;
    const parent = node.parentElement;
    if (parent && parent.closest('.run-zh, .run-en, .run-num')) continue;
    targets.push(node);
  }
  for (const node of targets) {
    const fragment = document.createRange().createContextualFragment(runsHtml(node.nodeValue));
    node.parentNode.replaceChild(fragment, node);
  }
}

/** Re-split an edited field: unwrap existing run spans, then wrap again. */
export function normalizeFieldRuns(element, options = {}) {
  if (!element) return;
  // 重写子节点会破坏光标所在的文本节点，浏览器随后把光标收回容器开头。
  // 正在编辑的字段必须先记下字符偏移，重写完成后再放回去。
  const keepCaret = options.preserveCaret
    && (document.activeElement === element || element.contains(document.activeElement));
  const caret = keepCaret ? readCaretOffset(element) : null;
  element.querySelectorAll('.run-zh, .run-en, .run-num').forEach((span) => {
    span.replaceWith(...span.childNodes);
  });
  applyRunsToElement(element);
  if (caret != null) writeCaretOffset(element, caret);
}

/** 把「第几个文本节点 + 节点内偏移」换算成整段的字符偏移；越界时夹到合法范围。 */
export function caretIndexFrom(nodeLengths, nodeIndex, offsetInNode) {
  if (!Array.isArray(nodeLengths) || nodeIndex < 0 || nodeIndex >= nodeLengths.length) return null;
  let total = 0;
  for (let index = 0; index < nodeIndex; index += 1) total += nodeLengths[index];
  const clamped = Math.max(0, Math.min(offsetInNode, nodeLengths[nodeIndex]));
  return total + clamped;
}

/** 把整段字符偏移换算回「第几个文本节点 + 节点内偏移」；超出末尾时贴到最后一个节点结尾。 */
export function caretLocation(nodeLengths, caretIndex) {
  if (!Array.isArray(nodeLengths) || !nodeLengths.length) return null;
  if (!Number.isFinite(caretIndex) || caretIndex < 0) return null;
  let remaining = caretIndex;
  for (let index = 0; index < nodeLengths.length; index += 1) {
    if (remaining <= nodeLengths[index]) return { nodeIndex: index, offsetInNode: remaining };
    remaining -= nodeLengths[index];
  }
  const last = nodeLengths.length - 1;
  return { nodeIndex: last, offsetInNode: nodeLengths[last] };
}

function textNodesOf(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function textLengthOf(node) {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').length;
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  return (node.textContent || '').length;
}

/** 读取 root 内当前光标的字符偏移；无光标、有选区或光标不在 root 内时返回 null。 */
export function readCaretOffset(root) {
  if (!root) return null;
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) return null;
  if (range.startContainer !== root && !root.contains(range.startContainer)) return null;
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const nodes = textNodesOf(root);
    const index = nodes.indexOf(range.startContainer);
    if (index === -1) return null;
    return caretIndexFrom(nodes.map((node) => (node.nodeValue || '').length), index, range.startOffset);
  }
  let offset = 0;
  Array.from(root.childNodes).slice(0, range.startOffset).forEach((child) => { offset += textLengthOf(child); });
  return offset;
}

/** 把光标放回 root 内的指定字符偏移；节点已被替换时按最新节点重算落点。 */
export function writeCaretOffset(root, offset) {
  if (!root || offset == null) return false;
  const nodes = textNodesOf(root);
  if (!nodes.length) return false;
  const location = caretLocation(nodes.map((node) => (node.nodeValue || '').length), offset);
  if (!location) return false;
  const range = document.createRange();
  range.setStart(nodes[location.nodeIndex], location.offsetInNode);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
