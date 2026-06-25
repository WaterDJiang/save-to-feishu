/**
 * 飞书应用凭证
 */
export interface FeishuCredentials {
  appId: string;
  appSecret: string;
}

/**
 * Notion 集成凭证
 */
export interface NotionCredentials {
  integrationToken: string;
}

export type AiProviderMode = 'chromeBuiltIn' | 'customApi';
export type AiProviderType = 'gemini' | 'openaiCompatible';

export interface AiProviderConfig {
  mode: AiProviderMode;
  provider: AiProviderType;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * 字段映射来源类型
 */
export type MappingSourceType =
  | 'url'
  | 'title'
  | 'docUrl'
  | 'description'
  | 'contentText'
  | 'content'
  | 'image'
  | 'saveTime'
  | 'tags'
  | 'source'
  | 'status'
  | 'contentType'
  | 'excerpt'
  | 'excerptType'
  | 'aiField'
  | 'customFields'
  | 'note'
  | 'reviewAt'
  | 'static';

/**
 * 表格字段映射配置
 */
export interface TableFieldMapping {
  feishuFieldId: string;
  feishuFieldName: string;
  sourceType: MappingSourceType;
  staticValue?: string;
  aiFieldId?: string;
  aiFieldName?: string;
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
  templateId?: KnowledgeTemplateId;
  fieldMappings: TableFieldMapping[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 应用配置
 */
export interface AppConfig {
  feishu: FeishuCredentials;
  notion: NotionCredentials;
  tables: TableConfig[];
  interopConfigs: InteropConfig[];
  clipFields: ClipFieldConfig[];
  savedContents: SavedContentRecord[];
  productEngagement: ProductEngagement;
  updateNotice: ExtensionUpdateNotice | null;
  aiProvider: AiProviderConfig;
  saveMode: SaveMode;
  version: string;
}

export interface ProductEngagement {
  successfulSaveCount: number;
  ratingCompleted: boolean;
  lastRatingPromptSaveCount: number;
}

export type SaveMode = 'both' | 'feishu' | 'markdown';
export type ContentKind = 'page' | 'excerpt';
export type ExcerptType = '观点' | '案例' | '数据' | '金句' | '问题' | '其他';

/**
 * 提取的页面内容
 */
export interface ExtractedPageContent {
  url: string;
  title: string;
  description?: string;
  content?: string;
  selectedText?: string;
  mainImage?: string;
  publishedAt?: string;
  savedAt: string;
  contentKind?: ContentKind;
  excerptType?: ExcerptType;
}

export type KnowledgeTemplateId = 'readingInbox' | 'researchLibrary' | 'contentIdeas';

export type ClipFieldType = 'summary' | 'tags' | 'contentType' | 'text';

export interface ClipFieldConfig {
  id: string;
  label: string;
  type: ClipFieldType;
}

/**
 * 剪藏时补充的知识整理信息
 */
export interface KnowledgeMetadata {
  tags: string[];
  source: string;
  status: string;
  contentType?: '阅读资料' | '行业研究' | '内容素材' | '工具文档' | '其他';
  excerptType?: ExcerptType;
  excerpt?: string;
  note?: string;
  reviewAt?: string;
  customFields?: Record<string, string>;
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
  markdownFallback?: boolean;
}

export type SavedContentTargetType = 'feishu' | 'markdown';

export interface SavedContentTarget {
  type: SavedContentTargetType;
  id: string;
  name: string;
  tableConfigId?: string;
  appToken?: string;
  tableId?: string;
  tableUrl?: string;
}

export interface SavedContentRecord {
  key: string;
  url: string;
  normalizedUrl: string;
  title: string;
  savedAt: string;
  contentKind?: ContentKind;
  excerptType?: ExcerptType;
  status?: string;
  reviewAt?: string;
  targetType: SavedContentTargetType;
  targetId: string;
  targetName: string;
  tableConfigId?: string;
  appToken?: string;
  tableId?: string;
  tableUrl?: string;
  recordId?: string;
  documentUrl?: string;
}

export interface ExtensionUpdateNotice {
  version: string;
  previousVersion?: string;
  createdAt: number;
  dismissed: boolean;
  title: string;
  highlights: string[];
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
  // 文档图片块（需要三步上传）
  DOCX_IMAGE: 27,
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
  type: 'text' | 'heading' | 'image' | 'list' | 'link' | 'quote' | 'media';
  content?: string;
  level?: 1 | 2 | 3;
  imageUrl?: string;
  listType?: 'bullet' | 'ordered';
  linkUrl?: string;
  mediaType?: 'video' | 'audio' | 'embed' | 'mini-program';
}

/**
 * 飞书文档信息
 */
export interface FeishuDocument {
  document_id: string;
  title: string;
  url: string;
}

export type InteropFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'person'
  | 'checkbox'
  | 'url'
  | 'email';

export interface InteropFieldSchema {
  id: string;
  name: string;
  type: InteropFieldType;
  rawType?: string;
}

export type InteropDirection = 'notion-to-feishu' | 'feishu-to-notion';

export interface InteropFieldMapping {
  sourceFieldId: string;
  sourceFieldName: string;
  targetFieldId: string;
  targetFieldName: string;
}

export interface InteropConfig {
  id: string;
  name: string;
  direction: InteropDirection;
  notionDatabaseId: string;
  feishuAppToken: string;
  feishuTableId: string;
  feishuTableUrl?: string;
  mappings: InteropFieldMapping[];
  limit: number;
  lastSyncAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface InteropSyncResult {
  success: boolean;
  direction: InteropDirection;
  read: number;
  written: number;
  failed: number;
  errors: string[];
}
