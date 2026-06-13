import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeishuSavedContentTarget,
  createSavedContentRecord,
  findSavedContentRecord,
  getDueReviewRecords,
  getRecentSavedContentRecords,
  normalizeSavedContentUrl,
  upsertSavedContentRecord,
} from '../src/utils/savedContent.ts';
import {
  createExtensionUpdateNotice,
  dismissExtensionUpdateNotice,
  shouldClearUpdateBadgeOnLaunch,
} from '../src/utils/updateNotice.ts';

const tableA = {
  id: 'config-a',
  name: '资料库 A',
  appToken: 'app_token',
  tableId: 'tbl_a',
  tableUrl: 'https://feishu.cn/base/app_token?table=tbl_a',
};

const tableB = {
  ...tableA,
  id: 'config-b',
  name: '资料库 B',
  tableId: 'tbl_b',
};

test('normalizeSavedContentUrl ignores fragments and common tracking params', () => {
  assert.equal(
    normalizeSavedContentUrl('https://EXAMPLE.com/articles/one/?utm_source=news&b=2#section'),
    'https://example.com/articles/one?b=2'
  );
});

test('findSavedContentRecord matches the same normalized URL only for the same Feishu table', () => {
  const targetA = buildFeishuSavedContentTarget(tableA);
  const targetB = buildFeishuSavedContentTarget(tableB);
  const record = createSavedContentRecord({
    content: {
      title: 'Same page',
      url: 'https://example.com/articles/one?b=2&utm_campaign=launch',
    },
    target: targetA,
    savedAt: '2026-05-26T08:00:00.000Z',
    result: {
      success: true,
      recordId: 'rec_1',
      tableUrl: tableA.tableUrl,
    },
  });

  assert.equal(
    findSavedContentRecord([record], 'https://example.com/articles/one/?utm_source=another&b=2#intro', targetA)?.recordId,
    'rec_1'
  );
  assert.equal(
    findSavedContentRecord([record], 'https://example.com/articles/one?b=2', targetB),
    undefined
  );
});

test('upsertSavedContentRecord replaces the existing entry and keeps newest records first', () => {
  const target = buildFeishuSavedContentTarget(tableA);
  const first = createSavedContentRecord({
    content: { title: 'Old title', url: 'https://example.com/articles/one' },
    target,
    savedAt: '2026-05-26T08:00:00.000Z',
    result: { success: true, recordId: 'rec_old' },
  });
  const second = createSavedContentRecord({
    content: { title: 'New title', url: 'https://example.com/articles/two' },
    target,
    savedAt: '2026-05-26T09:00:00.000Z',
    result: { success: true, recordId: 'rec_two' },
  });
  const updated = createSavedContentRecord({
    content: { title: 'Updated title', url: 'https://example.com/articles/one#later' },
    target,
    savedAt: '2026-05-26T10:00:00.000Z',
    result: { success: true, recordId: 'rec_new' },
  });

  const records = upsertSavedContentRecord(upsertSavedContentRecord([first], second), updated);

  assert.deepEqual(records.map(record => record.recordId), ['rec_new', 'rec_two']);
  assert.equal(records[0].title, 'Updated title');
});

test('saved content records keep review metadata and due reviews are sorted by review date', () => {
  const target = buildFeishuSavedContentTarget(tableA);
  const later = createSavedContentRecord({
    content: { title: 'Later', url: 'https://example.com/later' },
    target,
    metadata: { status: '待读', reviewAt: '2026-06-13' },
    savedAt: '2026-06-12T08:00:00.000Z',
  });
  const earlier = createSavedContentRecord({
    content: { title: 'Earlier', url: 'https://example.com/earlier' },
    target,
    metadata: { status: '未处理', reviewAt: '2026-06-12' },
    savedAt: '2026-06-11T08:00:00.000Z',
  });
  const future = createSavedContentRecord({
    content: { title: 'Future', url: 'https://example.com/future' },
    target,
    metadata: { status: '未处理', reviewAt: '2026-06-14' },
    savedAt: '2026-06-13T08:00:00.000Z',
  });

  assert.deepEqual(
    getDueReviewRecords([later, future, earlier], new Date(2026, 5, 13)).map(record => record.title),
    ['Earlier', 'Later']
  );
  assert.equal(later.status, '待读');
  assert.equal(later.reviewAt, '2026-06-13');
});

test('recent saved content records are sorted by saved time and limited', () => {
  const target = buildFeishuSavedContentTarget(tableA);
  const older = createSavedContentRecord({
    content: { title: 'Older', url: 'https://example.com/older' },
    target,
    savedAt: '2026-06-11T08:00:00.000Z',
  });
  const newer = createSavedContentRecord({
    content: { title: 'Newer', url: 'https://example.com/newer' },
    target,
    savedAt: '2026-06-13T08:00:00.000Z',
  });

  assert.deepEqual(
    getRecentSavedContentRecords([older, newer], 1).map(record => record.title),
    ['Newer']
  );
});

test('createExtensionUpdateNotice only creates an active notice for update events', () => {
  assert.equal(
    createExtensionUpdateNotice({
      reason: 'install',
      version: '0.5.5',
      previousVersion: undefined,
      createdAt: 1770000000000,
    }),
    null
  );

  assert.deepEqual(
    createExtensionUpdateNotice({
      reason: 'update',
      version: '0.5.5',
      previousVersion: '0.5.2',
      createdAt: 1770000000000,
    }),
    {
      version: '0.5.5',
      previousVersion: '0.5.2',
      createdAt: 1770000000000,
      dismissed: false,
      title: 'Save to Feishu 已更新',
      highlights: [
        '新增最近保存与待回顾中心',
        '资料库模板现在可以安全分享',
      ],
    }
  );
});

test('dismissExtensionUpdateNotice marks the active notice as dismissed', () => {
  const notice = createExtensionUpdateNotice({
    reason: 'update',
    version: '0.5.5',
    previousVersion: '0.5.2',
    createdAt: 1770000000000,
  });

  assert.equal(dismissExtensionUpdateNotice(notice)?.dismissed, true);
});

test('shouldClearUpdateBadgeOnLaunch only clears badge for an active update notice', () => {
  const notice = createExtensionUpdateNotice({
    reason: 'update',
    version: '0.5.5',
    previousVersion: '0.5.2',
    createdAt: 1770000000000,
  });

  assert.equal(shouldClearUpdateBadgeOnLaunch(notice), true);
  assert.equal(shouldClearUpdateBadgeOnLaunch(dismissExtensionUpdateNotice(notice)), false);
  assert.equal(shouldClearUpdateBadgeOnLaunch(null), false);
});
