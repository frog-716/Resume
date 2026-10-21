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
export function normalizeFieldRuns(element) {
  if (!element) return;
  element.querySelectorAll('.run-zh, .run-en, .run-num').forEach((span) => {
    span.replaceWith(...span.childNodes);
  });
  applyRunsToElement(element);
}
