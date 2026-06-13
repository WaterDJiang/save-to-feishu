import type { ClipFieldConfig, ClipFieldType } from '@/types';

export const MAX_CLIP_FIELDS = 5;

const DEFAULT_CLIP_FIELDS: ClipFieldConfig[] = [
  { id: 'summary', label: '摘要', type: 'summary' },
  { id: 'tags', label: '标签', type: 'tags' },
  { id: 'contentType', label: '资料类型', type: 'contentType' },
];

const DEFAULT_LABEL_BY_TYPE: Partial<Record<ClipFieldType, string>> = {
  summary: '摘要',
  tags: '标签',
  contentType: '资料类型',
};

export function getDefaultClipFields(): ClipFieldConfig[] {
  return DEFAULT_CLIP_FIELDS.map(field => ({ ...field }));
}

export function normalizeClipFields(fields?: ClipFieldConfig[]): ClipFieldConfig[] {
  if (!Array.isArray(fields)) return getDefaultClipFields();

  const allowedTypes: ClipFieldType[] = ['summary', 'tags', 'contentType', 'text'];
  const normalized = fields
    .map((field, index) => {
      const label = typeof field?.label === 'string' ? field.label.trim().slice(0, 24) : '';
      const rawType = field?.type;
      const type: ClipFieldType = rawType && allowedTypes.includes(rawType) ? rawType : 'text';
      const fallbackId = type === 'text' ? `custom-${index + 1}` : type;
      const id = typeof field?.id === 'string' && field.id.trim() ? field.id.trim().slice(0, 64) : fallbackId;
      return label ? { id, label, type } : null;
    })
    .filter((field): field is ClipFieldConfig => Boolean(field))
    .slice(0, MAX_CLIP_FIELDS);

  return normalized.length > 0 ? normalized : getDefaultClipFields();
}

export function getEffectiveClipFieldType(field: ClipFieldConfig): ClipFieldType {
  if (field.type === 'text') return 'text';
  return DEFAULT_LABEL_BY_TYPE[field.type] === field.label ? field.type : 'text';
}

export function getAiFieldId(feishuFieldId: string): string {
  return `ai-${feishuFieldId}`;
}
