// import-source.mjs 单元测试：File System Access 权限状态机 + IndexedDB 存取 + 降级路径。
// 运行：node --test extension/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  supportsFileSystemAccess, pickImportFile, createImportSourceStore, readTextFromHandle,
} from './import-source.mjs';

// ---- fake FileSystemFileHandle ----
function makeHandle(name, { permission = 'granted', requestResult = true } = {}) {
  return {
    name,
    queryPermission: async () => permission,
    requestPermission: async () => requestResult,
    getFile: async () => ({ text: async () => `内容来自 ${name}` }),
  };
}

test('readTextFromHandle：已授权直接读，不请求权限', async () => {
  const handle = makeHandle('a.json', { permission: 'granted' });
  assert.equal(await readTextFromHandle(handle), '内容来自 a.json');
});

test('readTextFromHandle：未授权且 interactive → 请求授权后读', async () => {
  const handle = makeHandle('b.json', { permission: 'prompt', requestResult: true });
  assert.equal(await readTextFromHandle(handle), '内容来自 b.json');
});

test('readTextFromHandle：用户拒绝授权 → PERMISSION_DENIED', async () => {
  const handle = makeHandle('c.json', { permission: 'prompt', requestResult: false });
  await assert.rejects(() => readTextFromHandle(handle), /PERMISSION_DENIED/);
});

test('readTextFromHandle：非交互模式未授权 → NEED_PERMISSION，不弹授权', async () => {
  const handle = makeHandle('d.json', { permission: 'prompt' });
  await assert.rejects(() => readTextFromHandle(handle, { interactive: false }), /NEED_PERMISSION/);
});

test('readTextFromHandle：无效句柄 → 明确错误', async () => {
  await assert.rejects(() => readTextFromHandle(null), /来源句柄无效/);
});

// ---- fake IndexedDB（内存版，验证存取语义）----
function makeFakeIdb() {
  const data = new Map();
  let created = false;
  return {
    data,
    open() {
      const listeners = {};
      const request = {
        result: null, error: null,
        set onupgradeneeded(fn) { listeners.upgrade = fn; },
        set onsuccess(fn) { listeners.success = fn; },
        set onerror(fn) { listeners.error = fn; },
      };
      const db = {
        objectStoreNames: { contains: (name) => created && name === 'import-sources' },
        createObjectStore() { created = true; },
        transaction() {
          const os = {
            put(record, key) { data.set(key, record); },
            get(key) {
              const req = { result: data.get(key) || null, onsuccess: null };
              queueMicrotask(() => req.onsuccess && req.onsuccess());
              return req;
            },
            delete(key) { data.delete(key); },
          };
          return {
            objectStore: () => os,
            set oncomplete(fn) { queueMicrotask(() => fn && fn()); },
            set onerror(fn) {},
            set onabort(fn) {},
          };
        },
        close() {},
      };
      request.result = db;
      queueMicrotask(() => { listeners.upgrade && listeners.upgrade(); listeners.success && listeners.success(); });
      return request;
    },
  };
}

test('store：save → load roundtrip 保留 fileName 与 handle', async () => {
  const idb = makeFakeIdb();
  const store = createImportSourceStore(idb);
  await store.save({ fileName: 'x.json', savedAt: 'T0', handle: makeHandle('x.json') });
  const loaded = await store.load();
  assert.equal(loaded.fileName, 'x.json');
  assert.equal(loaded.savedAt, 'T0');
  assert.equal(loaded.handle.name, 'x.json');
});

test('store：clear 后 load 返回 null', async () => {
  const idb = makeFakeIdb();
  const store = createImportSourceStore(idb);
  await store.save({ fileName: 'y.json', savedAt: 'T0', handle: makeHandle('y.json') });
  await store.clear();
  assert.equal(await store.load(), null);
});

test('store：空库 load 返回 null', async () => {
  const store = createImportSourceStore(makeFakeIdb());
  assert.equal(await store.load(), null);
});

test('store：无 IndexedDB 环境 → save 明确报错，其余静默降级', async () => {
  const store = createImportSourceStore(null);
  await assert.rejects(() => store.save({}), /不支持 IndexedDB/);
  assert.equal(await store.load(), null);
  await store.clear(); // 不抛
});

// ---- pickImportFile / supportsFileSystemAccess 依赖全局，测完还原 ----
test('pickImportFile：用户取消（AbortError）→ undefined，不回退 input', async () => {
  const original = globalThis.showOpenFilePicker;
  globalThis.showOpenFilePicker = async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; };
  globalThis.indexedDB = {};
  try {
    assert.equal(await pickImportFile(), undefined);
  } finally {
    globalThis.showOpenFilePicker = original; delete globalThis.indexedDB;
  }
});

test('pickImportFile：非 Abort 错误 → null，调用方回退 input', async () => {
  const original = globalThis.showOpenFilePicker;
  globalThis.showOpenFilePicker = async () => { throw new Error('SecurityError'); };
  globalThis.indexedDB = {};
  try {
    assert.equal(await pickImportFile(), null);
  } finally {
    globalThis.showOpenFilePicker = original; delete globalThis.indexedDB;
  }
});

test('pickImportFile：成功选取 → 返回 handle', async () => {
  const original = globalThis.showOpenFilePicker;
  const handle = makeHandle('z.json');
  globalThis.showOpenFilePicker = async () => [handle];
  globalThis.indexedDB = {};
  try {
    assert.equal(await pickImportFile(), handle);
  } finally {
    globalThis.showOpenFilePicker = original; delete globalThis.indexedDB;
  }
});

test('pickImportFile：无 File System Access → null（走 input 降级）', async () => {
  assert.equal(supportsFileSystemAccess(), false);
  assert.equal(await pickImportFile(), null);
});
