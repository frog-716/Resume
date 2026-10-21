import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { ResumeStore } from './storage.mjs';
import { DEFAULT_RESUME_LAYOUT } from './storage.mjs';
import { validateResumeContent } from '../src/domain/resume-content.mjs';

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number.parseInt(process.env.RESUME_PORT ?? '0', 10);
const host = '127.0.0.1';
const candidateRoots = [path.resolve(appRoot, 'web'), path.resolve(appRoot, 'dist')];
let webRoot = null;
for (const candidate of candidateRoots) {
  try { if ((await stat(candidate)).isDirectory()) { webRoot = candidate; break; } } catch {}
}
if (!webRoot) throw new Error('找不到 web/ 或 dist/ 前端目录。');
const dataDir = path.resolve(process.env.RESUME_DATA_DIR || path.resolve(appRoot, 'data'));
const store = await ResumeStore.open({ dataDir });
const printJobs = new Map();

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'],
]);
function send(response, status, body, contentType) {
  response.writeHead(status, {
    'Cache-Control': 'no-store', 'Content-Type': contentType || 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  });
  response.end(body);
}
function sendJson(response, status, body) { send(response, status, JSON.stringify(body), 'application/json; charset=utf-8'); }
async function resolveStaticPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const requested = decoded === '/' ? '/index.html' : decoded;
  if (requested.startsWith('/domain/')) {
    let domainRoot = path.resolve(webRoot, 'domain');
    try { if (!(await stat(domainRoot)).isDirectory()) throw new Error('domain files are not built'); }
    catch { domainRoot = path.resolve(appRoot, 'src/domain'); }
    const filePath = path.resolve(domainRoot, '.' + requested.slice('/domain'.length));
    if (filePath !== domainRoot && !filePath.startsWith(domainRoot + path.sep)) return null;
    return filePath;
  }
  const root = webRoot;
  const filePath = path.resolve(root, '.' + requested);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
  return filePath;
}
async function readJson(request, maxBytes = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > maxBytes) throw Object.assign(new Error('提交内容太大，暂时无法保存。'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('提交内容格式不正确。'), { status: 400 }); }
}
function checkSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  try {
    const parsed = new URL(origin);
    const hostHeader = request.headers.host || '';
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.host !== hostHeader) {
      throw Object.assign(new Error('为了保护本机简历资料，拒绝了来自其他网页的请求。'), { status: 403 });
    }
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error('请求来源无法确认。'), { status: 403 });
  }
}
function sanitizeFilename(name) {
  const base = String(name || '简历').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  return (base || '简历').slice(0, 100);
}
function chromeCandidates() {
  const candidates = [
    process.env.RESUME_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates;
}
async function findChrome() {
  for (const candidate of chromeCandidates()) {
    try { if ((await stat(candidate)).isFile()) return candidate; } catch {}
  }
  throw new Error('找不到 Google Chrome，无法生成 PDF。请安装 Chrome 后重试。');
}
async function writeUniquePdf(sourcePath, baseName) {
  const downloads = path.join(os.homedir(), 'Downloads');
  await mkdir(downloads, { recursive: true, mode: 0o700 });
  const safe = sanitizeFilename(baseName);
  const bytes = await readFile(sourcePath);
  for (let index = 0; index < 10000; index += 1) {
    const suffix = index === 0 ? '' : '（' + index + '）';
    const filename = safe + suffix + '.pdf';
    const target = path.join(downloads, filename);
    try {
      await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
      return { filename, path: target };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('下载文件夹里同名文件太多，无法自动另起文件名。');
}
async function createPdf(payload) {
  const validation = validateResumeContent(payload.content);
  if (!validation.valid) throw new Error('简历内容检查失败：' + validation.errors[0]);
  const resumeId = payload.resumeId;
  const current = await store.getResume(resumeId);
  const currentDraft = await store.saveCurrentDraft(resumeId, {
    content: payload.content,
    layout: Object.assign({}, DEFAULT_RESUME_LAYOUT, payload.layout || {}),
  });
  const token = randomUUID();
  printJobs.set(token, { content: currentDraft.content, layout: currentDraft.layout, name: payload.name || current.name, expiresAt: Date.now() + 60000, preflight: null });
  const browser = await findChrome();
  const tempDir = path.join(os.tmpdir(), 'resume-pdf-' + randomUUID());
  await mkdir(tempDir, { recursive: true, mode: 0o700 });
  const outputPath = path.join(tempDir, 'resume.pdf');
  const profilePath = path.join(tempDir, 'profile');
  const address = server.address();
  const url = 'http://' + host + ':' + address.port + '/print.html?token=' + encodeURIComponent(token);
  try {
    await new Promise((resolve, reject) => {
      const args = [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
        '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--hide-scrollbars',
        '--no-pdf-header-footer', '--user-data-dir=' + profilePath, '--print-to-pdf=' + outputPath, url,
      ];
      const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Chrome 导出等待超时，请再试一次。')); }, 45000);
      child.stderr.on('data', (chunk) => { if (stderr.length < 12000) stderr += chunk.toString(); });
      child.once('error', (error) => { clearTimeout(timeout); reject(new Error('启动 Chrome 失败：' + error.message)); });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error('Chrome 生成 PDF 失败。' + (stderr.trim() ? ' ' + stderr.trim().slice(-900) : '')));
      });
    });
    const printJob = printJobs.get(token);
    if (!printJob || !printJob.preflight) throw new Error('没有确认 PDF 内容是否完整，文件没有保存。请重试。');
    if (!printJob.preflight.fits) throw new Error('简历内容超过一页，文件没有保存。请修改后重试。');
    if (printJob.preflight.contactOverflow) throw new Error('联系方式超过两行的宽度，文件没有保存。请修改后重试。');
    const pdf = await readFile(outputPath);
    if (pdf.length < 100 || pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Chrome 没有生成有效 PDF。');
    const printable = pdf.toString('latin1');
    const pageCount = (printable.match(/\/Type\s*\/Page\b/g) || []).length;
    if (pageCount > 1) throw new Error('排版结果超过一页，已保留简历内容但没有保存 PDF。请检查字号和内容后重试。');
    const saved = await writeUniquePdf(outputPath, payload.name || current.name);
    return { filename: saved.filename, pages: pageCount || 1 };
  } finally {
    printJobs.delete(token);
    await import('node:fs/promises').then(({ rm }) => rm(tempDir, { recursive: true, force: true })).catch(() => {});
  }
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') checkSameOrigin(request);
  if (pathname === '/api/health' && method === 'GET') { sendJson(response, 200, { status: 'ok' }); return; }
  if (pathname === '/api/state' && method === 'GET') { sendJson(response, 200, await store.getState()); return; }
  if (pathname === '/api/print-data' && method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const job = printJobs.get(token);
    if (!job || job.expiresAt < Date.now()) { sendJson(response, 404, { error: '待导出的简历已过期，请重新点击导出。' }); return; }
    sendJson(response, 200, { content: job.content, layout: job.layout, name: job.name });
    return;
  }
  if (pathname === '/api/print-status' && method === 'POST') {
    const body = await readJson(request, 4096);
    const job = printJobs.get(String(body.token || ''));
    if (!job || job.expiresAt < Date.now()) { sendJson(response, 404, { error: '这次 PDF 导出已过期，请重新点击导出。' }); return; }
    const flowHeight = Number(body.flowHeight);
    const availableHeight = Number(body.availableHeight);
    if (!Number.isFinite(flowHeight) || !Number.isFinite(availableHeight) || flowHeight < 0 || availableHeight < 0) {
      sendJson(response, 400, { error: 'PDF 排版检查数值无效。' });
      return;
    }
    const contactOverflow = body.contactOverflow === true;
    job.preflight = { fits: flowHeight <= availableHeight + 0.5, flowHeight, availableHeight, contactOverflow };
    sendJson(response, 200, { fits: job.preflight.fits, contactOverflow });
    return;
  }
  if (pathname === '/api/last-opened' && method === 'PUT') {
    const body = await readJson(request);
    sendJson(response, 200, await store.setLastOpenedResume(body.resumeId));
    return;
  }
  if (pathname === '/api/resumes' && method === 'POST') {
    const body = await readJson(request);
    sendJson(response, 201, { resume: await store.createResume(body) });
    return;
  }
  if (pathname === '/api/export-pdf' && method === 'POST') {
    const body = await readJson(request);
    try { sendJson(response, 200, await createPdf(body)); }
    catch (error) { sendJson(response, 422, { error: error.message || 'PDF 导出失败。' }); }
    return;
  }
  if (pathname === '/api/trash' && method === 'DELETE') { sendJson(response, 200, await store.emptyTrash()); return; }
  const resumeDraft = pathname.match(/^\/api\/resumes\/([^/]+)\/draft$/);
  if (resumeDraft && method === 'PUT') {
    const body = await readJson(request);
    sendJson(response, 200, { currentDraft: await store.saveCurrentDraft(decodeURIComponent(resumeDraft[1]), body) });
    return;
  }
  const resumeSnapshots = pathname.match(/^\/api\/resumes\/([^/]+)\/snapshots$/);
  if (resumeSnapshots && method === 'POST') {
    const body = await readJson(request);
    sendJson(response, 201, { snapshot: await store.createSnapshot(decodeURIComponent(resumeSnapshots[1]), body.name) });
    return;
  }
  const snapshotCopy = pathname.match(/^\/api\/snapshots\/([^/]+)\/copy$/);
  if (snapshotCopy && method === 'POST') {
    const resume = await store.copySnapshotToNewResume(decodeURIComponent(snapshotCopy[1]));
    sendJson(response, 201, { resume });
    return;
  }
  const snapshotTrash = pathname.match(/^\/api\/snapshots\/([^/]+)\/trash$/);
  if (snapshotTrash && method === 'POST') { sendJson(response, 200, await store.trashSnapshot(decodeURIComponent(snapshotTrash[1]))); return; }
  const snapshot = pathname.match(/^\/api\/snapshots\/([^/]+)$/);
  if (snapshot && method === 'PATCH') {
    const body = await readJson(request);
    sendJson(response, 200, await store.renameSnapshot(decodeURIComponent(snapshot[1]), body.name));
    return;
  }
  const trashRestore = pathname.match(/^\/api\/trash\/([^/]+)\/restore$/);
  if (trashRestore && method === 'POST') { sendJson(response, 200, await store.restoreSnapshot(decodeURIComponent(trashRestore[1]))); return; }
  const trashDelete = pathname.match(/^\/api\/trash\/([^/]+)$/);
  if (trashDelete && method === 'DELETE') { sendJson(response, 200, await store.permanentlyDeleteTrashedSnapshot(decodeURIComponent(trashDelete[1]))); return; }
  const resume = pathname.match(/^\/api\/resumes\/([^/]+)$/);
  if (resume && method === 'DELETE') {
    const body = await readJson(request);
    sendJson(response, 200, await store.deleteEmptyResume(decodeURIComponent(resume[1]), body.previousResumeId, body.expectedDraft));
    return;
  }
  if (resume && method === 'GET') { sendJson(response, 200, { resume: await store.getResume(decodeURIComponent(resume[1])) }); return; }
  if (resume && method === 'PATCH') {
    const body = await readJson(request);
    sendJson(response, 200, await store.renameResume(decodeURIComponent(resume[1]), body.name));
    return;
  }
  sendJson(response, 404, { error: '找不到这个操作。' });
}

const server = createServer(async (request, response) => {
  const hostHeader = request.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(hostHeader)) { send(response, 403, '只允许本机使用。'); return; }
  let url;
  try { url = new URL(request.url || '/', 'http://' + hostHeader); }
  catch { send(response, 400, '请求地址格式不正确。'); return; }
  try {
    if (url.pathname.startsWith('/api/')) { await handleApi(request, response, url); return; }
    if (!['GET', 'HEAD'].includes(request.method || '')) { send(response, 405, '此页面不支持该操作。'); return; }
    const filePath = await resolveStaticPath(url.pathname);
    if (!filePath) { send(response, 403, '禁止访问此路径。'); return; }
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) throw new Error('not a file');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store', 'Content-Length': body.byteLength,
      'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (response.headersSent) { response.destroy(); return; }
    const status = error.status || (error.code === 'NOT_FOUND' ? 404 : 500);
    if (url.pathname.startsWith('/api/')) sendJson(response, status, { error: error.message || '本机操作失败。', code: error.code || 'INTERNAL_ERROR' });
    else send(response, status, url.pathname === '/' ? '简历正在启动，请稍后重新打开。' : '未找到此页面。');
  }
});

server.listen(port, host, () => {
  const address = server.address();
  process.stdout.write('RESUME_READY http://' + host + ':' + address.port + '\n');
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
