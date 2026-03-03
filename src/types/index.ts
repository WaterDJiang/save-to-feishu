/**
 * 飞书应用凭证
 */
export interface FeishuCredentials {
  appId: string;
  appSecret: string;
}

/**
 * 字段映射来源类型
 */
export type MappingSourceType = 'url' | 'title' | 'content' | 'image' | 'saveTime' | 'static';

/**
 * 表格字段映射配置
 */
export interface TableFieldMapping {
  feishuFieldId: string;
  feishuFieldName: string;
  sourceType: MappingSourceType;
  staticValue?: string;
}

/**
 * 表格配置
 */
export interface TableConfig {
  id: string;
  name: string;
  appToken: string;
  tableId: string;
  tableUrl: string;
  fieldMappings: TableFieldMapping[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 应用配置
 */
export interface AppConfig {
  feishu: FeishuCredentials;
  tables: TableConfig[];
  version: string;
}

/**
 * 提取的页面内容
 */
export interface ExtractedPageContent {
  url: string;
  title: string;
  description?: string;
  content?: string;
  mainImage?: string;
  publishedAt?: string;
  savedAt: string;
}

/**
 * 飞书字段类型
 */
export type FeishuFieldType = 
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'person'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'single_select'
  | 'multi_select'
  | 'attachment';

/**
 * 飞书字段信息
 */
export interface FeishuField {
  id: string;
  name: string;
  type: FeishuFieldType;
}

/**
 * 飞书表格信息
 */
export interface FeishuTable {
  id: string;
  name: string;
}

/**
 * 保存结果
 */
export interface SaveResult {
  success: boolean;
  recordId?: string;
  error?: string;
  tableUrl?: string;
}
