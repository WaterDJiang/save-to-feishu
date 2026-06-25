import type {
  ClipFieldConfig,
  FeishuField,
  KnowledgeTemplateId,
  MappingSourceType,
  TableConfig,
  TableFieldMapping,
} from '@/types';
import { normalizeClipFields } from './clipFields.ts';

const SHARE_PREFIX = 'STF_TEMPLATE_V1:';
const ALLOWED_TEMPLATE_IDS: KnowledgeTemplateId[] = ['readingInbox', 'researchLibrary', 'contentIdeas'];
const ALLOWED_SOURCE_TYPES: MappingSourceType[] = [
  'url',
  'title',
  'docUrl',
  'description',
  'contentText',
  'content',
  'image',
  'saveTime',
  'tags',
  'source',
  'status',
  'contentType',
  'excerpt',
  'excerptType',
  'aiField',
  'customFields',
  'note',
  'reviewAt',
  'static',
];

export interface SharedTemplateMapping {
  targetFieldName: string;
  sourceType: MappingSourceType;
  aiFieldId?: string;
  aiFieldName?: string;
}

export interface SharedKnowledgeTemplate {
  kind: 'save-to-feishu-template';
  version: 1;
  name: string;
  templateId?: KnowledgeTemplateId;
  fieldMappings: SharedTemplateMapping[];
  clipFields: ClipFieldConfig[];
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

export function createSharedKnowledgeTemplate(
  table: Pick<Partial<TableConfig>, 'name' | 'templateId' | 'fieldMappings'>,
  clipFields: ClipFieldConfig[]
): SharedKnowledgeTemplate {
  const templateId = table.templateId && ALLOWED_TEMPLATE_IDS.includes(table.templateId)
    ? table.templateId
    : undefined;

  return {
    kind: 'save-to-feishu-template',
    version: 1,
    name: String(table.name || '共享资料库模板').trim().slice(0, 80) || '共享资料库模板',
    templateId,
    fieldMappings: (table.fieldMappings || [])
      .filter(mapping => mapping.feishuFieldName?.trim() && ALLOWED_SOURCE_TYPES.includes(mapping.sourceType))
      .map(mapping => ({
        targetFieldName: mapping.feishuFieldName.trim().slice(0, 80),
        sourceType: mapping.sourceType,
        aiFieldId: mapping.sourceType === 'aiField' ? mapping.aiFieldId?.slice(0, 64) : undefined,
        aiFieldName: mapping.sourceType === 'aiField' ? mapping.aiFieldName?.trim().slice(0, 80) : undefined,
      })),
    clipFields: normalizeClipFields(clipFields),
  };
}

export function encodeSharedKnowledgeTemplate(template: SharedKnowledgeTemplate): string {
  return `${SHARE_PREFIX}${encodeBase64Url(JSON.stringify(template))}`;
}

export function parseSharedKnowledgeTemplate(value: string): SharedKnowledgeTemplate {
  const trimmed = value.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) {
    throw new Error('这不是有效的 Save to Feishu 共享模板代码。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(trimmed.slice(SHARE_PREFIX.length)));
  } catch {
    throw new Error('共享模板代码已损坏，请让分享者重新复制。');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('共享模板内容无效。');
  }

  const candidate = parsed as Partial<SharedKnowledgeTemplate>;
  if (candidate.kind !== 'save-to-feishu-template' || candidate.version !== 1) {
    throw new Error('暂不支持这个版本的共享模板。');
  }

  const templateId = candidate.templateId && ALLOWED_TEMPLATE_IDS.includes(candidate.templateId)
    ? candidate.templateId
    : undefined;
  const fieldMappings = Array.isArray(candidate.fieldMappings)
    ? candidate.fieldMappings
      .filter(mapping => Boolean(
        mapping &&
        typeof mapping.targetFieldName === 'string' &&
        ALLOWED_SOURCE_TYPES.includes(mapping.sourceType)
      ))
      .map(mapping => ({
        targetFieldName: mapping.targetFieldName.trim().slice(0, 80),
        sourceType: mapping.sourceType,
        aiFieldId: mapping.sourceType === 'aiField' && typeof mapping.aiFieldId === 'string'
          ? mapping.aiFieldId.slice(0, 64)
          : undefined,
        aiFieldName: mapping.sourceType === 'aiField' && typeof mapping.aiFieldName === 'string'
          ? mapping.aiFieldName.trim().slice(0, 80)
          : undefined,
      }))
      .filter(mapping => mapping.targetFieldName)
    : [];

  return {
    kind: 'save-to-feishu-template',
    version: 1,
    name: typeof candidate.name === 'string' && candidate.name.trim()
      ? candidate.name.trim().slice(0, 80)
      : '共享资料库模板',
    templateId,
    fieldMappings,
    clipFields: normalizeClipFields(candidate.clipFields),
  };
}

export function matchSharedTemplateMappings(
  template: SharedKnowledgeTemplate,
  availableFields: FeishuField[]
): TableFieldMapping[] {
  return template.fieldMappings.flatMap(sharedMapping => {
    const targetName = normalizeFieldName(sharedMapping.targetFieldName);
    const matchedField = availableFields.find(field => normalizeFieldName(field.name) === targetName);
    if (!matchedField) return [];

    return [{
      feishuFieldId: matchedField.id,
      feishuFieldName: matchedField.name,
      sourceType: sharedMapping.sourceType,
      aiFieldId: sharedMapping.sourceType === 'aiField' ? sharedMapping.aiFieldId : undefined,
      aiFieldName: sharedMapping.sourceType === 'aiField' ? sharedMapping.aiFieldName : undefined,
    }];
  });
}
