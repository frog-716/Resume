import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { createEmptyResumeContent, validateResumeContent } from "../src/domain/resume-content.mjs";

const STORE_FILE = "resume-library.json";
const STORE_VERSION = 1;
const MAX_STORE_BYTES = 50 * 1024 * 1024;

export const DEFAULT_RESUME_LAYOUT = Object.freeze({
  marginsMm: Object.freeze({ top: 9, right: 9, bottom: 9, left: 9 }),
});

/** A user-facing, machine-readable storage error. */
export class ResumeStoreError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "ResumeStoreError";
    this.code = code;
  }
}

/**
 * Open the local resume library. The directory is supplied by the host app:
 * development may use `<project>/data`, while the Mac app should pass
 * `~/Library/Application Support/Resume` via RESUME_DATA_DIR.
 *
 * `initialContent` is only used on the first launch. The default is a blank
 * document; a caller may explicitly pass a synthetic fixture for a demo.
 */
export class ResumeStore {
  #directory;
  #file;
  #state;
  #tail = Promise.resolve();

  static async open({
    dataDir,
    initialName = "未命名简历",
    initialContent = createEmptyResumeContent(),
    initialLayout = DEFAULT_RESUME_LAYOUT,
    now = () => new Date(),
  } = {}) {
    if (typeof dataDir !== "string" || dataDir.trim() === "") {
      throw new TypeError("dataDir must be a non-empty local directory path");
    }

    const store = new ResumeStore(path.resolve(dataDir));
    await mkdir(store.#directory, { recursive: true, mode: 0o700 });

    let serialized;
    try {
      const fileInfo = await stat(store.#file);
      if (fileInfo.size > MAX_STORE_BYTES) {
        throw new ResumeStoreError("STORE_TOO_LARGE", "本机简历资料文件过大，已停止读取以保护原文件。");
      }
      serialized = await readFile(store.#file, "utf8");
    } catch (error) {
      if (error instanceof ResumeStoreError) throw error;
      if (error.code !== "ENOENT") {
        throw new ResumeStoreError("STORE_READ_FAILED", `读取本机简历资料失败：${error.message}`, { cause: error });
      }
    }

    if (serialized !== undefined) {
      let parsed;
      try {
        parsed = JSON.parse(serialized);
      } catch (error) {
        throw new ResumeStoreError("STORE_CORRUPT", `本机简历资料无法读取，原文件已保留：${error.message}`, { cause: error });
      }
      const validation = validateStoreState(parsed);
      if (!validation.valid) {
        throw new ResumeStoreError(
          "STORE_CORRUPT",
          `本机简历资料格式无法识别，原文件已保留。${validation.errors[0] ? ` ${validation.errors[0]}` : ""}`,
        );
      }
      store.#state = jsonClone(parsed);
      return store;
    }

    const createdAt = toIso(now());
    const firstResume = {
      id: randomUUID(),
      name: requireName(initialName, "简历名称"),
      createdAt,
      currentDraft: {
        content: cloneContent(initialContent),
        layout: cloneJsonObject(initialLayout, "layout"),
        updatedAt: createdAt,
      },
      snapshots: [],
    };
    store.#state = {
      schemaVersion: STORE_VERSION,
      lastOpenedResumeId: firstResume.id,
      resumes: [firstResume],
      trash: [],
    };
    await store.#persist(store.#state);
    return store;
  }

  constructor(directory) {
    this.#directory = directory;
    this.#file = path.join(directory, STORE_FILE);
  }

  /** The full library, including drafts, snapshots, and trashed snapshots. */
  getState() {
    return this.#run(() => jsonClone(this.#state));
  }

  /** Resume cards sorted by their current-draft edit time, newest first. */
  listResumes() {
    return this.#run(() => [...this.#state.resumes]
      .sort((a, b) => b.currentDraft.updatedAt.localeCompare(a.currentDraft.updatedAt))
      .map((resume) => jsonClone(resume)));
  }

  getResume(resumeId) {
    return this.#run(() => {
      const resume = findResume(this.#state, resumeId);
      return jsonClone(resume);
    });
  }

  /** Record which current draft the next app launch should reopen. */
  setLastOpenedResume(resumeId) {
    return this.#mutate((state) => {
      findResume(state, resumeId);
      state.lastOpenedResumeId = resumeId;
      return { lastOpenedResumeId: resumeId };
    });
  }

  /** Replace only the live draft. Snapshots are never changed by this call. */
  saveCurrentDraft(resumeId, { content, layout = DEFAULT_RESUME_LAYOUT } = {}, { now = () => new Date() } = {}) {
    return this.#mutate((state) => {
      const resume = findResume(state, resumeId);
      const nextContent = cloneContent(content);
      const nextLayout = cloneJsonObject(layout, "layout");
      if (isDeepStrictEqual(resume.currentDraft.content, nextContent)
        && isDeepStrictEqual(resume.currentDraft.layout, nextLayout)) {
        return jsonClone(resume.currentDraft);
      }
      resume.currentDraft = {
        content: nextContent,
        layout: nextLayout,
        updatedAt: toIso(now()),
      };
      return jsonClone(resume.currentDraft);
    });
  }

  renameResume(resumeId, name) {
    return this.#mutate((state) => {
      const resume = findResume(state, resumeId);
      resume.name = requireName(name, "简历名称");
      return { id: resume.id, name: resume.name };
    });
  }

  /** Remove a newly-created, still-empty resume when the user undoes its creation. */
  deleteEmptyResume(resumeId, previousResumeId, expectedDraft) {
    return this.#mutate((state) => {
      const index = state.resumes.findIndex((resume) => resume.id === resumeId);
      if (index < 0) throw notFound("resume", resumeId);
      const resume = state.resumes[index];
      if (resume.snapshots.length) throw conflict("A resume with saved snapshots cannot be undone.");
      if (!expectedDraft
        || !isDeepStrictEqual(resume.currentDraft.content, expectedDraft.content)
        || !isDeepStrictEqual(resume.currentDraft.layout, expectedDraft.layout)) {
        throw conflict("The resume has changed since it was created and cannot be removed by undo.");
      }
      if (state.resumes.length < 2) throw conflict("The last resume cannot be removed.");
      if (!previousResumeId || previousResumeId === resumeId || !state.resumes.some((item) => item.id === previousResumeId)) {
        throw conflict("The previous resume is no longer available.");
      }
      state.resumes.splice(index, 1);
      if (state.lastOpenedResumeId === resumeId) state.lastOpenedResumeId = previousResumeId;
      return { deletedResumeId: resumeId, lastOpenedResumeId: state.lastOpenedResumeId };
    });
  }

  createResume({ name = "未命名简历", content = createEmptyResumeContent(), layout = DEFAULT_RESUME_LAYOUT } = {}, { now = () => new Date() } = {}) {
    return this.#mutate((state) => {
      const createdAt = toIso(now());
      const resume = {
        id: randomUUID(),
        name: requireName(name, "简历名称"),
        createdAt,
        currentDraft: {
          content: cloneContent(content),
          layout: cloneJsonObject(layout, "layout"),
          updatedAt: createdAt,
        },
        snapshots: [],
      };
      state.resumes.push(resume);
      state.lastOpenedResumeId = resume.id;
      return jsonClone(resume);
    });
  }

  /** Save a named, immutable copy of the current content and layout. */
  createSnapshot(resumeId, requestedName, { now = () => new Date() } = {}) {
    return this.#mutate((state) => {
      const resume = findResume(state, resumeId);
      const baseName = requireName(requestedName, "快照名称");
      const name = makeUniqueSnapshotName(state, baseName);
      const snapshot = {
        id: randomUUID(),
        resumeId,
        name,
        createdAt: toIso(now()),
        content: jsonClone(resume.currentDraft.content),
        layout: jsonClone(resume.currentDraft.layout),
      };
      resume.snapshots.push(snapshot);
      return jsonClone(snapshot);
    });
  }

  /** Rename the card only. Its captured content, layout, and saved time stay fixed. */
  renameSnapshot(snapshotId, requestedName) {
    return this.#mutate((state) => {
      const snapshot = findActiveSnapshot(state, snapshotId).snapshot;
      const baseName = requireName(requestedName, "快照名称");
      snapshot.name = makeUniqueSnapshotName(state, baseName, snapshot.id);
      return { id: snapshot.id, resumeId: snapshot.resumeId, name: snapshot.name };
    });
  }

  /** Move an active snapshot to the trash; content and original timestamp survive. */
  trashSnapshot(snapshotId, { now = () => new Date() } = {}) {
    return this.#mutate((state) => {
      const { resume, snapshot, index } = findActiveSnapshot(state, snapshotId);
      resume.snapshots.splice(index, 1);
      const trashed = { ...snapshot, trashedAt: toIso(now()) };
      state.trash.push(trashed);
      return jsonClone(trashed);
    });
  }

  restoreSnapshot(trashId) {
    return this.#mutate((state) => {
      const index = state.trash.findIndex((snapshot) => snapshot.id === trashId);
      if (index < 0) throw notFound("trash snapshot", trashId);
      const [trashed] = state.trash.splice(index, 1);
      const resume = findResume(state, trashed.resumeId);
      const { trashedAt: _trashedAt, ...snapshot } = trashed;
      resume.snapshots.push(snapshot);
      return jsonClone(snapshot);
    });
  }

  permanentlyDeleteTrashedSnapshot(trashId) {
    return this.#mutate((state) => {
      const index = state.trash.findIndex((snapshot) => snapshot.id === trashId);
      if (index < 0) throw notFound("trash snapshot", trashId);
      const [deleted] = state.trash.splice(index, 1);
      return { id: deleted.id, deleted: true };
    });
  }

  emptyTrash() {
    return this.#mutate((state) => {
      const deletedCount = state.trash.length;
      state.trash = [];
      return { deletedCount };
    });
  }

  /** Copy a snapshot into a wholly new resume with one editable current draft. */
  copySnapshotToNewResume(snapshotId, { now = () => new Date() } = {}) {
    return this.#mutate((state) => {
      const { resume: sourceResume, snapshot } = findActiveSnapshot(state, snapshotId);
      const createdAt = toIso(now());
      const copy = {
        id: randomUUID(),
        name: `${sourceResume.name}（副本）`,
        createdAt,
        currentDraft: {
          content: jsonClone(snapshot.content),
          layout: jsonClone(snapshot.layout),
          updatedAt: createdAt,
        },
        snapshots: [],
      };
      state.resumes.push(copy);
      state.lastOpenedResumeId = copy.id;
      return jsonClone(copy);
    });
  }

  async #mutate(change) {
    return this.#run(async () => {
      const next = jsonClone(this.#state);
      const result = change(next);
      const validation = validateStoreState(next);
      if (!validation.valid) {
        throw new ResumeStoreError("INVALID_CHANGE", `保存前检查失败：${validation.errors[0]}`);
      }
      if (isDeepStrictEqual(next, this.#state)) return jsonClone(result);
      await this.#persist(next);
      this.#state = next;
      return jsonClone(result);
    });
  }

  #run(operation) {
    const result = this.#tail.then(operation);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #persist(state) {
    const serialized = `${JSON.stringify(state, null, 2)}\n`;
    const bytes = Buffer.from(serialized, "utf8");
    if (bytes.byteLength > MAX_STORE_BYTES) {
      throw new ResumeStoreError("STORE_TOO_LARGE", "本机简历资料超过安全保存上限，内容仍留在编辑器中。");
    }

    const temporaryFile = path.join(this.#directory, `.${STORE_FILE}.${process.pid}.${randomUUID()}.tmp`);
    let handle;
    try {
      handle = await open(temporaryFile, "wx", 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryFile, this.#file);
      // Sync the directory entry too, so rename survives a sudden shutdown.
      const directoryHandle = await open(this.#directory, "r");
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await rm(temporaryFile, { force: true }).catch(() => {});
      if (error instanceof ResumeStoreError) throw error;
      throw new ResumeStoreError(
        "PERSISTENCE_FAILED",
        `本机保存失败：${error.message}。当前编辑器中的内容仍会保留，请稍后重试。`,
        { cause: error },
      );
    }
  }
}

function validateStoreState(state) {
  const errors = [];
  if (!isRecord(state)) return { valid: false, errors: ["Store root must be an object."] };
  if (state.schemaVersion !== STORE_VERSION) errors.push(`schemaVersion must be ${STORE_VERSION}.`);
  if (!Array.isArray(state.resumes)) errors.push("resumes must be an array.");
  if (!Array.isArray(state.trash)) errors.push("trash must be an array.");
  if (errors.length) return { valid: false, errors };

  const resumeIds = new Set();
  const snapshotIds = new Set();
  for (const [index, resume] of state.resumes.entries()) {
    const prefix = `resumes[${index}]`;
    if (!isRecord(resume)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    requireIdField(resume.id, `${prefix}.id`, errors, resumeIds);
    if (typeof resume.name !== "string" || resume.name.trim() === "") errors.push(`${prefix}.name must be non-empty.`);
    if (!isIsoDate(resume.createdAt)) errors.push(`${prefix}.createdAt must be an ISO timestamp.`);
    if (!isRecord(resume.currentDraft)) errors.push(`${prefix}.currentDraft must be an object.`);
    else {
      validateContent(resume.currentDraft.content, `${prefix}.currentDraft.content`, errors);
      validateLayout(resume.currentDraft.layout, `${prefix}.currentDraft.layout`, errors);
      if (!isIsoDate(resume.currentDraft.updatedAt)) errors.push(`${prefix}.currentDraft.updatedAt must be an ISO timestamp.`);
    }
    if (!Array.isArray(resume.snapshots)) {
      errors.push(`${prefix}.snapshots must be an array.`);
      continue;
    }
    for (const [snapshotIndex, snapshot] of resume.snapshots.entries()) {
      validateSnapshot(snapshot, `${prefix}.snapshots[${snapshotIndex}]`, resume.id, errors, snapshotIds);
    }
  }

  for (const [index, snapshot] of state.trash.entries()) {
    const prefix = `trash[${index}]`;
    if (!isRecord(snapshot)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    validateSnapshot(snapshot, prefix, snapshot.resumeId, errors, snapshotIds);
    if (!resumeIds.has(snapshot.resumeId)) errors.push(`${prefix}.resumeId must reference an existing resume.`);
    if (!isIsoDate(snapshot.trashedAt)) errors.push(`${prefix}.trashedAt must be an ISO timestamp.`);
  }

  if (state.resumes.length === 0) errors.push("At least one resume must remain.");
  if (!resumeIds.has(state.lastOpenedResumeId)) errors.push("lastOpenedResumeId must reference an existing resume.");
  return { valid: errors.length === 0, errors };
}

function validateSnapshot(snapshot, prefix, expectedResumeId, errors, ids) {
  if (!isRecord(snapshot)) {
    errors.push(`${prefix} must be an object.`);
    return;
  }
  requireIdField(snapshot.id, `${prefix}.id`, errors, ids);
  if (snapshot.resumeId !== expectedResumeId || typeof snapshot.resumeId !== "string") {
    errors.push(`${prefix}.resumeId must match its owning resume.`);
  }
  if (typeof snapshot.name !== "string" || snapshot.name.trim() === "") errors.push(`${prefix}.name must be non-empty.`);
  if (!isIsoDate(snapshot.createdAt)) errors.push(`${prefix}.createdAt must be an ISO timestamp.`);
  validateContent(snapshot.content, `${prefix}.content`, errors);
  validateLayout(snapshot.layout, `${prefix}.layout`, errors);
}

function validateContent(content, pathName, errors) {
  const result = validateResumeContent(content);
  if (!result.valid) errors.push(`${pathName}: ${result.errors[0]}`);
}

function validateLayout(layout, pathName, errors) {
  if (!isRecord(layout)) {
    errors.push(`${pathName} must be a JSON object.`);
    return;
  }
  try {
    const serialized = JSON.stringify(layout);
    if (serialized === undefined) errors.push(`${pathName} must be JSON serializable.`);
  } catch {
    errors.push(`${pathName} must be JSON serializable.`);
  }
}

function cloneContent(content) {
  const validation = validateResumeContent(content);
  if (!validation.valid) {
    throw new ResumeStoreError("INVALID_CONTENT", `简历内容格式不正确：${validation.errors[0]}`);
  }
  return jsonClone(content);
}

function cloneJsonObject(value, name) {
  if (!isRecord(value)) throw new ResumeStoreError("INVALID_DATA", `${name} must be a JSON object.`);
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new ResumeStoreError("INVALID_DATA", `${name} must be JSON serializable.`, { cause: error });
  }
  if (serialized === undefined) throw new ResumeStoreError("INVALID_DATA", `${name} must be JSON serializable.`);
  return JSON.parse(serialized);
}

function makeUniqueSnapshotName(state, requestedName, excludedId = undefined) {
  const existingNames = new Set();
  for (const resume of state.resumes) {
    for (const snapshot of resume.snapshots) {
      if (snapshot.id !== excludedId) existingNames.add(snapshot.name);
    }
  }
  for (const snapshot of state.trash) {
    if (snapshot.id !== excludedId) existingNames.add(snapshot.name);
  }

  if (!existingNames.has(requestedName)) return requestedName;
  let suffix = 1;
  let candidate;
  do {
    candidate = `${requestedName}（${suffix}）`;
    suffix += 1;
  } while (existingNames.has(candidate));
  return candidate;
}

function findResume(state, resumeId) {
  const resume = state.resumes.find((item) => item.id === resumeId);
  if (!resume) throw notFound("resume", resumeId);
  return resume;
}

function findActiveSnapshot(state, snapshotId) {
  for (const resume of state.resumes) {
    const index = resume.snapshots.findIndex((item) => item.id === snapshotId);
    if (index >= 0) return { resume, snapshot: resume.snapshots[index], index };
  }
  throw notFound("snapshot", snapshotId);
}

function notFound(kind, id) {
  return new ResumeStoreError("NOT_FOUND", `${kind} not found: ${id}`);
}

function conflict(message) {
  const error = new ResumeStoreError("CONFLICT", message);
  error.status = 409;
  return error;
}

function requireName(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ResumeStoreError("INVALID_NAME", `${label}不能为空。`);
  }
  const trimmed = value.trim();
  if (trimmed.length > 120) throw new ResumeStoreError("INVALID_NAME", `${label}不能超过120个字符。`);
  return trimmed;
}

function requireIdField(value, label, errors, seenIds) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} must be a non-empty string.`);
    return;
  }
  if (seenIds.has(value)) errors.push(`${label} duplicates id ${value}.`);
  seenIds.add(value);
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("now must return a valid date");
  return date.toISOString();
}

function isIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}
