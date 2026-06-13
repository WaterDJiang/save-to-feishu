import type { KnowledgeTemplateId, MappingSourceType } from '@/types';

export interface KnowledgeTemplateField {
  label: string;
  sourceType: MappingSourceType;
  aliases: string[];
  fieldTypeHint: string;
}

export interface KnowledgeTemplate {
  id: KnowledgeTemplateId;
  name: string;
  description: string;
  fields: KnowledgeTemplateField[];
}

export const KNOWLEDGE_TEMPLATES: KnowledgeTemplate[] = [
  {
    id: 'readingInbox',
    name: '阅读收件箱',
    description: '把网页先收进未处理队列，后续在飞书里筛选、精读、回顾。',
    fields: [
      { label: '标题', sourceType: 'title', aliases: ['标题', '名称', '文章标题'], fieldTypeHint: '文本' },
      { label: '链接', sourceType: 'url', aliases: ['链接', '网址', 'URL', '原文链接'], fieldTypeHint: '超链接/文本' },
      { label: '飞书文档', sourceType: 'docUrl', aliases: ['飞书文档', '文档链接', '正文文档'], fieldTypeHint: '超链接/文本' },
      { label: '摘要', sourceType: 'description', aliases: ['摘要', '简介', '描述'], fieldTypeHint: '多行文本' },
      { label: '标签', sourceType: 'tags', aliases: ['标签', 'Tag', 'Tags'], fieldTypeHint: '多选/文本' },
      { label: '状态', sourceType: 'status', aliases: ['状态', '处理状态', '阅读状态'], fieldTypeHint: '单选/文本' },
      { label: '资料类型', sourceType: 'contentType', aliases: ['资料类型', '内容类型', '类型'], fieldTypeHint: '单选/文本' },
      { label: '自定义整理字段', sourceType: 'customFields', aliases: ['自定义字段', 'AI字段', '整理字段'], fieldTypeHint: '多行文本' },
      { label: '个人备注', sourceType: 'note', aliases: ['个人备注', '备注', '想法'], fieldTypeHint: '多行文本' },
      { label: '下次回顾', sourceType: 'reviewAt', aliases: ['下次回顾', '回顾时间', '复习时间'], fieldTypeHint: '日期' },
      { label: '保存时间', sourceType: 'saveTime', aliases: ['保存时间', '剪藏时间', '创建时间'], fieldTypeHint: '日期' },
    ],
  },
  {
    id: 'researchLibrary',
    name: '研究资料库',
    description: '适合行业研究、竞品分析和资料沉淀，重点保留来源、摘录和备注。',
    fields: [
      { label: '标题', sourceType: 'title', aliases: ['标题', '资料标题', '名称'], fieldTypeHint: '文本' },
      { label: '链接', sourceType: 'url', aliases: ['链接', '网址', '来源链接', '原文链接'], fieldTypeHint: '超链接/文本' },
      { label: '来源', sourceType: 'source', aliases: ['来源', '站点', '媒体', 'Source'], fieldTypeHint: '文本' },
      { label: '飞书文档', sourceType: 'docUrl', aliases: ['飞书文档', '文档链接', '全文'], fieldTypeHint: '超链接/文本' },
      { label: '摘录', sourceType: 'excerpt', aliases: ['摘录', '关键摘录', '引用'], fieldTypeHint: '多行文本' },
      { label: '标签', sourceType: 'tags', aliases: ['标签', '主题', '分类'], fieldTypeHint: '多选/文本' },
      { label: '状态', sourceType: 'status', aliases: ['状态', '处理状态'], fieldTypeHint: '单选/文本' },
      { label: '资料类型', sourceType: 'contentType', aliases: ['资料类型', '内容类型', '类型'], fieldTypeHint: '单选/文本' },
      { label: '自定义整理字段', sourceType: 'customFields', aliases: ['自定义字段', 'AI字段', '整理字段'], fieldTypeHint: '多行文本' },
      { label: '个人备注', sourceType: 'note', aliases: ['个人备注', '研究备注', '备注'], fieldTypeHint: '多行文本' },
      { label: '保存时间', sourceType: 'saveTime', aliases: ['保存时间', '采集时间'], fieldTypeHint: '日期' },
    ],
  },
  {
    id: 'contentIdeas',
    name: '内容选题库',
    description: '面向内容创作，把素材、观点和后续处理状态集中到一个选题池。',
    fields: [
      { label: '标题', sourceType: 'title', aliases: ['标题', '选题', '素材标题'], fieldTypeHint: '文本' },
      { label: '链接', sourceType: 'url', aliases: ['链接', '素材链接', '原文链接'], fieldTypeHint: '超链接/文本' },
      { label: '来源', sourceType: 'source', aliases: ['来源', '平台', '站点'], fieldTypeHint: '文本' },
      { label: '摘录', sourceType: 'excerpt', aliases: ['摘录', '金句', '素材摘录'], fieldTypeHint: '多行文本' },
      { label: '个人备注', sourceType: 'note', aliases: ['个人备注', '选题角度', '备注', '观点'], fieldTypeHint: '多行文本' },
      { label: '标签', sourceType: 'tags', aliases: ['标签', '选题标签', '分类'], fieldTypeHint: '多选/文本' },
      { label: '状态', sourceType: 'status', aliases: ['状态', '创作状态', '处理状态'], fieldTypeHint: '单选/文本' },
      { label: '资料类型', sourceType: 'contentType', aliases: ['资料类型', '内容类型', '类型'], fieldTypeHint: '单选/文本' },
      { label: '自定义整理字段', sourceType: 'customFields', aliases: ['自定义字段', 'AI字段', '整理字段'], fieldTypeHint: '多行文本' },
      { label: '飞书文档', sourceType: 'docUrl', aliases: ['飞书文档', '素材文档'], fieldTypeHint: '超链接/文本' },
      { label: '保存时间', sourceType: 'saveTime', aliases: ['保存时间', '收集时间'], fieldTypeHint: '日期' },
    ],
  },
];
