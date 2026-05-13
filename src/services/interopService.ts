import type { FeishuField, InteropConfig, InteropFieldSchema, InteropSyncResult } from '@/types';
import {
  batchCreateFeishuRecordsDetailed,
  fetchFeishuRecordsSample,
  formatFeishuFieldValue,
  getTableFields,
} from './feishuService';
import {
  createNotionPagesDetailed,
  extractNotionPropertyValue,
  fetchNotionPagesSample,
  formatNotionPropertyValue,
  formatNotionTitleValue,
  getNotionDatabaseSchema,
} from './notionService';
import { saveInteropConfig } from './storageService';

function feishuTypeToInteropType(type: FeishuField['type']): InteropFieldSchema['type'] {
  if (type === 'number') return 'number';
  if (type === 'date') return 'date';
  if (type === 'single_select') return 'select';
  if (type === 'multi_select') return 'multi_select';
  if (type === 'person') return 'person';
  if (type === 'checkbox') return 'checkbox';
  if (type === 'url') return 'url';
  if (type === 'email') return 'email';
  return 'text';
}

export async function getFeishuInteropSchema(appToken: string, tableId: string): Promise<InteropFieldSchema[]> {
  const fields = await getTableFields(appToken, tableId);
  return fields.map(field => ({
    id: field.id,
    name: field.name,
    type: feishuTypeToInteropType(field.type),
  }));
}

function normalizeFeishuValue(value: any): any {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return item;
      return item?.text || item?.name || item?.link || String(item);
    }).filter(Boolean);
  }
  if (typeof value === 'object') {
    return value.text || value.link || value.name || JSON.stringify(value);
  }
  return value;
}

function findField(fields: InteropFieldSchema[], id: string, name: string): InteropFieldSchema | undefined {
  return fields.find(field => field.id === id) || fields.find(field => field.name === name);
}

async function syncNotionToFeishu(config: InteropConfig): Promise<InteropSyncResult> {
  const [sourceSchema, targetSchema] = await Promise.all([
    getNotionDatabaseSchema(config.notionDatabaseId),
    getFeishuInteropSchema(config.feishuAppToken, config.feishuTableId),
  ]);
  const pages = await fetchNotionPagesSample(config.notionDatabaseId, config.limit);

  const records = pages.map(page => {
    const fields: Record<string, any> = {};

    for (const mapping of config.mappings) {
      const sourceField = findField(sourceSchema, mapping.sourceFieldId, mapping.sourceFieldName);
      const targetField = findField(targetSchema, mapping.targetFieldId, mapping.targetFieldName);
      if (!sourceField || !targetField) continue;

      const sourceProperty = page.properties[sourceField.name] ||
        Object.values(page.properties).find((property: any) => property?.id === sourceField.id);
      const value = extractNotionPropertyValue(sourceProperty);
      const targetType = (targetField.type === 'select' ? 'single_select' : targetField.type) as FeishuField['type'];
      const formatted = formatFeishuFieldValue(value, targetType);
      if (formatted !== null && formatted !== undefined && formatted !== '') {
        fields[targetField.name] = formatted;
      }
    }

    return { fields };
  }).filter(record => Object.keys(record.fields).length > 0);

  const result = await batchCreateFeishuRecordsDetailed(config.feishuAppToken, config.feishuTableId, records);
  return {
    success: result.failed === 0,
    direction: config.direction,
    read: pages.length,
    written: result.success,
    failed: result.failed,
    errors: result.errors,
  };
}

async function syncFeishuToNotion(config: InteropConfig): Promise<InteropSyncResult> {
  const [sourceSchema, targetSchema] = await Promise.all([
    getFeishuInteropSchema(config.feishuAppToken, config.feishuTableId),
    getNotionDatabaseSchema(config.notionDatabaseId),
  ]);
  const feishuRecords = await fetchFeishuRecordsSample(config.feishuAppToken, config.feishuTableId, config.limit);

  const pages = feishuRecords.map(record => {
    const properties: Record<string, any> = {};

    for (const mapping of config.mappings) {
      const sourceField = findField(sourceSchema, mapping.sourceFieldId, mapping.sourceFieldName);
      const targetField = findField(targetSchema, mapping.targetFieldId, mapping.targetFieldName);
      if (!sourceField || !targetField) continue;

      const rawValue = record.fields[sourceField.name];
      const value = normalizeFeishuValue(rawValue);
      const formatted = targetField.rawType === 'title'
        ? formatNotionTitleValue(value || 'Untitled')
        : formatNotionPropertyValue(value, targetField.type);
      if (formatted) {
        properties[targetField.name] = formatted;
      }
    }

    const titleField = targetSchema.find(field => field.rawType === 'title');
    if (titleField && !properties[titleField.name]) {
      properties[titleField.name] = formatNotionTitleValue(record.recordId || 'Untitled');
    }

    return { properties };
  }).filter(page => Object.keys(page.properties).length > 0);

  const result = await createNotionPagesDetailed(config.notionDatabaseId, pages);
  return {
    success: result.failed === 0,
    direction: config.direction,
    read: feishuRecords.length,
    written: result.success,
    failed: result.failed,
    errors: result.errors,
  };
}

export async function syncInteropConfig(config: InteropConfig): Promise<InteropSyncResult> {
  if (config.mappings.length === 0) {
    return {
      success: false,
      direction: config.direction,
      read: 0,
      written: 0,
      failed: 0,
      errors: ['请先配置至少一组列对应关系'],
    };
  }

  const result = config.direction === 'notion-to-feishu'
    ? await syncNotionToFeishu(config)
    : await syncFeishuToNotion(config);

  if (result.written > 0) {
    await saveInteropConfig({ ...config, lastSyncAt: Date.now() });
  }

  return result;
}
