import type { AiProviderConfig, AiProviderType } from '@/types';

export const DEFAULT_AI_PROVIDER_CONFIG: AiProviderConfig = {
  mode: 'chromeBuiltIn',
  provider: 'gemini',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gemini-2.5-flash',
};

const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini';

export function normalizeAiProviderConfig(value: unknown): AiProviderConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_AI_PROVIDER_CONFIG };

  const config = value as Partial<AiProviderConfig>;
  const provider: AiProviderType = config.provider === 'openaiCompatible' ? 'openaiCompatible' : 'gemini';
  return {
    mode: config.mode === 'customApi' ? 'customApi' : 'chromeBuiltIn',
    provider,
    apiKey: typeof config.apiKey === 'string' ? config.apiKey : '',
    baseUrl: typeof config.baseUrl === 'string' && config.baseUrl.trim()
      ? config.baseUrl.trim().replace(/\/+$/, '')
      : DEFAULT_AI_PROVIDER_CONFIG.baseUrl,
    model: typeof config.model === 'string' && config.model.trim()
      ? config.model.trim()
      : provider === 'gemini'
        ? DEFAULT_AI_PROVIDER_CONFIG.model
        : DEFAULT_OPENAI_COMPATIBLE_MODEL,
  };
}

export function sanitizeAiProviderConfigForExport(config: AiProviderConfig): AiProviderConfig {
  return {
    ...normalizeAiProviderConfig(config),
    apiKey: '',
  };
}

export function hasCustomAiCredentials(config: AiProviderConfig): boolean {
  const normalized = normalizeAiProviderConfig(config);
  return normalized.mode === 'customApi' && Boolean(normalized.apiKey.trim());
}

export function getAiProviderDisplayName(config: AiProviderConfig): string {
  const normalized = normalizeAiProviderConfig(config);
  if (normalized.mode !== 'customApi') return 'Chrome 内置 AI';
  return normalized.provider === 'gemini'
    ? '自有 API Key（Gemini）'
    : '自有 API Key（OpenAI 兼容）';
}

export function buildCustomAiRequest(config: AiProviderConfig, prompt: string): { url: string; init: RequestInit } {
  const normalized = normalizeAiProviderConfig(config);
  if (!normalized.apiKey.trim()) {
    throw new Error('请先填写 API Key');
  }

  if (normalized.provider === 'gemini') {
    const model = normalized.model || DEFAULT_AI_PROVIDER_CONFIG.model || 'gemini-2.5-flash';
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(normalized.apiKey)}`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      },
    };
  }

  const baseUrl = (normalized.baseUrl || DEFAULT_AI_PROVIDER_CONFIG.baseUrl || '').replace(/\/+$/, '');
  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalized.apiKey}`,
      },
      body: JSON.stringify({
        model: normalized.model || DEFAULT_OPENAI_COMPATIBLE_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a knowledge management assistant. Return concise JSON suggestions for saving web pages into a knowledge base.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    },
  };
}

export function parseCustomAiResponseText(provider: AiProviderType, data: unknown): string {
  const payload = data && typeof data === 'object' ? data as Record<string, any> : {};
  if (provider === 'gemini') {
    const parts = payload.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const text = parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim();
      if (text) return text;
    }
  } else {
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }

  throw new Error('AI 服务返回格式不完整');
}
