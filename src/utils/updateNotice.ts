import type { ExtensionUpdateNotice } from '@/types';

export const UPDATE_NOTICE_HIGHLIGHTS = [
  '选中网页文字后可右键保存为高质量摘录',
  '摘录可直接保存到指定飞书资料库或 Markdown',
] as const;

export function createExtensionUpdateNotice({
  reason,
  version,
  previousVersion,
  createdAt = Date.now(),
}: {
  reason: string;
  version: string;
  previousVersion?: string;
  createdAt?: number;
}): ExtensionUpdateNotice | null {
  if (reason !== 'update') return null;

  return {
    version,
    previousVersion,
    createdAt,
    dismissed: false,
    title: 'Save to Feishu 已更新',
    highlights: [...UPDATE_NOTICE_HIGHLIGHTS],
  };
}

export function normalizeExtensionUpdateNotice(value: unknown): ExtensionUpdateNotice | null {
  if (!value || typeof value !== 'object') return null;
  const notice = value as Partial<ExtensionUpdateNotice>;
  if (typeof notice.version !== 'string' || !notice.version.trim()) return null;

  return {
    version: notice.version,
    previousVersion: typeof notice.previousVersion === 'string' ? notice.previousVersion : undefined,
    createdAt: typeof notice.createdAt === 'number' ? notice.createdAt : Date.now(),
    dismissed: Boolean(notice.dismissed),
    title: typeof notice.title === 'string' && notice.title.trim()
      ? notice.title
      : 'Save to Feishu 已更新',
    highlights: Array.isArray(notice.highlights) && notice.highlights.every(item => typeof item === 'string')
      ? notice.highlights.filter(Boolean)
      : [...UPDATE_NOTICE_HIGHLIGHTS],
  };
}

export function dismissExtensionUpdateNotice(
  notice: ExtensionUpdateNotice | null
): ExtensionUpdateNotice | null {
  return notice ? { ...notice, dismissed: true } : null;
}

export function shouldClearUpdateBadgeOnLaunch(
  notice: ExtensionUpdateNotice | null
): boolean {
  return Boolean(notice && !notice.dismissed);
}
