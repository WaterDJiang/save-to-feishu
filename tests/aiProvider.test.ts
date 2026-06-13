import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomAiRequest,
  DEFAULT_AI_PROVIDER_CONFIG,
  getAiProviderDisplayName,
  hasCustomAiCredentials,
  normalizeAiProviderConfig,
  parseCustomAiResponseText,
  sanitizeAiProviderConfigForExport,
} from '../src/utils/aiProvider.ts';

test('normalizeAiProviderConfig defaults to Chrome built-in AI', () => {
  assert.deepEqual(normalizeAiProviderConfig(undefined), DEFAULT_AI_PROVIDER_CONFIG);
  assert.equal(hasCustomAiCredentials(normalizeAiProviderConfig(undefined)), false);
});

test('sanitizeAiProviderConfigForExport removes user api key', () => {
  const config = normalizeAiProviderConfig({
    mode: 'customApi',
    provider: 'gemini',
    apiKey: 'secret-key',
    model: 'gemini-2.5-flash',
  });

  assert.equal(sanitizeAiProviderConfigForExport(config).apiKey, '');
});

test('buildCustomAiRequest builds Gemini generateContent request', () => {
  const request = buildCustomAiRequest(normalizeAiProviderConfig({
    mode: 'customApi',
    provider: 'gemini',
    apiKey: 'gemini-key',
    model: 'gemini-2.5-flash',
  }), 'Return JSON only.');

  assert.equal(
    request.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=gemini-key'
  );
  assert.equal(request.init.method, 'POST');
  assert.equal(JSON.parse(String(request.init.body)).contents[0].parts[0].text, 'Return JSON only.');
});

test('buildCustomAiRequest builds OpenAI-compatible chat request', () => {
  const request = buildCustomAiRequest(normalizeAiProviderConfig({
    mode: 'customApi',
    provider: 'openaiCompatible',
    apiKey: 'openai-key',
    baseUrl: 'https://api.example.com/v1/',
    model: 'model-a',
  }), 'Return JSON only.');

  assert.equal(request.url, 'https://api.example.com/v1/chat/completions');
  assert.equal((request.init.headers as Record<string, string>).Authorization, 'Bearer openai-key');
  assert.equal(JSON.parse(String(request.init.body)).messages[1].content, 'Return JSON only.');
});

test('parseCustomAiResponseText reads Gemini and OpenAI-compatible text', () => {
  assert.equal(
    parseCustomAiResponseText('gemini', {
      candidates: [{ content: { parts: [{ text: '{"fields":{"summary":"测试"}}' }] } }],
    }),
    '{"fields":{"summary":"测试"}}'
  );

  assert.equal(
    parseCustomAiResponseText('openaiCompatible', {
      choices: [{ message: { content: '{"fields":{"summary":"测试"}}' } }],
    }),
    '{"fields":{"summary":"测试"}}'
  );
});

test('getAiProviderDisplayName returns user-facing provider source', () => {
  assert.equal(getAiProviderDisplayName(DEFAULT_AI_PROVIDER_CONFIG), 'Chrome 内置 AI');
  assert.equal(getAiProviderDisplayName(normalizeAiProviderConfig({
    mode: 'customApi',
    provider: 'openaiCompatible',
    apiKey: 'key',
  })), '自有 API Key（OpenAI 兼容）');
});
