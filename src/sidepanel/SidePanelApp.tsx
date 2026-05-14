import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { ExtractedPageContent, HtmlElementInfo, KnowledgeMetadata, SaveMode, SaveResult, TableConfig } from '@/types';
import { checkAiClipAvailability, generateAiClipSuggestion, type AiClipStatus } from '@/services/aiService';
import { saveToFeishu } from '@/services/feishuService';
import { getSaveMode, getTableConfigs, saveTableConfigs } from '@/services/storageService';
import { downloadMarkdown, generateMarkdown, generateMarkdownFilename } from '@/utils/markdownGenerator';

type PanelState = 'loading' | 'ready' | 'error';
type AiUiStatus = AiClipStatus | 'idle' | 'loading';
type PanelStep = 'target' | 'editor';

interface ActivePageData {
  content: ExtractedPageContent;
  htmlElements: HtmlElementInfo[];
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function parseTags(value: string): string[] {
  return value
    .split(/[,，#\n]/)
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function defaultMetadata(content: ExtractedPageContent): KnowledgeMetadata {
  return {
    tags: [],
    source: hostname(content.url),
    status: '未处理',
    contentType: '阅读资料',
    excerpt: content.selectedText || content.description || '',
    note: '',
    reviewAt: '',
  };
}

function getTableUrl(table: TableConfig | undefined): string {
  if (!table) return '';
  if (table.tableUrl?.trim()) return table.tableUrl.trim();
  if (table.appToken && table.tableId) return `https://feishu.cn/base/${table.appToken}?table=${table.tableId}`;
  return '';
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
        return clone.textContent?.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, 5000) || '';
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

  if (!contentResult.result) throw new Error('无法读取当前页面内容');
  return {
    content: contentResult.result as ExtractedPageContent,
    htmlElements: (elementsResult.result || []) as HtmlElementInfo[],
  };
}

export default function SidePanelApp() {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [error, setError] = useState('');
  const [content, setContent] = useState<ExtractedPageContent | null>(null);
  const [htmlElements, setHtmlElements] = useState<HtmlElementInfo[]>([]);
  const [metadata, setMetadata] = useState<KnowledgeMetadata | null>(null);
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [saveMode, setSaveMode] = useState<SaveMode>('feishu');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [panelStep, setPanelStep] = useState<PanelStep>('target');
  const [showAllTables, setShowAllTables] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ status: AiUiStatus; message: string }>({
    status: 'idle',
    message: '可选：生成摘要、标签和资料类型。',
  });

  const selectedTable = useMemo(
    () => tables.find(table => table.id === selectedTableId) || tables[0],
    [selectedTableId, tables]
  );
  const visibleTables = showAllTables ? tables : tables.slice(0, 5);

  const refreshAiAvailability = useCallback(async () => {
    setAiStatus({ status: 'idle', message: '正在检查本地整理能力...' });
    const ai = await checkAiClipAvailability();
    setAiStatus({ status: ai.status, message: ai.message });
  }, []);

  const applyAiSuggestion = useCallback(async (pageContent: ExtractedPageContent) => {
    setAiStatus({ status: 'loading', message: '正在生成整理建议...' });
    const ai = await generateAiClipSuggestion(pageContent);
    setAiStatus({ status: ai.status, message: ai.message });
    if (ai.suggestion) {
      setContent(current => current ? { ...current, description: ai.suggestion?.summary || current.description } : current);
      setMetadata(current => current ? {
        ...current,
        tags: ai.suggestion?.tags || current.tags,
        contentType: ai.suggestion?.contentType || current.contentType,
        excerpt: current.excerpt || ai.suggestion?.summary || '',
      } : current);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setPanelState('loading');
    setSaveResult(null);
    setPanelStep('target');
    setShowAllTables(false);
    try {
      const [configs, mode, page] = await Promise.all([
        getTableConfigs(),
        getSaveMode(),
        extractActivePage(),
      ]);
      setTables(configs);
      setSaveMode(mode);
      setSelectedTableId(current => current || configs[0]?.id || '');
      setContent(page.content);
      setHtmlElements(page.htmlElements);
      setMetadata(defaultMetadata(page.content));
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

  const updateMetadata = (patch: Partial<KnowledgeMetadata>) => {
    setMetadata(current => current ? { ...current, ...patch } : current);
  };

  const handleSave = async () => {
    if (!content || !metadata || (saveMode !== 'markdown' && !selectedTable)) return;
    setIsSaving(true);
    setSaveResult(null);
    try {
      let result: SaveResult = { success: true };
      if (saveMode !== 'markdown') {
        result = await saveToFeishu(selectedTable!, content, htmlElements, metadata);
      }
      if (saveMode !== 'feishu') {
        downloadMarkdown(
          generateMarkdown(content, htmlElements, { metadata, documentUrl: result.documentUrl }),
          generateMarkdownFilename(content.title)
        );
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

  const handleMarkdown = () => {
    if (!content || !metadata) return;
    downloadMarkdown(generateMarkdown(content, htmlElements, { metadata }), generateMarkdownFilename(content.title));
  };

  const handleAiRetry = () => {
    if (content && aiStatus.status !== 'loading') {
      applyAiSuggestion(content);
    }
  };

  const handleSelectTable = (tableId: string) => {
    setSelectedTableId(tableId);
    setSaveResult(null);
    setPanelStep('editor');
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

  const goBackToTarget = () => {
    setSaveResult(null);
    setPanelStep('target');
  };

  const saveButtonLabel = saveMode === 'markdown'
    ? '下载 Markdown'
    : saveMode === 'both'
      ? '保存并下载'
      : '保存到飞书';

  return (
    <div className="sp-shell">
      <header className="sp-header">
        <div className="sp-brand">
          <img src="/icons/icon-32.png" alt="Save to Feishu" />
          <div>
            <h1>网页知识剪藏</h1>
            <p>{panelStep === 'target' ? '选择保存位置' : '整理后保存'}</p>
          </div>
        </div>
        <div className="sp-header-actions" aria-label="全局操作">
          <button className="sp-header-action" onClick={() => openOptions()} title="打开设置" aria-label="打开设置" type="button">
            <Settings size={15} />
            <span className="sp-header-tooltip">打开设置</span>
          </button>
          <button className="sp-header-action" onClick={() => openOptions('#interop')} title="Notion 与飞书同步" aria-label="Notion 与飞书同步" type="button">
            <ArrowLeftRight size={15} />
            <span className="sp-header-tooltip">Notion 与飞书同步</span>
          </button>
          <button className="sp-header-action" onClick={loadPage} title="刷新当前页面" aria-label="刷新当前页面" type="button">
            <RefreshCw size={15} />
            <span className="sp-header-tooltip">刷新当前页面</span>
          </button>
        </div>
      </header>

      {panelState === 'loading' && (
        <main className="sp-empty">
          <Loader2 className="sp-spin" size={28} />
          <span>正在读取当前网页...</span>
        </main>
      )}

      {panelState === 'error' && (
        <main className="sp-empty">
          <AlertCircle size={28} />
          <strong>无法读取当前网页</strong>
          <p>{error}</p>
          <button className="sp-secondary-btn" onClick={loadPage}>重试</button>
        </main>
      )}

      {panelState === 'ready' && content && metadata && panelStep === 'target' && (
        <main className="sp-main">
          <section className="sp-section sp-target-section">
            <div className="sp-step-label">1 / 2</div>
            <div className="sp-section-title">
              <Database size={16} />
              <span>选择飞书资料库</span>
            </div>
            {tables.length > 0 ? (
              <div className="sp-table-list" aria-label="飞书资料库">
                {visibleTables.map(table => {
                  const tableIndex = tables.findIndex(item => item.id === table.id);
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
                        <strong>{table.name}</strong>
                        <small>保存到这个飞书资料库</small>
                      </span>
                      <ChevronRight className="sp-table-arrow" size={16} />
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
              <div className="sp-notice">
                还没有连接飞书资料库。可以先下载 Markdown，或进入设置添加资料库。
              </div>
            )}

            <div className="sp-actions sp-actions-single">
              <button className="sp-markdown-btn" onClick={handleMarkdown} type="button">
                <Download size={16} />
                <span>仅保存 Markdown</span>
              </button>
            </div>
          </section>

          <section className="sp-section sp-context-section sp-page">
            <div className="sp-section-title">
              <FileText size={16} />
              <span>当前网页</span>
            </div>
            <h2>{content.title || '未命名网页'}</h2>
            <div className="sp-meta-row">
              <span>{hostname(content.url)}</span>
              {content.mainImage && <span>含图片</span>}
              {content.selectedText && <span>选中文本</span>}
            </div>
            {(content.selectedText || content.content || content.description) && (
              <>
                <div className="sp-preview-label">内容预览</div>
                <p className="sp-page-preview">
                  {(content.selectedText || content.description || content.content || '').slice(0, 260)}
                </p>
              </>
            )}
          </section>

          <section className="sp-update-section" aria-label="本次更新">
            <div className="sp-update-head">
              <span className="sp-update-badge">NEW</span>
              <span className="sp-update-title">
                <strong>新工作流上线</strong>
                <small>资料先同步，网页再整理</small>
              </span>
            </div>
            <div className="sp-update-items">
              <button className="sp-update-item is-action" onClick={() => openOptions('#interop')} type="button">
                <span className="sp-update-icon">
                  <ArrowLeftRight size={15} />
                </span>
                <span className="sp-update-copy">
                  <strong>Notion 和飞书互通</strong>
                  <small>点开配置同步</small>
                </span>
                <ChevronRight size={15} />
              </button>
              <div className="sp-update-item is-ai">
                <span className="sp-update-icon">
                  <Sparkles size={15} />
                </span>
                <span className="sp-update-copy">
                  <strong>AI 整理摘要</strong>
                  <small>保存前自动建议</small>
                </span>
              </div>
            </div>
          </section>
        </main>
      )}

      {panelState === 'ready' && content && metadata && panelStep === 'editor' && (
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
              <span>{hostname(content.url)}</span>
              {selectedTable && <span>保存到：{selectedTable.name}</span>}
              {content.selectedText && <span>选中文本</span>}
            </div>
            {(content.selectedText || content.content || content.description) && (
              <>
                <div className="sp-preview-label">内容预览</div>
                <p className="sp-page-preview">
                  {(content.selectedText || content.description || content.content || '').slice(0, 260)}
                </p>
              </>
            )}
          </section>

          <section className="sp-section sp-editor-section">
            <div className="sp-section-heading">
              <div className="sp-section-title">
                <Sparkles size={16} />
                <span>整理信息</span>
              </div>
              <button
                className="sp-ai-action"
                onClick={handleAiRetry}
                disabled={aiStatus.status === 'loading'}
                type="button"
                title="生成整理建议"
                aria-label="生成整理建议"
              >
                {aiStatus.status === 'loading' ? <Loader2 className="sp-spin" size={13} /> : <RefreshCw size={13} />}
                <span>{aiStatus.status === 'loading' ? '生成中' : '生成建议'}</span>
              </button>
            </div>
            <div className={`sp-ai-status is-${aiStatus.status}`}>
              {aiStatus.status === 'loading' ? <Loader2 className="sp-spin" size={14} /> : <Sparkles size={14} />}
              <span>{aiStatus.message}</span>
            </div>
            <label className="sp-field">
              <span>摘要</span>
              <textarea
                value={content.description || ''}
                onChange={event => setContent({ ...content, description: event.target.value })}
                placeholder="例如：这篇文章介绍了某个趋势、方法或案例。可以直接修改后保存。"
                rows={3}
              />
            </label>
            <label className="sp-field">
              <span>标签</span>
              <input
                value={metadata.tags.join(', ')}
                onChange={event => updateMetadata({ tags: parseTags(event.target.value) })}
                placeholder="例如：行业研究, 内容素材, 待读"
              />
            </label>
            <label className="sp-field">
              <span>资料类型</span>
              <select value={metadata.contentType || '其他'} onChange={event => updateMetadata({ contentType: event.target.value as KnowledgeMetadata['contentType'] })}>
                <option>阅读资料</option>
                <option>行业研究</option>
                <option>内容素材</option>
                <option>工具文档</option>
                <option>其他</option>
              </select>
            </label>
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
        </main>
      )}
    </div>
  );
}
