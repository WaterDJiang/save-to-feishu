import type {
  ExtractedPageContent,
  KnowledgeMetadata,
  SaveResult,
  SavedContentRecord,
  SavedContentTarget,
  TableConfig,
} from '@/types';

export const SAVED_CONTENT_HISTORY_LIMIT = 300;

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'spm',
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

export function normalizeSavedContentUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    url.hash = '';

    const params = Array.from(url.searchParams.entries())
      .filter(([name]) => !isTrackingParam(name))
      .sort(([nameA, valueA], [nameB, valueB]) => {
        const byName = nameA.localeCompare(nameB);
        return byName === 0 ? valueA.localeCompare(valueB) : byName;
      });

    url.search = '';
    params.forEach(([name, paramValue]) => url.searchParams.append(name, paramValue));

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    const normalized = url.toString();
    return url.pathname === '/' && !url.search
      ? normalized.replace(/\/$/, '')
      : normalized;
  } catch {
    return trimmed.replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

export function buildFeishuSavedContentTarget(
  table: Pick<TableConfig, 'id' | 'name' | 'appToken' | 'tableId' | 'tableUrl'>
): SavedContentTarget {
  const tableIdentity = table.appToken && table.tableId
    ? `${table.appToken}:${table.tableId}`
    : `config:${table.id}`;

  return {
    type: 'feishu',
    id: `feishu:${tableIdentity}`,
    name: table.name,
    tableConfigId: table.id,
    appToken: table.appToken,
    tableId: table.tableId,
    tableUrl: table.tableUrl,
  };
}

export function buildMarkdownSavedContentTarget(): SavedContentTarget {
  return {
    type: 'markdown',
    id: 'markdown:local',
    name: '本地 Markdown',
  };
}

export function getSavedContentKey(url: string, target: SavedContentTarget): string {
  return `${target.id}::${normalizeSavedContentUrl(url)}`;
}

export function createSavedContentRecord({
  content,
  target,
  result,
  metadata,
  savedAt = new Date().toISOString(),
}: {
  content: Pick<ExtractedPageContent, 'url' | 'title'>;
  target: SavedContentTarget;
  result?: SaveResult;
  metadata?: Pick<KnowledgeMetadata, 'status' | 'reviewAt'>;
  savedAt?: string;
}): SavedContentRecord {
  const normalizedUrl = normalizeSavedContentUrl(content.url);

  return {
    key: `${target.id}::${normalizedUrl}`,
    url: content.url,
    normalizedUrl,
    title: content.title || '未命名网页',
    savedAt,
    status: metadata?.status || undefined,
    reviewAt: metadata?.reviewAt || undefined,
    targetType: target.type,
    targetId: target.id,
    targetName: target.name,
    tableConfigId: target.tableConfigId,
    appToken: target.appToken,
    tableId: target.tableId,
    tableUrl: result?.tableUrl || target.tableUrl,
    recordId: result?.recordId,
    documentUrl: result?.documentUrl,
  };
}

export function getRecentSavedContentRecords(
  records: SavedContentRecord[],
  limit = 20
): SavedContentRecord[] {
  return [...records]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, limit);
}

export function getDueReviewRecords(
  records: SavedContentRecord[],
  today = new Date()
): SavedContentRecord[] {
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  return records
    .filter(record => Boolean(record.reviewAt && record.reviewAt <= todayKey))
    .sort((a, b) => {
      const byReviewDate = String(a.reviewAt).localeCompare(String(b.reviewAt));
      return byReviewDate || Date.parse(b.savedAt) - Date.parse(a.savedAt);
    });
}

export function findSavedContentRecord(
  records: SavedContentRecord[],
  url: string,
  target: SavedContentTarget
): SavedContentRecord | undefined {
  const key = getSavedContentKey(url, target);
  return records.find(record => record.key === key);
}

export function upsertSavedContentRecord(
  records: SavedContentRecord[],
  nextRecord: SavedContentRecord,
  limit = SAVED_CONTENT_HISTORY_LIMIT
): SavedContentRecord[] {
  return [
    nextRecord,
    ...records.filter(record => record.key !== nextRecord.key),
  ].slice(0, limit);
}

export function normalizeSavedContentRecords(value: unknown): SavedContentRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((record): record is SavedContentRecord => {
      return Boolean(
        record &&
        typeof record === 'object' &&
        typeof (record as SavedContentRecord).url === 'string' &&
        typeof (record as SavedContentRecord).targetId === 'string'
      );
    })
    .map(record => ({
      ...record,
      normalizedUrl: normalizeSavedContentUrl(record.normalizedUrl || record.url),
      key: record.key || `${record.targetId}::${normalizeSavedContentUrl(record.url)}`,
      title: record.title || '未命名网页',
      savedAt: record.savedAt || new Date().toISOString(),
      status: typeof record.status === 'string' && record.status.trim() ? record.status : undefined,
      reviewAt: typeof record.reviewAt === 'string' && record.reviewAt.trim() ? record.reviewAt : undefined,
      targetName: record.targetName || (record.targetType === 'markdown' ? '本地 Markdown' : '飞书资料库'),
    }))
    .slice(0, SAVED_CONTENT_HISTORY_LIMIT);
}
