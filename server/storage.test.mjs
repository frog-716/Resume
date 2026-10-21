import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSampleResumeContent } from "../src/domain/resume-content.mjs";
import { ResumeStore, ResumeStoreError } from "./storage.mjs";

async function withStore(run, options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "resume-store-test-"));
  try {
    const store = await ResumeStore.open({ dataDir, ...options });
    await run({ dataDir, store });
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

function makeTime(minute) {
  return () => new Date(`2026-10-16T10:${String(minute).padStart(2, "0")}:00.000Z`);
}

function changedContent(content, value) {
  const next = structuredClone(content);
  next.sections[0].bullets[0].html = value;
  return next;
}

test("creates a blank local resume and persists it atomically for the next launch", async () => {
  await withStore(async ({ dataDir, store }) => {
    const initial = await store.getState();
    assert.equal(initial.resumes.length, 1);
    assert.equal(initial.resumes[0].name, "未命名简历");
    assert.equal(initial.resumes[0].currentDraft.content.sections[0].bullets.length, 0);
    assert.equal(initial.resumes[0].currentDraft.layout.marginsMm.top, 9);

    const resumeId = initial.resumes[0].id;
    const content = createSampleResumeContent();
    await store.saveCurrentDraft(resumeId, { content }, { now: makeTime(3) });
    await store.setLastOpenedResume(resumeId);

    const reopened = await ResumeStore.open({ dataDir });
    const state = await reopened.getState();
    assert.equal(state.lastOpenedResumeId, resumeId);
    assert.equal(state.resumes[0].currentDraft.content.identity.name.html, "林舟");
    assert.equal(state.resumes[0].currentDraft.updatedAt, "2026-10-16T10:03:00.000Z");
  });
});

test("autosaves only the current draft and never changes an existing snapshot", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [resume] } = await store.getState();
    const content = createSampleResumeContent();
    await store.saveCurrentDraft(resume.id, { content }, { now: makeTime(1) });
    const snapshot = await store.createSnapshot(resume.id, "第一版", { now: makeTime(2) });

    await store.saveCurrentDraft(resume.id, { content: changedContent(content, "后来修改") }, { now: makeTime(3) });
    const after = await store.getResume(resume.id);
    assert.equal(after.currentDraft.content.sections[0].bullets[0].html, "后来修改");
    assert.equal(after.snapshots[0].content.sections[0].bullets[0].html, "熟悉前端页面开发与组件拆分");
    assert.equal(after.snapshots[0].createdAt, snapshot.createdAt);
    assert.equal(after.currentDraft.updatedAt, "2026-10-16T10:03:00.000Z");
  });
});

test("saving an unchanged draft does not make it look recently edited", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [resume] } = await store.getState();
    const content = createSampleResumeContent();
    const layout = { marginsMm: { top: 9, right: 9, bottom: 9, left: 9 }, bodyPt: 10.5, slack: 0 };
    await store.saveCurrentDraft(resume.id, { content, layout }, { now: makeTime(1) });

    const repeatedSave = await store.saveCurrentDraft(resume.id, {
      content: structuredClone(content),
      layout: structuredClone(layout),
    }, { now: makeTime(9) });

    assert.equal(repeatedSave.updatedAt, "2026-10-16T10:01:00.000Z");
    assert.equal((await store.getResume(resume.id)).currentDraft.updatedAt, "2026-10-16T10:01:00.000Z");
  });
});

test("snapshot names gain Chinese number suffixes, including names held in trash", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [resume] } = await store.getState();
    const first = await store.createSnapshot(resume.id, "初稿", { now: makeTime(1) });
    const second = await store.createSnapshot(resume.id, "初稿", { now: makeTime(2) });
    const third = await store.createSnapshot(resume.id, "初稿", { now: makeTime(3) });
    assert.deepEqual([first.name, second.name, third.name], ["初稿", "初稿（1）", "初稿（2）"]);

    await store.trashSnapshot(second.id, { now: makeTime(4) });
    const fourth = await store.createSnapshot(resume.id, "初稿", { now: makeTime(5) });
    assert.equal(fourth.name, "初稿（3）");
  });
});

test("renaming a resume updates its label but leaves snapshot name and content alone", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [resume] } = await store.getState();
    const snapshot = await store.createSnapshot(resume.id, "林舟简历-10月");
    await store.renameResume(resume.id, "产品运营简历");

    const renamed = await store.getResume(resume.id);
    assert.equal(renamed.name, "产品运营简历");
    assert.equal(renamed.snapshots[0].name, "林舟简历-10月");
    assert.deepEqual(renamed.snapshots[0].content, snapshot.content);
  });
});

test("copying a snapshot creates an independent resume and preserves the original", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [original] } = await store.getState();
    const content = createSampleResumeContent();
    const layout = { marginsMm: { top: 9, right: 9, bottom: 9, left: 9 }, view: "fit" };
    await store.saveCurrentDraft(original.id, { content, layout }, { now: makeTime(1) });
    const snapshot = await store.createSnapshot(original.id, "确定版", { now: makeTime(2) });

    const copy = await store.copySnapshotToNewResume(snapshot.id, { now: makeTime(3) });
    assert.notEqual(copy.id, original.id);
    assert.equal(copy.name, "未命名简历（副本）");
    assert.deepEqual(copy.currentDraft.content, snapshot.content);
    assert.deepEqual(copy.currentDraft.layout, snapshot.layout);
    assert.equal(copy.snapshots.length, 0);

    const changedCopy = changedContent(copy.currentDraft.content, "副本里的修改");
    await store.saveCurrentDraft(copy.id, { content: changedCopy }, { now: makeTime(4) });
    const state = await store.getState();
    const untouchedOriginal = state.resumes.find((item) => item.id === original.id);
    assert.equal(untouchedOriginal.currentDraft.content.sections[0].bullets[0].html, "熟悉前端页面开发与组件拆分");
    assert.equal(untouchedOriginal.snapshots[0].content.sections[0].bullets[0].html, "熟悉前端页面开发与组件拆分");
  });
});

test("undo can remove a new empty resume but protects one that already has a snapshot", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [original] } = await store.getState();
    const emptyCopy = await store.createResume({ name: "空白副本" });
    const baseline = { content: emptyCopy.currentDraft.content, layout: emptyCopy.currentDraft.layout };
    const deleted = await store.deleteEmptyResume(emptyCopy.id, original.id, baseline);
    assert.equal(deleted.deletedResumeId, emptyCopy.id);
    assert.equal(deleted.lastOpenedResumeId, original.id);
    assert.deepEqual((await store.getState()).resumes.map((item) => item.id), [original.id]);

    const snapshot = await store.createSnapshot(original.id, "只读快照");
    const protectedCopy = await store.copySnapshotToNewResume(snapshot.id);
    await store.createSnapshot(protectedCopy.id, "副本已留快照");
    await assert.rejects(
      store.deleteEmptyResume(protectedCopy.id, original.id, {
        content: protectedCopy.currentDraft.content,
        layout: protectedCopy.currentDraft.layout,
      }),
      (error) => error.code === "CONFLICT" && error.status === 409,
    );
    assert.equal((await store.getResume(protectedCopy.id)).id, protectedCopy.id);
  });
});

test("undo refuses to delete a new resume after its draft no longer matches the creation baseline", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [original] } = await store.getState();
    const created = await store.createResume({ name: "空白副本", content: createSampleResumeContent() });
    const expectedDraft = { content: created.currentDraft.content, layout: created.currentDraft.layout };
    const editedContent = changedContent(created.currentDraft.content, "新增内容");
    await store.saveCurrentDraft(created.id, { content: editedContent });

    await assert.rejects(
      store.deleteEmptyResume(created.id, original.id, expectedDraft),
      (error) => error.code === "CONFLICT" && error.status === 409,
    );
    assert.deepEqual((await store.getResume(created.id)).currentDraft.content, editedContent);
  });
});

test("snapshot trash can restore, permanently delete one item, and empty the rest", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [resume] } = await store.getState();
    const first = await store.createSnapshot(resume.id, "待删除一");
    const second = await store.createSnapshot(resume.id, "待删除二");
    const trashedFirst = await store.trashSnapshot(first.id, { now: makeTime(1) });
    await store.trashSnapshot(second.id, { now: makeTime(2) });

    const restored = await store.restoreSnapshot(trashedFirst.id);
    assert.equal(restored.id, first.id);
    assert.equal(restored.createdAt, first.createdAt);
    assert.equal((await store.getResume(resume.id)).snapshots.length, 1);

    const deleted = await store.permanentlyDeleteTrashedSnapshot(second.id);
    assert.equal(deleted.deleted, true);
    assert.equal((await store.getState()).trash.length, 0);
  });
});

test("writes are serialized so closely spaced autosaves do not overwrite newer state", async () => {
  await withStore(async ({ store }) => {
    const { resumes: [resume] } = await store.getState();
    const base = createSampleResumeContent();
    const saves = [1, 2, 3].map((index) => store.saveCurrentDraft(
      resume.id,
      { content: changedContent(base, `第${index}次`) },
      { now: makeTime(index) },
    ));
    await Promise.all(saves);
    const current = await store.getResume(resume.id);
    assert.equal(current.currentDraft.content.sections[0].bullets[0].html, "第3次");
    assert.equal(current.currentDraft.updatedAt, "2026-10-16T10:03:00.000Z");
  });
});

test("invalid content and a failed disk write leave the last good data intact", async () => {
  await withStore(async ({ dataDir, store }) => {
    const { resumes: [resume] } = await store.getState();
    const good = createSampleResumeContent();
    await store.saveCurrentDraft(resume.id, { content: good }, { now: makeTime(1) });
    const filePath = path.join(dataDir, "resume-library.json");
    const before = await readFile(filePath, "utf8");

    const invalid = structuredClone(good);
    invalid.sections[0].bullets[0].html = "<script>bad</script>";
    await assert.rejects(
      store.saveCurrentDraft(resume.id, { content: invalid }),
      (error) => error instanceof ResumeStoreError && error.code === "INVALID_CONTENT",
    );
    assert.equal(await readFile(filePath, "utf8"), before);

    const movedDir = `${dataDir}-moved`;
    await rename(dataDir, movedDir);
    await writeFile(dataDir, "block the storage directory");
    await assert.rejects(
      store.saveCurrentDraft(resume.id, { content: changedContent(good, "尚未落盘") }),
      (error) => error instanceof ResumeStoreError && error.code === "PERSISTENCE_FAILED",
    );
    assert.equal((await store.getResume(resume.id)).currentDraft.content.sections[0].bullets[0].html, "熟悉前端页面开发与组件拆分");
    await rm(dataDir, { force: true });
    await rename(movedDir, dataDir);
    assert.equal(await readFile(filePath, "utf8"), before);
  });
});

test("refuses to overwrite an unreadable library file", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "resume-store-corrupt-"));
  try {
    const filePath = path.join(dataDir, "resume-library.json");
    await writeFile(filePath, "not json");
    await assert.rejects(
      ResumeStore.open({ dataDir }),
      (error) => error instanceof ResumeStoreError && error.code === "STORE_CORRUPT",
    );
    assert.equal(await readFile(filePath, "utf8"), "not json");
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
