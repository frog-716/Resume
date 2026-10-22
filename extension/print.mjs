// 打印页：Chrome 侧边栏是受限渲染面，window.print() 不可靠（Chromium 已知缺陷）。
// 侧边栏把已按 L-19 适配好的纸面快照写入 storage 后打开本页，本页在真实标签页里
// 还原纸面并调用打印，输出与侧边栏所见一致。

const PAYLOAD_KEY = 'print-payload';
const hint = document.getElementById('print-hint');
const paperSpace = document.getElementById('paper-space');
let finished = false;

function setHint(text, buttons = []) {
  hint.replaceChildren(document.createTextNode(text));
  for (const [label, primary, onClick] of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (primary) button.className = 'primary';
    button.addEventListener('click', onClick);
    hint.append(button);
  }
  hint.hidden = false;
}

function finishHint() {
  if (finished) return;
  finished = true;
  // 不声称"打印完成"：afterprint 在用户点了打印和取消打印两种情况下都会
  // 触发（S-04：打开打印对话框不等于已生成/已保存 PDF；§7：取消打印不
  // 声称已保存）。这里只陈述可观察事实。
  setHint('打印预览已关闭，可以关闭此标签页。', [['关闭标签页', false, () => window.close()]]);
}

function readPayload() {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.storage?.local) { reject(new Error('当前环境不支持 chrome.storage')); return; }
    chrome.storage.local.get(PAYLOAD_KEY, (value) => {
      if (chrome.runtime?.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      resolve(value[PAYLOAD_KEY] || null);
    });
  });
}

function clearPayload() {
  return new Promise((resolve) => {
    if (!globalThis.chrome?.storage?.local) { resolve(); return; }
    chrome.storage.local.remove(PAYLOAD_KEY, () => resolve());
  });
}

function printNow() {
  try {
    window.print();
  } catch (error) {
    setHint(`自动打印失败：${error.message}`, [['手动打印', true, () => { try { window.print(); } catch {} }]]);
    return;
  }
  window.addEventListener('afterprint', async () => {
    await clearPayload();
    finishHint();
  }, { once: true });
}

async function main() {
  let payload = null;
  try {
    payload = await readPayload();
    // 读出来就立刻清掉：payload 里是完整简历 HTML，属于用户隐私数据，
    // 不能因为用户关掉打印页（或取消打印）就一直留在扩展存储里。
    // 页面已经把 html 拿在内存中，清掉不影响打印。
    await clearPayload();
  } catch (error) {
    setHint(`读取打印内容失败：${error.message}`, [['关闭标签页', false, () => window.close()]]);
    return;
  }
  if (!payload?.html) {
    setHint('没有可打印的内容，请返回侧边栏重新点击“打印 PDF”。', [['关闭标签页', false, () => window.close()]]);
    return;
  }

  paperSpace.innerHTML = payload.html;
  const name = payload.name || '简历';
  document.title = name;
  setHint(`正在打开“${name}”的打印预览…`);

  if (document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  }
  // 等两帧再加一点余量，确保样式与纸面布局稳定后再唤起打印预览。
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(printNow, 150)));
}

main();
