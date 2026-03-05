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
export type MappingSourceType = 'url' | 'title' | 'docUrl' | 'contentText' | 'content' | 'image' | 'saveTime' | 'static';

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
  documentUrl?: string;
}

/**
 * 飞书文档块类型（数字）
 * 参考: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/docx-v1/document-block/blocks/blocks
 */
export type DocBlockType = number;

/**
 * 飞书文档块类型常量
 */
export const BlockType = {
  PAGE: 1,
  TEXT: 2,
  HEADING1: 3,
  HEADING2: 4,
  HEADING3: 5,
  HEADING4: 6,
  HEADING5: 7,
  HEADING6: 8,
  HEADING7: 9,
  HEADING8: 10,
  HEADING9: 11,
  BULLET: 12,
  ORDERED: 13,
  CODE: 14,
  QUOTE: 15,
  IMAGE: 17,
} as const;

/**
 * 飞书文档块 - 通用结构
 * 不同块类型使用不同的属性名：
 * - TEXT (2): text
 * - HEADING1 (3): heading1
 * - HEADING2 (4): heading2
 * - HEADING3 (5): heading3
 * - BULLET (12): bullet
 * - ORDERED (13): ordered
 * - IMAGE (17): image
 */
export interface DocBlock {
  block_type: DocBlockType;
  text?: TextBlockContent;
  heading1?: TextBlockContent;
  heading2?: TextBlockContent;
  heading3?: TextBlockContent;
  bullet?: TextBlockContent;
  ordered?: TextBlockContent;
  image?: {
    token: string;
  };
  children?: DocBlock[];
}

/**
 * 文本块内容
 */
export interface TextBlockContent {
  elements: Array<{
    text_run: {
      content: string;
      text_element_style?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        link?: {
          url: string;
        };
      };
    };
  }>;
}

/**
 * HTML 元素信息（从 content-script 解析后传递给 background）
 */
export interface HtmlElementInfo {
  type: 'text' | 'heading' | 'image' | 'list' | 'link';
  content?: string;
  level?: 1 | 2 | 3;
  imageUrl?: string;
  listType?: 'bullet' | 'ordered';
  linkUrl?: string;
}

/**
 * 飞书文档信息
 */
export interface FeishuDocument {
  document_id: string;
  title: string;
  url: string;
}
