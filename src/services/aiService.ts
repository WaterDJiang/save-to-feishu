import type { ExtractedPageContent, KnowledgeMetadata } from '@/types';

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

function sanitizeSuggestion(value: unknown): AiClipSuggestion {
  const obj = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const summary = typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 220) : '';
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  const tags = rawTags
    .map(tag => String(tag).trim())
    .filter(Boolean)
    .slice(0, 6);
  const rawContentType = typeof obj.contentType === 'string' ? obj.contentType.trim() : '';
  const contentType = CONTENT_TYPES.includes(rawContentType as NonNullable<KnowledgeMetadata['contentType']>)
    ? rawContentType as NonNullable<KnowledgeMetadata['contentType']>
    : '其他';

  if (!summary && tags.length === 0) {
    throw new Error('没有生成可用建议');
  }

  return {
    summary,
    tags,
    contentType,
  };
}

function buildPrompt(content: ExtractedPageContent): string {
  const sourceText = [
    `标题：${content.title}`,
    `链接：${content.url}`,
    content.description ? `页面摘要：${content.description}` : '',
    content.selectedText ? `用户选中文本：${content.selectedText}` : '',
    content.content ? `正文：${content.content.slice(0, 2500)}` : '',
  ].filter(Boolean).join('\n\n');

  return `请把下面网页整理成知识剪藏建议。只返回 JSON，不要解释。

JSON 格式：
{
  "summary": "80-150 字中文摘要",
  "tags": ["3-6 个短标签"],
  "contentType": "阅读资料|行业研究|内容素材|工具文档|其他"
}

网页内容：
${sourceText}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('AI 整理超时')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

export async function generateAiClipSuggestion(content: ExtractedPageContent): Promise<AiClipResult> {
  const model = getLanguageModel();
  if (!model) {
    return {
      status: 'unavailable',
      message: '当前 Chrome 暂不支持 AI 自动整理，可手动填写。',
    };
  }

  try {
    const availability = normalizeStatus(String(await model.availability()));
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
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', () => undefined);
      },
      initialPrompts: [{
        role: 'system',
        content: '你是知识管理助手，负责把网页内容整理成简洁、准确、可保存到知识库的结构化建议。',
      }],
    }), 30000);

    try {
      const response = await withTimeout(session.prompt(buildPrompt(content)), 45000);
      const suggestion = sanitizeSuggestion(extractJson(response));
      return {
        status: 'available',
        message: '已生成整理建议，可按需修改。',
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
  const model = getLanguageModel();
  if (!model) {
    return {
      status: 'unavailable',
      message: '当前 Chrome 暂不支持本地整理建议。',
    };
  }

  try {
    const availability = normalizeStatus(String(await model.availability()));
    if (availability === 'available') {
      return {
        status: 'available',
        message: '可生成摘要、标签和资料类型。',
      };
    }
    if (availability === 'downloadable') {
      return {
        status: 'downloadable',
        message: 'Chrome 需要先准备本地 AI 模型，可先手动整理。',
      };
    }
    if (availability === 'downloading') {
      return {
        status: 'downloading',
        message: 'Chrome 正在准备本地 AI 模型，可先手动整理。',
      };
    }
    return {
      status: 'unavailable',
      message: '当前 Chrome 暂不支持本地整理建议。',
    };
  } catch {
    return {
      status: 'error',
      message: '暂时无法检测本地整理能力。',
    };
  }
}
