import type { InteropFieldSchema, NotionCredentials } from '@/types';
import { getNotionCredentials } from './storageService';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionApiError {
  message?: string;
  code?: string;
}

export interface NotionDatabaseSummary {
  id: string;
  title: string;
  url?: string;
}

export interface NotionPageRecord {
  id: string;
  properties: Record<string, any>;
}

function getHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function getSavedToken(): Promise<string> {
  const credentials = await getNotionCredentials();
  return credentials.integrationToken;
}

async function fetchNotion(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSavedToken();
  if (!token) {
    throw new Error('缺少 Notion 连接码，请先在设置页填写。');
  }

  return fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getHeaders(token),
      ...(init.headers || {}),
    },
  });
}

function getTitleText(title: any[] | undefined): string {
  return title?.map(item => item.plain_text || item.text?.content || '').join('').trim() || 'Untitled';
}

function mapNotionFieldType(type: string): InteropFieldSchema['type'] {
  if (type === 'number') return 'number';
  if (type === 'date') return 'date';
  if (type === 'select') return 'select';
  if (type === 'multi_select') return 'multi_select';
  if (type === 'people') return 'person';
  if (type === 'checkbox') return 'checkbox';
  if (type === 'url') return 'url';
  if (type === 'email') return 'email';
  return 'text';
}

export async function testNotionConnection(credentials: NotionCredentials): Promise<boolean> {
  try {
    if (!credentials.integrationToken) return false;
    const response = await fetch(`${NOTION_API_BASE}/users/me`, {
      headers: getHeaders(credentials.integrationToken),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listNotionDatabases(): Promise<NotionDatabaseSummary[]> {
  try {
    const response = await fetchNotion('/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 50,
      }),
    });
    if (!response.ok) return [];

    const data = await response.json();
    const results = (data.results || []) as any[];
    return results.map(item => ({
      id: item.id,
      title: getTitleText(item.title),
      url: item.url,
    }));
  } catch {
    return [];
  }
}

export async function getNotionDatabaseSchema(databaseId: string): Promise<InteropFieldSchema[]> {
  try {
    if (!databaseId) return [];
    const response = await fetchNotion(`/databases/${databaseId}`);
    if (!response.ok) return [];

    const data = await response.json();
    const properties = data.properties || {};
    return Object.keys(properties).map(name => ({
      id: properties[name].id || name,
      name,
      type: mapNotionFieldType(properties[name].type),
      rawType: properties[name].type,
    }));
  } catch {
    return [];
  }
}

export async function fetchNotionPagesSample(databaseId: string, limit: number = 50): Promise<NotionPageRecord[]> {
  try {
    if (!databaseId) return [];

    const pages: NotionPageRecord[] = [];
    let startCursor: string | undefined;

    while (pages.length < limit) {
      const response = await fetchNotion(`/databases/${databaseId}/query`, {
        method: 'POST',
        body: JSON.stringify({
          page_size: Math.min(100, limit - pages.length),
          start_cursor: startCursor,
        }),
      });
      if (!response.ok) break;

      const data = await response.json();
      const results = (data.results || []) as any[];
      for (const page of results) {
        pages.push({
          id: page.id,
          properties: page.properties || {},
        });
      }

      if (!data.has_more || !data.next_cursor) break;
      startCursor = data.next_cursor;
    }

    return pages;
  } catch {
    return [];
  }
}

export function extractNotionPropertyValue(property: any): any {
  if (!property) return '';

  switch (property.type) {
    case 'title':
      return getTitleText(property.title);
    case 'rich_text':
      return getTitleText(property.rich_text);
    case 'number':
      return property.number ?? '';
    case 'checkbox':
      return Boolean(property.checkbox);
    case 'url':
      return property.url || '';
    case 'email':
      return property.email || '';
    case 'date':
      return property.date?.start || '';
    case 'select':
      return property.select?.name || '';
    case 'multi_select':
      return (property.multi_select || []).map((item: any) => item.name).filter(Boolean);
    case 'people':
      return (property.people || []).map((item: any) => item.name || item.id).filter(Boolean).join(', ');
    default:
      return '';
  }
}

export function formatNotionPropertyValue(value: any, targetType: InteropFieldSchema['type']): any | null {
  if (value === null || value === undefined || value === '') return null;

  switch (targetType) {
    case 'number': {
      const numberValue = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numberValue) ? { number: numberValue } : null;
    }
    case 'checkbox':
      return { checkbox: typeof value === 'boolean' ? value : ['true', '1', 'yes', '是'].includes(String(value).toLowerCase()) };
    case 'url':
      return { url: String(value) };
    case 'email':
      return { email: String(value) };
    case 'date': {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return { date: { start: String(value).slice(0, 10) } };
    }
    case 'select':
      return { select: { name: String(Array.isArray(value) ? value[0] : value) } };
    case 'multi_select': {
      const values = Array.isArray(value) ? value : String(value).split(/[,，]/);
      return {
        multi_select: values.map(item => String(item).trim()).filter(Boolean).map(name => ({ name })),
      };
    }
    case 'person':
      return null;
    case 'text':
    default:
      return {
        rich_text: [
          {
            text: {
              content: Array.isArray(value) ? value.join(', ') : String(value),
            },
          },
        ],
      };
  }
}

export function formatNotionTitleValue(value: any): any {
  return {
    title: [
      {
        text: {
          content: Array.isArray(value) ? value.join(', ') : String(value || 'Untitled'),
        },
      },
    ],
  };
}

export async function createNotionPagesDetailed(
  databaseId: string,
  pages: Array<{ properties: Record<string, any> }>
): Promise<{ success: number; total: number; failed: number; errors: string[] }> {
  let success = 0;
  const errors: string[] = [];

  for (const page of pages) {
    try {
      const response = await fetchNotion('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: page.properties,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({} as NotionApiError));
        errors.push(error.message || `Notion 写入失败：HTTP ${response.status}`);
        continue;
      }

      success += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Notion 写入异常');
    }
  }

  return {
    success,
    total: pages.length,
    failed: pages.length - success,
    errors,
  };
}
