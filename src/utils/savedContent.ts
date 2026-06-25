import type {
  ContentKind,
  ExcerptType,
  ExtractedPageContent,
  KnowledgeMetadata,
  SaveResult,
  SavedContentRecord,
  SavedContentTarget,
  TableConfig,
} from '@/types';

export const SAVED_CONTENT_HISTORY_LIMIT = 300;
const EXCERPT_TYPES: ExcerptType[] = ['观点', '案例', '数据', '金句', '问题', '其他'];

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

function normalizeExcerptType(value: unknown): ExcerptType | undefined {
  return typeof value === 'string' && EXCERPT_TYPES.includes(value as ExcerptType)
    ? value as ExcerptType
    : undefined;
}

export function getLocalDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getRelativeLocalDateKey(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

export function isSavedContentReviewDue(
  record: Pick<SavedContentRecord, 'reviewAt'>,
  today = new Date()
): boolean {
  return Boolean(record.reviewAt && record.reviewAt <= getLocalDateKey(today));
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

export function getSavedContentKey(
  url: string,
  target: SavedContentTarget,
  contentKind: ContentKind = 'page'
): string {
  const suffix = contentKind === 'excerpt' ? '::excerpt' : '';
  return `${target.id}::${normalizeSavedContentUrl(url)}${suffix}`;
}

export function createSavedContentRecord({
  content,
  target,
  result,
  metadata,
  savedAt = new Date().toISOString(),
}: {
  content: Pick<ExtractedPageContent, 'url' | 'title' | 'contentKind' | 'excerptType'>;
  target: SavedContentTarget;
  result?: SaveResult;
  metadata?: Pick<KnowledgeMetadata, 'status' | 'reviewAt' | 'excerptType'>;
  savedAt?: string;
}): SavedContentRecord {
  const normalizedUrl = normalizeSavedContentUrl(content.url);
  const contentKind = content.contentKind || (metadata?.excerptType ? 'excerpt' : 'page');
  const excerptType = normalizeExcerptType(content.excerptType || metadata?.excerptType);

  return {
    key: `${target.id}::${normalizedUrl}${contentKind === 'excerpt' ? '::excerpt' : ''}`,
    url: content.url,
    normalizedUrl,
    title: content.title || '未命名网页',
    savedAt,
    contentKind,
    excerptType,
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
  return records
    .filter(record => isSavedContentReviewDue(record, today))
    .sort((a, b) => {
      const byReviewDate = String(a.reviewAt).localeCompare(String(b.reviewAt));
      return byReviewDate || Date.parse(b.savedAt) - Date.parse(a.savedAt);
    });
}

export function findSavedContentRecord(
  records: SavedContentRecord[],
  url: string,
  target: SavedContentTarget,
  contentKind: ContentKind = 'page'
): SavedContentRecord | undefined {
  const key = getSavedContentKey(url, target, contentKind);
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

export function updateSavedContentReviewAt(
  records: SavedContentRecord[],
  recordKey: string,
  reviewAt?: string
): SavedContentRecord[] {
  const normalizedReviewAt = reviewAt?.trim() || undefined;
  return records.map(record => (
    record.key === recordKey
      ? { ...record, reviewAt: normalizedReviewAt }
      : record
  ));
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
    .map(record => {
      const contentKind: ContentKind = record.contentKind === 'excerpt' ? 'excerpt' : 'page';
      const normalizedUrl = normalizeSavedContentUrl(record.normalizedUrl || record.url);

      return {
        ...record,
        normalizedUrl,
        contentKind,
        excerptType: normalizeExcerptType(record.excerptType),
        key: record.key || `${record.targetId}::${normalizedUrl}${contentKind === 'excerpt' ? '::excerpt' : ''}`,
        title: record.title || '未命名网页',
        savedAt: record.savedAt || new Date().toISOString(),
        status: typeof record.status === 'string' && record.status.trim() ? record.status : undefined,
        reviewAt: typeof record.reviewAt === 'string' && record.reviewAt.trim() ? record.reviewAt : undefined,
        targetName: record.targetName || (record.targetType === 'markdown' ? '本地 Markdown' : '飞书资料库'),
      };
    })
    .slice(0, SAVED_CONTENT_HISTORY_LIMIT);
}
