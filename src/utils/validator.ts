/**
 * 类型验证工具
 * 用于运行时验证导入的配置数据
 */

import type { AppConfig, TableConfig, FeishuCredentials, NotionCredentials, InteropConfig } from '@/types';

/**
 * 验证飞书凭证对象
 * @param obj - 待验证对象
 * @returns 是否有效
 */
export function isValidFeishuCredentials(obj: any): obj is FeishuCredentials {
  return obj !== null &&
         typeof obj === 'object' &&
         typeof obj.appId === 'string' &&
         typeof obj.appSecret === 'string';
}

export function isValidNotionCredentials(obj: any): obj is NotionCredentials {
  return obj !== null &&
         typeof obj === 'object' &&
         typeof obj.integrationToken === 'string';
}

/**
 * 验证表格配置对象
 * @param obj - 待验证对象
 * @returns 是否有效
 */
export function isValidTableConfig(obj: any): obj is TableConfig {
  return obj !== null &&
         typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.name === 'string' &&
         typeof obj.appToken === 'string' &&
         typeof obj.tableId === 'string' &&
         typeof obj.tableUrl === 'string' &&
         Array.isArray(obj.fieldMappings) &&
         typeof obj.createdAt === 'number' &&
         typeof obj.updatedAt === 'number';
}

export function isValidInteropConfig(obj: any): obj is InteropConfig {
  return obj !== null &&
         typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.name === 'string' &&
         ['notion-to-feishu', 'feishu-to-notion'].includes(obj.direction) &&
         typeof obj.notionDatabaseId === 'string' &&
         typeof obj.feishuAppToken === 'string' &&
         typeof obj.feishuTableId === 'string' &&
         Array.isArray(obj.mappings) &&
         typeof obj.limit === 'number' &&
         typeof obj.createdAt === 'number' &&
         typeof obj.updatedAt === 'number';
}

/**
 * 验证应用配置对象
 * @param obj - 待验证对象
 * @returns 是否有效
 */
export function isValidAppConfig(obj: any): obj is AppConfig {
  return obj !== null &&
         typeof obj === 'object' &&
         isValidFeishuCredentials(obj.feishu) &&
         isValidNotionCredentials(obj.notion || { integrationToken: '' }) &&
         Array.isArray(obj.tables) &&
         obj.tables.every(isValidTableConfig) &&
         Array.isArray(obj.interopConfigs || []) &&
         (obj.interopConfigs || []).every(isValidInteropConfig) &&
         ['both', 'feishu', 'markdown', undefined].includes(obj.saveMode) &&
         typeof obj.version === 'string';
}

/**
 * 安全解析并验证配置
 * @param jsonString - JSON 字符串
 * @returns 验证后的配置或 null
 */
export function parseAndValidateConfig(jsonString: string): AppConfig | null {
  try {
    const obj = JSON.parse(jsonString);
    
    if (!isValidAppConfig(obj)) {
      console.error('[Validator] 配置验证失败：数据结构不正确');
      return null;
    }
    
    return obj;
  } catch (error) {
    console.error('[Validator] JSON 解析失败:', error);
    return null;
  }
}

/**
 * 修复并验证配置（尝试修复常见问题）
 * @param obj - 待修复的配置对象
 * @returns 修复后的配置或 null
 */
export function repairConfig(obj: any): AppConfig | null {
  try {
    // 基础验证
    if (!obj || typeof obj !== 'object') return null;
    
    // 修复 feishu 字段
    if (!obj.feishu || typeof obj.feishu !== 'object') {
      obj.feishu = { appId: '', appSecret: '' };
    } else {
      obj.feishu = {
        appId: String(obj.feishu.appId || ''),
        appSecret: String(obj.feishu.appSecret || ''),
      };
    }

    if (!obj.notion || typeof obj.notion !== 'object') {
      obj.notion = { integrationToken: '' };
    } else {
      obj.notion = {
        integrationToken: String(obj.notion.integrationToken || ''),
      };
    }
    
    // 修复 tables 字段
    if (!Array.isArray(obj.tables)) {
      obj.tables = [];
    } else {
      obj.tables = obj.tables.filter((table: any) => {
        // 过滤掉无效的表格配置
        return table && 
               typeof table.id === 'string' &&
               typeof table.name === 'string';
      }).map((table: any) => ({
        id: String(table.id),
        name: String(table.name),
        appToken: String(table.appToken || ''),
        tableId: String(table.tableId || ''),
        tableUrl: String(table.tableUrl || ''),
        templateId: typeof table.templateId === 'string' ? table.templateId : undefined,
        fieldMappings: Array.isArray(table.fieldMappings) ? table.fieldMappings : [],
        createdAt: Number(table.createdAt) || Date.now(),
        updatedAt: Number(table.updatedAt) || Date.now(),
      }));
    }

    if (!Array.isArray(obj.interopConfigs)) {
      obj.interopConfigs = [];
    } else {
      obj.interopConfigs = obj.interopConfigs.filter((item: any) => {
        return item &&
               typeof item.id === 'string' &&
               typeof item.name === 'string';
      }).map((item: any) => ({
        id: String(item.id),
        name: String(item.name),
        direction: item.direction === 'feishu-to-notion' ? 'feishu-to-notion' : 'notion-to-feishu',
        notionDatabaseId: String(item.notionDatabaseId || ''),
        feishuAppToken: String(item.feishuAppToken || ''),
        feishuTableId: String(item.feishuTableId || ''),
        feishuTableUrl: typeof item.feishuTableUrl === 'string' ? item.feishuTableUrl : '',
        mappings: Array.isArray(item.mappings) ? item.mappings : [],
        limit: Number(item.limit) || 20,
        lastSyncAt: typeof item.lastSyncAt === 'number' ? item.lastSyncAt : undefined,
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),
      }));
    }

    if (!['both', 'feishu', 'markdown'].includes(obj.saveMode)) {
      obj.saveMode = 'feishu';
    }
    
    // 修复 version 字段
    if (typeof obj.version !== 'string') {
      obj.version = '0.5.0';
    }
    
    // 再次验证
    return isValidAppConfig(obj) ? obj : null;
  } catch (error) {
    console.error('[Validator] 配置修复失败:', error);
    return null;
  }
}
