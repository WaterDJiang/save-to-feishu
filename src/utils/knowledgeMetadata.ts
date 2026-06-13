import type { ExtractedPageContent, KnowledgeMetadata } from '@/types';

interface DefaultKnowledgeMetadataOptions {
  contentType?: KnowledgeMetadata['contentType'];
  customFields?: Record<string, string>;
}

export function getSourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function parseKnowledgeTags(value: string): string[] {
  return value
    .split(/[,，#\n]/)
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function createDefaultKnowledgeMetadata(
  content: ExtractedPageContent,
  options: DefaultKnowledgeMetadataOptions = {}
): KnowledgeMetadata {
  return {
    tags: [],
    source: getSourceHostname(content.url),
    status: '未处理',
    contentType: options.contentType,
    excerpt: content.selectedText || content.description || '',
    note: '',
    reviewAt: '',
    customFields: options.customFields,
  };
}
