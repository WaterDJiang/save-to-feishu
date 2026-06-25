import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ClipFieldConfig, ExtensionUpdateNotice, ExtractedPageContent, HtmlElementInfo, KnowledgeMetadata, ProductEngagement, SaveMode, SavedContentRecord, SaveResult, TableConfig } from '@/types';
import type { ContentKind, ExcerptType } from '@/types';
import { checkAiClipAvailability, generateAiClipSuggestion, type AiClipStatus } from '@/services/aiService';
import { saveToFeishu } from '@/services/feishuService';
import { completeRatingInvitation, dismissCurrentUpdateNotice, dismissRatingInvitation, getClipFields, getExtensionUpdateNotice, getProductEngagement, getSaveMode, getSavedContentRecords, getTableConfigs, rememberSavedContent, saveClipFields, saveTableConfig, saveTableConfigs, setSavedContentReviewAt } from '@/services/storageService';
import { getAiFieldId, getEffectiveClipFieldType, MAX_CLIP_FIELDS, normalizeClipFields } from '@/utils/clipFields';
import { downloadMarkdown, generateMarkdown, generateMarkdownFilename } from '@/utils/markdownGenerator';
import { buildFeishuSavedContentTarget, buildMarkdownSavedContentTarget, createSavedContentRecord, findSavedContentRecord, upsertSavedContentRecord } from '@/utils/savedContent';
import { shouldClearUpdateBadgeOnLaunch } from '@/utils/updateNotice';
import { buildTableMappingOptionsHash } from '@/utils/optionsRoute';
import { buildFeedbackIssueUrl } from '@/utils/feedback';
import { CHROME_WEB_STORE_REVIEW_URL, DEFAULT_PRODUCT_ENGAGEMENT, shouldShowRatingPrompt } from '@/utils/engagement';
import {
  createDefaultKnowledgeMetadata,
  getSourceHostname,
  parseKnowledgeTags,
} from '@/utils/knowledgeMetadata';
import { extractCurrentPageSnapshot } from '@/utils/pageExtraction';
import {
  ExtensionUpdateCard,
  PanelStateMessage,
  RatingInvitationCard,
  ReviewScheduleField,
  SavedContentLibrary,
} from '@/sidepanel/components/GrowthPanels';
import { MarkdownFirstSaveCard } from '@/components/MarkdownFirstSaveCard';

type PanelState = 'loading' | 'ready' | 'error';
type AiUiStatus = AiClipStatus | 'idle' | 'loading';
type PanelStep = 'target' | 'editor';
type PanelView = 'capture' | 'library';
type CaptureMode = ContentKind;

interface ActivePageData {
  content: ExtractedPageContent;
  htmlElements: HtmlElementInfo[];
}

function truncatePreview(value: string, maxLength = 520): string {
  const normalized = value
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized;
}

function buildPagePreview(content: ExtractedPageContent, elements: HtmlElementInfo[]): string {
  if (content.selectedText?.trim()) return truncatePreview(content.selectedText, 520);

  const structuredPreview = elements
    .filter(element => element.content && ['heading', 'text', 'list', 'quote'].includes(element.type))
    .slice(0, 6)
    .map(element => element.content?.trim())
    .filter(Boolean)
    .join('\n');

  return truncatePreview(structuredPreview || content.content || content.description || '', 520);
}

const EXCERPT_TYPES: ExcerptType[] = ['观点', '案例', '数据', '金句', '问题', '其他'];

function getTableUrl(table: TableConfig | undefined): string {
  if (!table) return '';
  if (table.tableUrl?.trim()) return table.tableUrl.trim();
  if (table.appToken && table.tableId) return `https://feishu.cn/base/${table.appToken}?table=${table.tableId}`;
  return '';
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '之前';

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function extractActivePage(): Promise<ActivePageData> {
  const tabId = await getActiveTabId();
  if (!tabId) throw new Error('无法获取当前标签页');

  const [contentResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractCurrentPageSnapshot,
  });

  const sharedSnapshot = contentResult.result;
  if (sharedSnapshot && typeof sharedSnapshot === 'object' && 'content' in sharedSnapshot && 'htmlElements' in sharedSnapshot) {
    return sharedSnapshot as ActivePageData;
  }

  const [fallbackContentResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const getMeta = (name: string, property?: string) => {
        const byName = document.querySelector(`meta[name="${name}"]`);
        if (byName?.getAttribute('content')) return byName.getAttribute('content') || '';
        const propertyValue = property || (name.startsWith('og:') ? name : `og:${name}`);
        return document.querySelector(`meta[property="${propertyValue}"]`)?.getAttribute('content') || '';
      };
      const resolveUrl = (value: string) => {
        if (!value) return '';
        try {
          return new URL(value, document.baseURI).href;
        } catch {
          return value.replace(/^\/\//, 'https://');
        }
      };
      const cleanText = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return '';
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, noscript, iframe, svg, header, footer, nav, aside').forEach(node => node.remove());
        clone.querySelectorAll('[style*="display:none"],[style*="display: none"],[style*="visibility:hidden"],[style*="visibility: hidden"]').forEach(node => node.remove());
        clone.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
        return (clone.innerText || clone.textContent || '')
          .trim()
          .replace(/\r/g, '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .slice(0, 5000);
      };

      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || window.location.href;
      const selectedText = window.getSelection()?.toString().trim().slice(0, 6000) || '';
      const content =
        selectedText ||
        cleanText('#js_content') ||
        cleanText('article') ||
        cleanText('[role="main"]') ||
        cleanText('.post-content') ||
        cleanText('.entry-content') ||
        cleanText('.article-content') ||
        cleanText('.markdown-body') ||
        cleanText('main') ||
        cleanText('body');

      return {
        title: (getMeta('title') || document.title || '').replace(/^\(\d+\)\s*/, '').trim(),
        url: resolveUrl(canonical),
        description: getMeta('description', 'og:description'),
        content,
        selectedText,
        mainImage: resolveUrl(getMeta('', 'og:image') || document.querySelector('article img, main img')?.getAttribute('src') || ''),
        savedAt: new Date().toISOString(),
      };
    },
  });

  const [elementsResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selectors = ['#js_content', 'article', '[role="main"]', '.post-content', '.entry-content', '.article-content', '.markdown-body', 'main', '.content', '#content'];
      let html = '';
      for (const selector of selectors) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el && el.innerHTML?.trim().length > 50) {
          html = el.innerHTML.trim();
          break;
        }
      }
      if (!html) html = document.body.innerHTML?.trim() || '';

      const elements: Array<{ type: string; content?: string; level?: number; imageUrl?: string; listType?: string; linkUrl?: string }> = [];
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const body = doc.querySelector('body');
      if (!body) return elements;
      const resolveUrl = (value: string) => {
        if (!value) return '';
        try {
          return new URL(value, document.baseURI).href;
        } catch {
          return value.replace(/^\/\//, 'https://');
        }
      };
      const processed = new Set<Element>();
      const walk = (element: Element) => {
        const tag = element.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tag) || processed.has(element)) return;
        if (['h1', 'h2', 'h3'].includes(tag)) {
          processed.add(element);
          const text = element.textContent?.trim();
          if (text) elements.push({ type: 'heading', content: text, level: tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3 });
          return;
        }
        if (tag === 'img') {
          processed.add(element);
          const src = element.getAttribute('data-src') || element.getAttribute('data-original') || element.getAttribute('src');
          if (src && !src.startsWith('data:') && !src.includes('avatar') && !src.includes('logo')) {
            elements.push({ type: 'image', imageUrl: resolveUrl(src) });
          }
          return;
        }
        if (tag === 'ul' || tag === 'ol') {
          processed.add(element);
          element.querySelectorAll(':scope > li').forEach(li => {
            const text = li.textContent?.trim();
            if (text) elements.push({ type: 'list', content: text, listType: tag === 'ul' ? 'bullet' : 'ordered' });
          });
          return;
        }
        if (['p', 'blockquote', 'pre'].includes(tag)) {
          processed.add(element);
          const text = element.textContent?.trim();
          if (text) elements.push({ type: tag === 'blockquote' ? 'quote' : 'text', content: text });
          return;
        }
        Array.from(element.children).forEach(walk);
      };
      Array.from(body.children).forEach(walk);
      return elements;
    },
  });

  if (!fallbackContentResult.result) throw new Error('无法读取当前页面内容');
  return {
    content: fallbackContentResult.result as ExtractedPageContent,
    htmlElements: (elementsResult.result || []) as HtmlElementInfo[],
  };
}

export default function SidePanelApp() {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [error, setError] = useState('');
  const [content, setContent] = useState<ExtractedPageContent | null>(null);
  const [activePageData, setActivePageData] = useState<ActivePageData | null>(null);
  const [htmlElements, setHtmlElements] = useState<HtmlElementInfo[]>([]);
  const [metadata, setMetadata] = useState<KnowledgeMetadata | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('page');
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [saveMode, setSaveMode] = useState<SaveMode>('markdown');
  const [savedContentRecords, setSavedContentRecords] = useState<SavedContentRecord[]>([]);
  const [updateNotice, setUpdateNotice] = useState<ExtensionUpdateNotice | null>(null);
  const [productEngagement, setProductEngagement] = useState<ProductEngagement>({ ...DEFAULT_PRODUCT_ENGAGEMENT });
  const [clipFields, setClipFields] = useState<ClipFieldConfig[]>([]);
  const [draftClipFields, setDraftClipFields] = useState<ClipFieldConfig[]>([]);
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [panelStep, setPanelStep] = useState<PanelStep>('target');
  const [panelView, setPanelView] = useState<PanelView>('capture');
  const [showAllTables, setShowAllTables] = useState(false);
  const autoAiRunKeysRef = useRef<Set<string>>(new Set());
  const [aiStatus, setAiStatus] = useState<{ status: AiUiStatus; message: string }>({
    status: 'idle',
    message: '可选：按当前字段 AI 写入。',
  });

  const selectedTable = useMemo(
    () => tables.find(table => table.id === selectedTableId) || tables[0],
    [selectedTableId, tables]
  );
  const visibleTables = showAllTables ? tables : tables.slice(0, 5);
  const getSavedRecordForTable = useCallback((table: TableConfig): SavedContentRecord | undefined => {
    return content
      ? findSavedContentRecord(savedContentRecords, content.url, buildFeishuSavedContentTarget(table), captureMode)
      : undefined;
  }, [captureMode, content, savedContentRecords]);

  const currentSavedRecord = useMemo(() => {
    if (!content) return undefined;
    if (saveMode === 'markdown') {
      return findSavedContentRecord(savedContentRecords, content.url, buildMarkdownSavedContentTarget(), captureMode);
    }
    return selectedTable ? getSavedRecordForTable(selectedTable) : undefined;
  }, [captureMode, content, getSavedRecordForTable, saveMode, savedContentRecords, selectedTable]);

  const getFieldsForTable = useCallback((table?: TableConfig): ClipFieldConfig[] => {
    const usedIds = new Set<string>();
    const aiFields = (table?.fieldMappings || [])
      .filter(mapping => mapping.sourceType === 'aiField')
      .filter(mapping => {
        const id = mapping.aiFieldId || getAiFieldId(mapping.feishuFieldId);
        if (usedIds.has(id)) return false;
        usedIds.add(id);
        return true;
      })
      .slice(0, MAX_CLIP_FIELDS)
      .map(mapping => {
        const fieldId = mapping.aiFieldId || getAiFieldId(mapping.feishuFieldId);
        const globalField = clipFields.find(field => field.id === fieldId);
        return {
          id: fieldId,
          label: globalField?.label || mapping.aiFieldName?.trim() || mapping.feishuFieldName,
          type: 'text' as const,
        };
      });
    return normalizeClipFields(aiFields.length > 0 ? aiFields : clipFields);
  }, [clipFields]);

  const refreshAiAvailability = useCallback(async () => {
    setAiStatus({ status: 'idle', message: '正在检查本地整理能力...' });
    const ai = await checkAiClipAvailability();
    setAiStatus({ status: ai.status, message: ai.message });
  }, []);

  const applyAiSuggestion = useCallback(async (pageContent: ExtractedPageContent, fields: ClipFieldConfig[]) => {
    setAiStatus({ status: 'loading', message: '正在 AI 写入...' });
    const ai = await generateAiClipSuggestion(pageContent, fields);
    setAiStatus({ status: ai.status, message: ai.message });
    if (ai.suggestion) {
      const hasSummaryField = fields.some(field => getEffectiveClipFieldType(field) === 'summary');
      const hasTagsField = fields.some(field => getEffectiveClipFieldType(field) === 'tags');
      const hasContentTypeField = fields.some(field => getEffectiveClipFieldType(field) === 'contentType');
      setContent(current => current ? { ...current, description: hasSummaryField ? (ai.suggestion?.summary || current.description) : current.description } : current);
      setMetadata(current => current ? {
        ...current,
        tags: hasTagsField ? (ai.suggestion?.tags || current.tags) : current.tags,
        contentType: hasContentTypeField ? (ai.suggestion?.contentType || current.contentType) : current.contentType,
        excerpt: pageContent.contentKind === 'excerpt'
          ? current.excerpt
          : current.excerpt || (hasSummaryField ? ai.suggestion?.summary : '') || '',
        customFields: fields.reduce<Record<string, string>>((acc, field) => {
          if (getEffectiveClipFieldType(field) === 'text') {
            acc[field.id] = ai.suggestion?.fields[field.id] || current.customFields?.[field.id] || '';
          }
          return acc;
        }, { ...(current.customFields || {}) }),
      } : current);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setPanelState('loading');
    setSaveResult(null);
    setPanelStep('target');
    setShowAllTables(false);
    setIsEditingFields(false);
    try {
      const [configs, mode, page, savedRecords, notice, engagement] = await Promise.all([
        getTableConfigs(),
        getSaveMode(),
        extractActivePage(),
        getSavedContentRecords(),
        getExtensionUpdateNotice(),
        getProductEngagement(),
      ]);
      const fields = await getClipFields();
      setTables(configs);
      setSaveMode(mode);
      setSavedContentRecords(savedRecords);
      setUpdateNotice(notice);
      setProductEngagement(engagement);
      if (shouldClearUpdateBadgeOnLaunch(notice)) {
        chrome.action?.setBadgeText?.({ text: '' }).catch(error => {
          console.warn('清除更新标记失败:', error);
        });
      }
      setClipFields(fields);
      setDraftClipFields(fields);
      setSelectedTableId(current => current || configs[0]?.id || '');
      setActivePageData(page);
      setCaptureMode('page');
      setContent(page.content);
      setHtmlElements(page.htmlElements);
      setMetadata(createDefaultKnowledgeMetadata(page.content, {
        contentType: '阅读资料',
        customFields: {},
      }));
      setPanelState('ready');
      await refreshAiAvailability();
    } catch (err) {
      setPanelState('error');
      setError(err instanceof Error ? err.message : '读取页面失败');
    }
  }, [refreshAiAvailability]);

  useEffect(() => {
    loadPage();
    const onActivated = () => loadPage();
    const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.status === 'complete' && tab.active) loadPage();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [loadPage]);

  useEffect(() => {
    if (
      panelState !== 'ready' ||
      panelStep !== 'editor' ||
      !content ||
      aiStatus.status !== 'available' ||
      clipFields.length === 0
    ) {
      return;
    }

    const fieldsKey = clipFields.map(field => `${field.id}:${field.label}`).join('|');
    const autoRunKey = `${content.url}|${content.savedAt}|${selectedTable?.id || 'markdown'}|${fieldsKey}`;
    if (autoAiRunKeysRef.current.has(autoRunKey)) return;

    autoAiRunKeysRef.current.add(autoRunKey);
    applyAiSuggestion(content, clipFields);
  }, [aiStatus.status, applyAiSuggestion, clipFields, content, panelState, panelStep, selectedTable?.id]);

  const updateMetadata = (patch: Partial<KnowledgeMetadata>) => {
    setMetadata(current => current ? { ...current, ...patch } : current);
  };

  const updateExcerptType = (excerptType: ExcerptType) => {
    updateMetadata({ excerptType });
    setContent(current => current ? { ...current, excerptType } : current);
  };

  const updateExcerptText = (excerpt: string) => {
    updateMetadata({ excerpt });
    setContent(current => current ? {
      ...current,
      content: excerpt,
      selectedText: excerpt,
      description: excerpt.length > 160 ? `${excerpt.slice(0, 160).trim()}...` : excerpt,
    } : current);
    setHtmlElements(excerpt.trim() ? [{ type: 'quote', content: excerpt.trim() }] : []);
  };

  const activatePageData = (page: ActivePageData, mode: CaptureMode, table?: TableConfig) => {
    setCaptureMode(mode);
    setContent(page.content);
    setHtmlElements(page.htmlElements);
    setMetadata(createDefaultKnowledgeMetadata(page.content, {
      contentType: mode === 'excerpt' ? '内容素材' : '阅读资料',
      customFields: {},
      excerptType: page.content.excerptType,
    }));
    const fields = getFieldsForTable(table);
    setClipFields(fields);
    setDraftClipFields(fields);
    setSaveResult(null);
    setPanelStep('editor');
  };

  const getFieldValue = (field: ClipFieldConfig): string => {
    if (!content || !metadata) return '';
    const type = getEffectiveClipFieldType(field);
    if (type === 'summary') return content.description || '';
    if (type === 'tags') return metadata.tags.join(', ');
    if (type === 'contentType') return metadata.contentType || '其他';
    return metadata.customFields?.[field.id] || '';
  };

  const updateFieldValue = (field: ClipFieldConfig, value: string) => {
    const type = getEffectiveClipFieldType(field);
    if (type === 'summary' && content) {
      setContent({ ...content, description: value });
      return;
    }
    if (type === 'tags') {
      updateMetadata({ tags: parseKnowledgeTags(value) });
      return;
    }
    if (type === 'contentType') {
      updateMetadata({ contentType: value as KnowledgeMetadata['contentType'] });
      return;
    }
    updateMetadata({
      customFields: {
        ...(metadata?.customFields || {}),
        [field.id]: value,
      },
    });
  };

  const saveDraftFields = async () => {
    const fields = normalizeClipFields(draftClipFields);
    setClipFields(fields);
    setDraftClipFields(fields);
    setIsEditingFields(false);
    const aiMappings = selectedTable?.fieldMappings?.filter(mapping => mapping.sourceType === 'aiField') || [];
    if (selectedTable && aiMappings.length > 0) {
      const labelsById = new Map(fields.map(field => [field.id, field.label]));
      const nextGlobalFields = normalizeClipFields(clipFields.map(field => labelsById.has(field.id)
        ? { ...field, label: labelsById.get(field.id) || field.label }
        : field
      ));
      await saveClipFields(nextGlobalFields);
      const updatedTable = {
        ...selectedTable,
        fieldMappings: selectedTable.fieldMappings.map(mapping => mapping.sourceType === 'aiField'
          ? {
              ...mapping,
              aiFieldId: mapping.aiFieldId || getAiFieldId(mapping.feishuFieldId),
              aiFieldName: labelsById.get(mapping.aiFieldId || getAiFieldId(mapping.feishuFieldId)) || mapping.aiFieldName || mapping.feishuFieldName,
            }
          : mapping
        ),
        updatedAt: Date.now(),
      };
      setTables(current => current.map(table => table.id === updatedTable.id ? updatedTable : table));
      await saveTableConfig(updatedTable);
    } else {
      await saveClipFields(fields);
    }
  };

  const toggleFieldEditing = async () => {
    if (isEditingFields) {
      await saveDraftFields();
    } else {
      setDraftClipFields(clipFields);
      setIsEditingFields(true);
    }
  };

  const updateDraftFieldLabel = (fieldId: string, label: string) => {
    setDraftClipFields(current => current.map(field => field.id === fieldId ? { ...field, label } : field));
  };

  const addDraftField = () => {
    setDraftClipFields(current => {
      if (current.length >= MAX_CLIP_FIELDS) return current;
      return [
        ...current,
        { id: `custom-${Date.now()}`, label: `自定义字段 ${current.length + 1}`, type: 'text' },
      ];
    });
  };

  const removeDraftField = (fieldId: string) => {
    setDraftClipFields(current => current.length <= 1 ? current : current.filter(field => field.id !== fieldId));
  };

  const handleSave = async () => {
    if (!content || !metadata || (saveMode !== 'markdown' && !selectedTable)) return;
    if (captureMode === 'excerpt' && !metadata.excerpt?.trim()) {
      setSaveResult({ success: false, error: '摘录正文为空，请先在网页中选中内容，或手动填写摘录正文。' });
      return;
    }
    setIsSaving(true);
    setSaveResult(null);
    try {
      let result: SaveResult = { success: true };
      if (saveMode !== 'markdown') {
        result = await saveToFeishu(selectedTable!, content, htmlElements, metadata, clipFields);
      }
      if (saveMode !== 'feishu') {
        downloadMarkdown(
          generateMarkdown(content, htmlElements, { metadata, documentUrl: result.documentUrl, clipFields }),
          generateMarkdownFilename(content.title)
        );
      }
      if (result.success) {
        const record = createSavedContentRecord({
          content,
          target: saveMode === 'markdown'
            ? buildMarkdownSavedContentTarget()
            : buildFeishuSavedContentTarget(selectedTable!),
          result,
          metadata,
        });
        setSavedContentRecords(current => upsertSavedContentRecord(current, record));
        await rememberSavedContent(record);
        setProductEngagement(await getProductEngagement());
      }
      setSaveResult(result);
    } catch (err) {
      setSaveResult({
        success: false,
        error: err instanceof Error ? err.message : '保存失败',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkdown = async () => {
    if (!content || !metadata) return;
    if (captureMode === 'excerpt' && !metadata.excerpt?.trim()) {
      setSaveResult({ success: false, error: '摘录正文为空，请先在网页中选中内容，或手动填写摘录正文。' });
      return;
    }
    setIsSaving(true);
    setSaveResult(null);
    try {
      downloadMarkdown(generateMarkdown(content, htmlElements, { metadata, clipFields }), generateMarkdownFilename(content.title));
      const record = createSavedContentRecord({
        content,
        target: buildMarkdownSavedContentTarget(),
        metadata,
      });
      setSavedContentRecords(current => upsertSavedContentRecord(current, record));
      await rememberSavedContent(record);
      setProductEngagement(await getProductEngagement());
      setSaveResult({ success: true });
    } catch (err) {
      setSaveResult({
        success: false,
        error: err instanceof Error ? err.message : 'Markdown 保存失败',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiRetry = async () => {
    if (content && aiStatus.status !== 'loading') {
      const fields = isEditingFields ? normalizeClipFields(draftClipFields) : clipFields;
      if (isEditingFields) {
        await saveDraftFields();
      }
      applyAiSuggestion(content, fields);
    }
  };

  const handleSelectTable = (tableId: string) => {
    const table = tables.find(item => item.id === tableId);
    setSelectedTableId(tableId);
    setSaveResult(null);
    if (table && activePageData) {
      activatePageData(activePageData, 'page', table);
    }
  };

  const handleMoveTable = async (tableId: string, direction: -1 | 1) => {
    const index = tables.findIndex(table => table.id === tableId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= tables.length) return;

    const newTables = [...tables];
    [newTables[index], newTables[nextIndex]] = [newTables[nextIndex], newTables[index]];
    setTables(newTables);
    await saveTableConfigs(newTables);
  };

  const openOptions = (hash = '') => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`options/index.html${hash}`) });
  };

  const openTableMapping = (tableId: string) => {
    openOptions(buildTableMappingOptionsHash(tableId));
  };

  const openFeedback = () => {
    chrome.tabs.create({
      url: buildFeedbackIssueUrl({
        extensionVersion: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
      }),
    });
  };

  const openSavedRecordTarget = (record: SavedContentRecord) => {
    const targetUrl = record.documentUrl || record.tableUrl;
    if (targetUrl) chrome.tabs.create({ url: targetUrl });
  };

  const handleSavedRecordReviewAtChange = async (
    record: SavedContentRecord,
    reviewAt?: string
  ) => {
    setSavedContentRecords(await setSavedContentReviewAt(record.key, reviewAt));
  };

  const handleDismissUpdateNotice = async () => {
    setUpdateNotice(null);
    await dismissCurrentUpdateNotice();
    chrome.action?.setBadgeText?.({ text: '' }).catch(error => {
      console.warn('清除更新标记失败:', error);
    });
  };

  const handleDismissRating = async () => {
    setProductEngagement(await dismissRatingInvitation());
  };

  const handleRateExtension = async () => {
    setProductEngagement(await completeRatingInvitation());
    chrome.tabs.create({ url: CHROME_WEB_STORE_REVIEW_URL });
  };

  const goBackToTarget = () => {
    setSaveResult(null);
    if (activePageData) {
      setContent(activePageData.content);
      setHtmlElements(activePageData.htmlElements);
      setMetadata(createDefaultKnowledgeMetadata(activePageData.content, {
        contentType: '阅读资料',
        customFields: {},
      }));
      setCaptureMode('page');
    }
    setPanelStep('target');
  };

  const saveButtonLabel = saveMode === 'markdown'
    ? '下载 Markdown'
    : saveMode === 'both'
      ? '保存并下载'
      : '保存到飞书';
  const visibleClipFields = clipFields.length > 0 ? clipFields : normalizeClipFields();
  const pagePreview = content ? buildPagePreview(content, htmlElements) : '';
  const showRatingInvitation = shouldShowRatingPrompt(productEngagement);
  const ratingInvitation = (
    <RatingInvitationCard
      visible={showRatingInvitation}
      successfulSaveCount={productEngagement.successfulSaveCount}
      onRate={handleRateExtension}
      onDismiss={handleDismissRating}
    />
  );

  return (
    <div className="sp-shell">
      <header className="sp-header">
        <div className="sp-brand">
          <img src="/icons/icon-32.png" alt="Save to Feishu" />
          <div>
            <h1>飞书知识库管理助手</h1>
            <p>
              {panelView === 'library'
                ? '最近保存与待回顾'
                : panelStep === 'target'
                  ? (tables.length === 0 ? '先保存到电脑' : '选择保存位置')
                  : '整理后保存'}
            </p>
          </div>
        </div>
        <div className="sp-header-actions" aria-label="全局操作">
          <button
            className={`sp-header-action ${panelView === 'library' ? 'is-active' : ''}`}
            onClick={() => setPanelView(current => current === 'library' ? 'capture' : 'library')}
            title={panelView === 'library' ? '返回网页剪藏' : '最近保存与待回顾'}
            aria-label={panelView === 'library' ? '返回网页剪藏' : '最近保存与待回顾'}
            type="button"
          >
            <History size={15} />
            <span className="sp-header-tooltip">{panelView === 'library' ? '返回网页剪藏' : '最近保存与待回顾'}</span>
          </button>
          <button className="sp-header-action" onClick={() => openOptions()} title="打开设置" aria-label="打开设置" type="button">
            <Settings size={15} />
            <span className="sp-header-tooltip">打开设置</span>
          </button>
          <button className="sp-header-action" onClick={() => openOptions('#interop')} title="Notion 与飞书同步" aria-label="Notion 与飞书同步" type="button">
            <ArrowLeftRight size={15} />
            <span className="sp-header-tooltip">Notion 与飞书同步</span>
          </button>
          <button className="sp-header-action" onClick={openFeedback} title="问题反馈" aria-label="问题反馈" type="button">
            <MessageSquareWarning size={15} />
            <span className="sp-header-tooltip">问题反馈</span>
          </button>
          <button className="sp-header-action" onClick={loadPage} title="刷新当前页面" aria-label="刷新当前页面" type="button">
            <RefreshCw size={15} />
            <span className="sp-header-tooltip">刷新当前页面</span>
          </button>
        </div>
      </header>

      {panelState === 'loading' && <PanelStateMessage state="loading" />}

      {panelState === 'error' && (
        <PanelStateMessage state="error" message={error} onRetry={loadPage} />
      )}

      {panelState === 'ready' && panelView === 'library' && (
        <SavedContentLibrary
          records={savedContentRecords}
          onBack={() => setPanelView('capture')}
          onOpenOriginal={record => chrome.tabs.create({ url: record.url })}
          onOpenTarget={openSavedRecordTarget}
          onReviewAtChange={handleSavedRecordReviewAtChange}
          formatSavedAt={formatSavedAt}
        />
      )}

      {panelState === 'ready' && panelView === 'capture' && content && metadata && panelStep === 'target' && (
        <main className="sp-main">
          <section className="sp-section sp-target-section">
            <div className="sp-step-label">{tables.length === 0 ? '立即开始' : '1 / 2'}</div>
            <div className="sp-section-title">
              {tables.length === 0 ? <Download size={16} /> : <Database size={16} />}
              <span>{tables.length === 0 ? '本地 Markdown 剪藏' : '选择飞书资料库'}</span>
            </div>
            <div className="sp-excerpt-entry">
              <div className="sp-excerpt-copy">
                <strong>保存某段摘录</strong>
                <span>在网页中选中文字后，直接右键选择“保存选中内容为摘录”，不用切回侧栏。</span>
              </div>
            </div>
            {tables.length > 0 ? (
              <div className="sp-table-list" aria-label="飞书资料库">
                {visibleTables.map(table => {
                  const tableIndex = tables.findIndex(item => item.id === table.id);
                  const savedRecord = getSavedRecordForTable(table);
                  return (
                  <div
                    key={table.id}
                    className={`sp-table-option ${tables.length > 1 ? 'has-actions' : ''} ${table.id === selectedTable?.id ? 'is-selected' : ''}`}
                  >
                    <button className="sp-table-select" onClick={() => handleSelectTable(table.id)} type="button">
                      <span className="sp-table-icon">
                        <Database size={15} />
                      </span>
                      <span className="sp-table-copy">
                        <strong>
                          <span>{table.name}</span>
                          {savedRecord && <span className="sp-table-saved-pill">已保存</span>}
                        </strong>
                        <small>{savedRecord ? `已保存过 · ${formatSavedAt(savedRecord.savedAt)}` : '保存到这个飞书资料库'}</small>
                      </span>
                      <ChevronRight className="sp-table-arrow" size={16} />
                    </button>
                    <button
                      className="sp-table-config-btn"
                      onClick={() => openTableMapping(table.id)}
                      title={`配置 ${table.name} 字段映射`}
                      aria-label={`配置 ${table.name} 字段映射`}
                      type="button"
                    >
                      <Settings size={14} />
                    </button>
                    {tables.length > 1 && (
                      <div className="sp-table-actions" role="group" aria-label={`${table.name} 排序操作`}>
                        <button
                          className="sp-table-sort-btn"
                          onClick={() => handleMoveTable(table.id, -1)}
                          disabled={tableIndex <= 0}
                          title="上移"
                          aria-label={`上移 ${table.name}`}
                          type="button"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          className="sp-table-sort-btn"
                          onClick={() => handleMoveTable(table.id, 1)}
                          disabled={tableIndex < 0 || tableIndex >= tables.length - 1}
                          title="下移"
                          aria-label={`下移 ${table.name}`}
                          type="button"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
                {tables.length > 5 && (
                  <button className="sp-more-btn" onClick={() => setShowAllTables(current => !current)} type="button">
                    {showAllTables ? '收起资料库' : `显示更多资料库（${tables.length - 5} 个）`}
                  </button>
                )}
              </div>
            ) : (
              <MarkdownFirstSaveCard
                surface="sidepanel"
                isSaving={isSaving}
                result={saveResult}
                onSave={handleMarkdown}
                onSaveToFeishu={() => openOptions()}
              />
            )}

            {tables.length > 0 && (
              <div className="sp-actions sp-actions-single">
                <button className="sp-markdown-btn" onClick={handleMarkdown} disabled={isSaving} type="button">
                  <Download size={16} />
                  <span>仅保存 Markdown</span>
                </button>
              </div>
            )}
          </section>

          <section className="sp-section sp-context-section sp-page">
            <div className="sp-section-title">
              <FileText size={16} />
              <span>当前网页</span>
            </div>
            <h2>{content.title || '未命名网页'}</h2>
            <div className="sp-meta-row">
              <span>{getSourceHostname(content.url)}</span>
              {content.mainImage && <span>含图片</span>}
              {content.selectedText && <span>选中文本</span>}
            </div>
            {pagePreview && (
              <>
                <div className="sp-preview-label">内容预览</div>
                <p className="sp-page-preview">
                  {pagePreview}
                </p>
              </>
            )}
          </section>

          <ExtensionUpdateCard
            notice={updateNotice}
            onDismissNotice={handleDismissUpdateNotice}
            onOpenLibrary={() => setPanelView('library')}
            onOpenTemplates={() => openOptions()}
          />
          {ratingInvitation}
        </main>
      )}

      {panelState === 'ready' && panelView === 'capture' && content && metadata && panelStep === 'editor' && (
        <main className="sp-main">
          <section className="sp-section sp-context-section sp-page sp-editor-context">
            <div className="sp-compact-nav">
              <button className="sp-back-btn" onClick={goBackToTarget} type="button">
                <ChevronLeft size={15} />
                <span>返回</span>
              </button>
              <span className="sp-step-label">2 / 2</span>
            </div>
            <h2>{content.title || '未命名网页'}</h2>
            <div className="sp-meta-row">
              <span>{getSourceHostname(content.url)}</span>
              {captureMode === 'excerpt' && <span>{metadata.excerptType || content.excerptType || '摘录'}</span>}
              {selectedTable && <span>保存到：{selectedTable.name}</span>}
              {content.selectedText && <span>选中文本</span>}
            </div>
            {pagePreview && (
              <>
                <div className="sp-preview-label">内容预览</div>
                <p className="sp-page-preview">
                  {pagePreview}
                </p>
              </>
            )}
          </section>

          <section className="sp-section sp-editor-section">
            <div className="sp-section-heading">
              <div className="sp-section-title">
                <Sparkles size={16} />
                <span>AI 信息整理</span>
              </div>
              <div className="sp-ai-toolbar" role="group" aria-label="AI 信息整理操作">
                <button
                  className="sp-ai-action"
                  onClick={handleAiRetry}
                  disabled={aiStatus.status === 'loading'}
                  type="button"
                  title="AI 写入"
                  aria-label="AI 写入"
                >
                  {aiStatus.status === 'loading' ? <Loader2 className="sp-spin" size={13} /> : <RefreshCw size={13} />}
                  <span>{aiStatus.status === 'loading' ? '写入中' : 'AI 写入'}</span>
                </button>
                <button
                  className={`sp-field-toggle ${isEditingFields ? 'is-active' : ''}`}
                  onClick={toggleFieldEditing}
                  type="button"
                  title={isEditingFields ? '保存字段' : '调整字段'}
                  aria-label={isEditingFields ? '保存字段' : '调整字段'}
                >
                  <Pencil size={13} />
                  <span>{isEditingFields ? '保存字段' : '调整字段'}</span>
                </button>
                <button
                  className="sp-ai-settings-btn"
                  onClick={() => openOptions('#ai')}
                  type="button"
                  title="AI 功能设置"
                  aria-label="AI 功能设置"
                >
                  <Settings size={13} />
                  <span>AI 功能设置</span>
                </button>
              </div>
            </div>
            <div className={`sp-ai-status is-${aiStatus.status}`}>
              {aiStatus.status === 'loading' ? <Loader2 className="sp-spin" size={14} /> : <Sparkles size={14} />}
              <span>{aiStatus.message}</span>
            </div>
            {isEditingFields && (
              <div className="sp-field-editor" aria-label="整理字段设置">
                <div className="sp-field-editor-head">
                  <span>最多 {MAX_CLIP_FIELDS} 个字段；要写入飞书列，请在设置页选择「AI 写入字段」</span>
                  <button className="sp-field-add-btn" onClick={addDraftField} disabled={draftClipFields.length >= MAX_CLIP_FIELDS || (selectedTable?.fieldMappings || []).some(mapping => mapping.sourceType === 'aiField')} type="button">
                    <Plus size={13} />
                    <span>新增</span>
                  </button>
                </div>
                {(selectedTable?.fieldMappings || []).some(mapping => mapping.sourceType === 'aiField') && (
                  <div className="sp-field-editor-note">
                    <Sparkles size={13} />
                    <span>这些字段会在保存时写入已配置的飞书列。</span>
                  </div>
                )}
                {draftClipFields.map(field => (
                  <div className="sp-field-editor-row" key={field.id}>
                    <input
                      value={field.label}
                      onChange={event => updateDraftFieldLabel(field.id, event.target.value)}
                      placeholder="字段名称"
                    />
                    <button
                      className="sp-field-remove-btn"
                      onClick={() => removeDraftField(field.id)}
                      disabled={draftClipFields.length <= 1 || (selectedTable?.fieldMappings || []).some(mapping => mapping.sourceType === 'aiField')}
                      title="删除字段"
                      aria-label={`删除 ${field.label || '字段'}`}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {captureMode === 'excerpt' && (
              <label className="sp-field">
                <span>摘录正文</span>
                <textarea
                  value={metadata.excerpt || content.selectedText || ''}
                  onChange={event => updateExcerptText(event.target.value)}
                  placeholder="保留真正值得回看、引用或写作复用的片段。"
                  rows={5}
                />
              </label>
            )}
            {visibleClipFields.map(field => (
              <label className="sp-field" key={field.id}>
                <span>{field.label}</span>
                {getEffectiveClipFieldType(field) === 'tags' ? (
                  <input
                    value={getFieldValue(field)}
                    onChange={event => updateFieldValue(field, event.target.value)}
                    placeholder="例如：行业研究, 内容素材, 待读"
                  />
                ) : getEffectiveClipFieldType(field) === 'contentType' ? (
                  <select value={getFieldValue(field)} onChange={event => updateFieldValue(field, event.target.value)}>
                    <option>阅读资料</option>
                    <option>行业研究</option>
                    <option>内容素材</option>
                    <option>工具文档</option>
                    <option>其他</option>
                  </select>
                ) : (
                  <textarea
                    value={getFieldValue(field)}
                    onChange={event => updateFieldValue(field, event.target.value)}
                    placeholder={getEffectiveClipFieldType(field) === 'summary' ? '例如：这篇文章介绍了某个趋势、方法或案例。可以直接修改后保存。' : `填写${field.label}`}
                    rows={getEffectiveClipFieldType(field) === 'summary' ? 3 : 2}
                  />
                )}
              </label>
            ))}
            {captureMode === 'excerpt' && (
              <label className="sp-field">
                <span>摘录类型</span>
                <select
                  value={metadata.excerptType || content.excerptType || '观点'}
                  onChange={event => updateExcerptType(event.target.value as ExcerptType)}
                >
                  {EXCERPT_TYPES.map(type => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            )}
            <ReviewScheduleField
              value={metadata.reviewAt || ''}
              onChange={reviewAt => updateMetadata({ reviewAt })}
            />
            <details className="sp-advanced">
              <summary>更多整理信息</summary>
              <label className="sp-field">
                <span>状态</span>
                <select value={metadata.status} onChange={event => updateMetadata({ status: event.target.value })}>
                  <option>未处理</option>
                  <option>待读</option>
                  <option>精读</option>
                  <option>已整理</option>
                </select>
              </label>
              <label className="sp-field">
                <span>个人备注</span>
                <textarea
                  value={metadata.note || ''}
                  onChange={event => updateMetadata({ note: event.target.value })}
                  placeholder="写给自己的补充说明，可留空。"
                  rows={3}
                />
              </label>
            </details>
          </section>

          <section className="sp-section sp-save-section">
            <div className="sp-section-title">
              <Database size={16} />
              <span>保存</span>
            </div>

            {selectedTable && getTableUrl(selectedTable) && (
              <button
                className="sp-destination-link"
                onClick={() => chrome.tabs.create({ url: getTableUrl(selectedTable) })}
                type="button"
              >
                <Database size={15} />
                <span>{selectedTable.name}</span>
                <ExternalLink size={14} />
              </button>
            )}

            {currentSavedRecord && (
              <div className="sp-saved-notice" role="status">
                <Clock size={15} />
                <span>
                  <strong>这页已保存过</strong>
                  <small>
                    {formatSavedAt(currentSavedRecord.savedAt)} 保存到 {currentSavedRecord.targetName}
                    {currentSavedRecord.recordId ? ` · 记录 ${currentSavedRecord.recordId}` : ''}
                  </small>
                </span>
              </div>
            )}

            {saveResult && (
              <div className={`sp-result ${saveResult.success ? 'success' : 'error'}`}>
                {saveResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{saveResult.success ? '保存成功' : saveResult.error || '保存失败'}</span>
              </div>
            )}

            <div className="sp-actions">
              <button className="sp-primary-btn" onClick={handleSave} disabled={isSaving || (!selectedTable && saveMode !== 'markdown')}>
                {isSaving ? <Loader2 className="sp-spin" size={16} /> : <Save size={16} />}
                <span>{saveButtonLabel}</span>
              </button>
              <button className="sp-markdown-btn" onClick={handleMarkdown} type="button">
                <Download size={16} />
                <span>下载 Markdown</span>
              </button>
            </div>
          </section>
          {ratingInvitation}
        </main>
      )}
    </div>
  );
}
