// 导入来源持久化：记住用户上次导入的 JSON 文件，使"导入的路径"在会话之间可靠保留。
//
// 背景：<input type="file"> 不保留任何来源信息，每次重开扩展都要重新走一遍
// 文件选择器（隐藏目录还要 ⌘⇧G 贴路径）。File System Access API 的
// FileSystemFileHandle 可结构化克隆进 IndexedDB 持久保存，重开会话后：
//   - 有读权限 → 直接读同一文件，一键重新导入；
//   - 权限过期 → 用户点一次"重新导入"即可在手势内重新授权；
//   - 环境不支持 → 降级为只记录文件名（展示用），重新导入走文件选择器。
//
// chrome.storage 不能存 FileSystemFileHandle（不可 JSON 序列化），
// 因此 handle 走 IndexedDB，文件名/时间等元数据随主 store 走 chrome.storage。

const DB_NAME = 'resume-extension';
const DB_VERSION = 1;
const STORE_NAME = 'import-sources';
const HANDLE_KEY = 'last-import';

export function supportsFileSystemAccess() {
  return typeof globalThis.showOpenFilePicker === 'function' && typeof globalThis.indexedDB === 'object';
}

/**
 * 打开文件选择器选取导入文件。
 * @returns {Promise<FileSystemFileHandle|undefined|null>}
 *   handle  = 用户选了文件；undefined = 用户取消；null = 不支持或出错（调用方回退 input）
 */
export async function pickImportFile() {
  if (!supportsFileSystemAccess()) return null;
  try {
    const [handle] = await globalThis.showOpenFilePicker({
      types: [{ description: 'JSON 简历文件', accept: { 'application/json': ['.json'] } }],
      multiple: false,
      id: 'resume-import', // 同一 id 让 Chrome 记住上次所在目录
    });
    return handle || null;
  } catch (error) {
    if (error && error.name === 'AbortError') return undefined;
    return null;
  }
}

/** 打开（必要时创建）IndexedDB。openDb 可注入，便于测试。 */
export function createImportSourceStore(idbFactory = globalThis.indexedDB) {
  if (!idbFactory) {
    return {
      save: async () => { throw new Error('当前环境不支持 IndexedDB，无法记住导入来源'); },
      load: async () => null,
      clear: async () => {},
    };
  }
  const openDb = () => new Promise((resolve, reject) => {
    const request = idbFactory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('打开 IndexedDB 失败'));
  });
  return {
    async save(record) {
      const db = await openDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record, HANDLE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('写入导入来源失败'));
          tx.onabort = () => reject(tx.error || new Error('写入导入来源被中止'));
        });
      } finally { db.close(); }
    },
    async load() {
      const db = await openDb();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error('读取导入来源失败'));
        });
      } finally { db.close(); }
    },
    async clear() {
      const db = await openDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('清理导入来源失败'));
        });
      } finally { db.close(); }
    },
  };
}

const defaultStore = createImportSourceStore();

export function saveImportHandle(handle) {
  return defaultStore.save({ fileName: handle.name, savedAt: new Date().toISOString(), handle });
}

export function loadImportSource() {
  return defaultStore.load();
}

export function clearImportSource() {
  return defaultStore.clear();
}

/**
 * 从已持久化的 handle 读文件文本。
 * 权限状态机：queryPermission 已授权 → 直接读；未授权且 interactive →
 * requestPermission（必须在用户手势的同步链内调用）；拒绝则抛错，
 * 调用方提示用户改用"导入"按钮重新选文件。
 */
export async function readTextFromHandle(handle, { interactive = true } = {}) {
  const options = { mode: 'read' };
  if (!handle || typeof handle.queryPermission !== 'function') throw new Error('来源句柄无效，请用“导入”按钮重新选择文件。');
  // queryPermission 返回 'granted' | 'denied' | 'prompt'，只有 granted 才能直接读；
  // 'prompt'/'denied' 都需要重新请求权限。
  if ((await handle.queryPermission(options)) !== 'granted') {
    if (!interactive) throw new Error('NEED_PERMISSION');
    const granted = await handle.requestPermission(options);
    if (!granted) throw new Error('PERMISSION_DENIED');
  }
  const file = await handle.getFile();
  return await file.text();
}
