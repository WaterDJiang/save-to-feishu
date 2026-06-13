import type { AiProviderConfig, ClipFieldConfig, ExtractedPageContent, KnowledgeMetadata } from '@/types';
import { getAiProviderConfig } from '@/services/storageService';
import {
  buildCustomAiRequest,
  getAiProviderDisplayName,
  hasCustomAiCredentials,
  normalizeAiProviderConfig,
  parseCustomAiResponseText,
} from '@/utils/aiProvider';
import { getDefaultClipFields, getEffectiveClipFieldType, normalizeClipFields } from '@/utils/clipFields';

export type AiClipStatus =
  | 'available'
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'error';

export interface AiClipSuggestion {
  summary: string;
  tags: string[];
  contentType: NonNullable<KnowledgeMetadata['contentType']>;
  fields: Record<string, string>;
}

export interface AiClipResult {
  status: AiClipStatus;
  message: string;
  suggestion?: AiClipSuggestion;
}

interface LanguageModelSession {
  prompt(input: string): Promise<string>;
  destroy?: () => void;
}

interface LanguageModelApi {
  availability(options?: {
    expectedInputs?: Array<{ type: 'text'; languages: string[] }>;
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
  }): Promise<AiClipStatus | string>;
  create(options?: {
    expectedInputs?: Array<{ type: 'text'; languages: string[] }>;
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<LanguageModelSession>;
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelApi;
  }

  // Chrome exposes built-in AI on globalThis in extension pages.
  // eslint-disable-next-line no-var
  var LanguageModel: LanguageModelApi | undefined;
}

const CONTENT_TYPES: Array<NonNullable<KnowledgeMetadata['contentType']>> = [
  '阅读资料',
  '行业研究',
  '内容素材',
  '工具文档',
  '其他',
];
const LANGUAGE_MODEL_OPTIONS = {
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

function getLanguageModel(): LanguageModelApi | undefined {
  return globalThis.LanguageModel || (typeof window !== 'undefined' ? window.LanguageModel : undefined);
}

function normalizeStatus(status: string): AiClipStatus {
  if (status === 'available' || status === 'downloadable' || status === 'downloading' || status === 'unavailable') {
    return status;
  }
  return 'error';
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('整理结果格式不完整');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function parseTagSuggestion(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(tag => String(tag).trim()).filter(Boolean).slice(0, 6);
  }
  if (typeof value === 'string') {
    return value.split(/[,，#\n]/).map(tag => tag.trim()).filter(Boolean).slice(0, 6);
  }
  return [];
}

function normalizeGeneratedFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean).join(', ');
  }
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function readGeneratedField(
  obj: Record<string, unknown>,
  rawFields: Record<string, unknown>,
  field: ClipFieldConfig
): string {
  const candidates = [
    rawFields[field.id],
    rawFields[field.label],
    obj[field.id],
    obj[field.label],
  ];
  for (const candidate of candidates) {
    const value = normalizeGeneratedFieldValue(candidate);
    if (value) return value;
  }
  return '';
}

function sanitizeSuggestion(value: unknown, clipFields: ClipFieldConfig[]): AiClipSuggestion {
  const obj = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawFields = obj.fields && typeof obj.fields === 'object' ? obj.fields as Record<string, unknown> : {};
  const fields = clipFields.reduce<Record<string, string>>((acc, field) => {
    const value = readGeneratedField(obj, rawFields, field);
    if (value) {
      acc[field.id] = value.slice(0, getEffectiveClipFieldType(field) === 'summary' ? 300 : 500);
    }
    return acc;
  }, {});

  const summary = (fields.summary || (typeof obj.summary === 'string' ? obj.summary : '')).trim().slice(0, 300);
  const tags = parseTagSuggestion(fields.tags || obj.tags);
  const rawContentType = (fields.contentType || (typeof obj.contentType === 'string' ? obj.contentType : '')).trim();
  const contentType = CONTENT_TYPES.includes(rawContentType as NonNullable<KnowledgeMetadata['contentType']>)
    ? rawContentType as NonNullable<KnowledgeMetadata['contentType']>
    : '其他';

  if (!summary && tags.length === 0 && Object.values(fields).every(field => !field)) {
    throw new Error('没有生成可用建议');
  }

  return {
    summary,
    tags,
    contentType,
    fields,
  };
}

function buildPrompt(content: ExtractedPageContent, fields: ClipFieldConfig[]): string {
  const sourceText = [
    `标题：${content.title}`,
    `链接：${content.url}`,
    content.description ? `页面摘要：${content.description}` : '',
    content.selectedText ? `用户选中文本：${content.selectedText}` : '',
    content.content ? `正文：${content.content.slice(0, 2500)}` : '',
  ].filter(Boolean).join('\n\n');
  const fieldSchema = fields.map(field => {
    const type = getEffectiveClipFieldType(field);
    if (type === 'tags') {
      return `- id="${field.id}", title="${field.label}": return 3-6 short tags. Use Simplified Chinese for the value.`;
    }
    if (type === 'contentType') {
      return `- id="${field.id}", title="${field.label}": return exactly one of 阅读资料, 行业研究, 内容素材, 工具文档, 其他.`;
    }
    if (type === 'summary') {
      return `- id="${field.id}", title="${field.label}": return an 80-150 character summary. Use Simplified Chinese for the value.`;
    }
    return `- id="${field.id}", title="${field.label}": generate concise content based on the field title. Use Simplified Chinese for the value.`;
  }).join('\n');
  const jsonExample = fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.id] = `按「${field.label}」生成`;
    return acc;
  }, {});

  return `Organize the web page below into a knowledge clipping suggestion.
Return JSON only. Do not explain.
Use the exact field ids as JSON keys. Do not use field titles as keys.
Generate field values in Simplified Chinese.

JSON shape:
${JSON.stringify({ fields: jsonExample }, null, 2)}

Fields:
${fieldSchema}

Web page content:
${sourceText}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('AI 信息整理超时')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

async function requestCustomAiWithConfig(config: AiProviderConfig, prompt: string): Promise<string> {
  const normalizedConfig = normalizeAiProviderConfig(config);
  if (!hasCustomAiCredentials(normalizedConfig)) {
    throw new Error('请先在设置里填写自己的 API Key，或切回 Chrome 内置 AI');
  }

  const request = buildCustomAiRequest(normalizedConfig, prompt);
  const response = await withTimeout(fetch(request.url, request.init), 45000);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string'
      ? data.error.message
      : `HTTP ${response.status}`;
    throw new Error(`自有 AI API 调用失败：${message}`);
  }

  return parseCustomAiResponseText(normalizedConfig.provider, data);
}

async function requestCustomAi(prompt: string): Promise<string> {
  return requestCustomAiWithConfig(await getAiProviderConfig(), prompt);
}

async function generateCustomAiClipSuggestion(content: ExtractedPageContent, fields: ClipFieldConfig[]): Promise<AiClipResult> {
  const clipFields = normalizeClipFields(fields);
  try {
    const response = await requestCustomAi(buildPrompt(content, clipFields));
    const suggestion = sanitizeSuggestion(extractJson(response), clipFields);
    const provider = normalizeAiProviderConfig(await getAiProviderConfig());
    return {
      status: 'available',
      message: `${getAiProviderDisplayName(provider)}：AI 字段及功能，可通过调整字段或设置修改。`,
      suggestion,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? `${error.message}，可手动填写。` : '自有 AI API 暂不可用，可手动填写。',
    };
  }
}

export async function generateAiClipSuggestion(content: ExtractedPageContent, fields: ClipFieldConfig[] = getDefaultClipFields()): Promise<AiClipResult> {
  const provider = normalizeAiProviderConfig(await getAiProviderConfig());
  if (provider.mode === 'customApi') {
    return generateCustomAiClipSuggestion(content, fields);
  }

  const model = getLanguageModel();
  const clipFields = normalizeClipFields(fields);
  if (!model) {
    return {
      status: 'unavailable',
      message: '当前 Chrome 暂不支持 AI 自动整理，可手动填写。',
    };
  }

  try {
    const availability = normalizeStatus(String(await model.availability(LANGUAGE_MODEL_OPTIONS)));
    if (availability === 'unavailable') {
      return {
        status: availability,
        message: '当前 Chrome 暂不支持 AI 自动整理，可手动填写。',
      };
    }
    if (availability === 'downloadable' || availability === 'downloading') {
      return {
        status: availability,
        message: 'Chrome 需要先准备本地 AI 模型，本次可先手动填写。',
      };
    }

    const session = await withTimeout(model.create({
      ...LANGUAGE_MODEL_OPTIONS,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', () => undefined);
      },
      initialPrompts: [{
        role: 'system',
        content: 'You are a knowledge management assistant. Return concise, accurate JSON suggestions for saving web pages into a knowledge base. The JSON values should be in Simplified Chinese when requested.',
      }],
    }), 30000);

    try {
      const response = await withTimeout(session.prompt(buildPrompt(content, clipFields)), 45000);
      const suggestion = sanitizeSuggestion(extractJson(response), clipFields);
      return {
        status: 'available',
        message: 'AI 字段及功能，可通过调整字段或设置修改。',
        suggestion,
      };
    } finally {
      session.destroy?.();
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? `${error.message}，可手动填写。` : '整理建议暂不可用，可手动填写。',
    };
  }
}

export async function checkAiClipAvailability(): Promise<AiClipResult> {
  const provider = normalizeAiProviderConfig(await getAiProviderConfig());
  if (provider.mode === 'customApi') {
    return hasCustomAiCredentials(provider)
      ? {
          status: 'available',
          message: `正在使用你的 API Key 调用 ${getAiProviderDisplayName(provider)}。`,
        }
      : {
          status: 'unavailable',
          message: '请先在设置里填写自己的 API Key，或切回 Chrome 内置 AI。',
        };
  }

  return checkChromeBuiltInAiAvailability();
}

async function checkChromeBuiltInAiAvailability(): Promise<AiClipResult> {
  const model = getLanguageModel();
  if (!model) {
    return {
      status: 'unavailable',
      message: '当前 Chrome 暂不支持本地整理建议，可在设置里填写自己的 API Key。',
    };
  }

  try {
    const availability = normalizeStatus(String(await model.availability(LANGUAGE_MODEL_OPTIONS)));
    if (availability === 'available') {
      return {
        status: 'available',
        message: '正在使用 Chrome 内置 AI，可按当前字段 AI 写入。',
      };
    }
    if (availability === 'downloadable') {
      return {
        status: 'downloadable',
        message: 'Chrome 需要先准备本地 AI 模型，也可在设置里填写自己的 API Key。',
      };
    }
    if (availability === 'downloading') {
      return {
        status: 'downloading',
        message: 'Chrome 正在准备本地 AI 模型，也可在设置里填写自己的 API Key。',
      };
    }
    return {
      status: 'unavailable',
      message: '当前 Chrome 暂不支持本地整理建议，可在设置里填写自己的 API Key。',
    };
  } catch {
    return {
      status: 'error',
      message: '暂时无法检测本地整理能力。',
    };
  }
}

export async function testAiProviderConnection(config: AiProviderConfig): Promise<{ success: boolean; message: string }> {
  const provider = normalizeAiProviderConfig(config);
  if (provider.mode === 'chromeBuiltIn') {
    const result = await checkChromeBuiltInAiAvailability();
    return {
      success: result.status === 'available',
      message: result.status === 'available' ? 'Chrome 内置 AI 可用。' : result.message,
    };
  }

  try {
    const response = await requestCustomAiWithConfig(
      provider,
      'Return JSON only: {"fields":{"summary":"连接测试"}}'
    );
    if (!response.trim()) {
      return { success: false, message: 'AI 服务没有返回内容。' };
    }
    return {
      success: true,
      message: `${getAiProviderDisplayName(provider)} 可以连接。`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'AI 服务连接失败。',
    };
  }
}
