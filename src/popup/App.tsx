import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Database,
  ChevronRight,
  RefreshCw,
  X,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  FolderOpen,
  Link2,
  Clock,
  ExternalLink,
  Download,
  Tags,
  MessageSquare,
  Inbox,
  ArrowLeftRight,
} from 'lucide-react';
import type { ExtractedPageContent, TableConfig, SaveResult, HtmlElementInfo, KnowledgeMetadata, SaveMode } from '@/types';
import { getSaveMode, getTableConfigs, saveTableConfigs } from '@/services/storageService';
import { saveToFeishu } from '@/services/feishuService';
import { generateMarkdown, generateMarkdownFilename, downloadMarkdown } from '@/utils/markdownGenerator';

/**
 * Apple 风格浮窗 - 保存到飞书
 * 设计理念：简洁、优雅、层次分明
 */

/**
 * 表格列表项组件
 */
function TableListItem({
  table,
  index,
  total,
  onSelect,
  onMoveUp,
  onMoveDown,
}: {
  table: TableConfig;
  index: number;
  total: number;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div 
      className="sf-list-item" 
      style={{ animationDelay: `${index * 40}ms` }}
      role="listitem"
    >
      <button 
        className="sf-list-content" 
        onClick={onSelect}
        aria-label={`选择资料库 ${table.name}，已设置 ${table.fieldMappings?.length || 0} 个保存项`}
      >
        <div className="sf-list-icon" aria-hidden="true">
          <Database size={16} strokeWidth={1.5} />
        </div>
        <div className="sf-list-info">
          <span className="sf-list-title">{table.name}</span>
          <span className="sf-list-subtitle">
            已设置 {table.fieldMappings?.length || 0} 个保存项
          </span>
        </div>
        <ChevronRight size={16} className="sf-list-chevron" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="sf-list-actions" role="group" aria-label="表格排序操作">
        <button
          className="sf-action-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          title="上移"
          aria-label={`上移 ${table.name}`}
          aria-disabled={index === 0}
        >
          <ChevronUp size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          className="sf-action-btn"
          onClick={onMoveDown}
          disabled={index === total - 1}
          title="下移"
          aria-label={`下移 ${table.name}`}
          aria-disabled={index === total - 1}
        >
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * 安全获取 URL 的 hostname
 * @param url - URL 字符串
 * @returns hostname 或原始 URL
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getTableUrl(table: TableConfig): string {
  if (table?.tableUrl && table.tableUrl.trim()) {
    return table.tableUrl.trim();
  }
  if (table?.appToken && table?.tableId) {
    return `https://feishu.cn/base/${table.appToken}?table=${table.tableId}`;
  }
  return '';
}

function getDefaultSource(url: string): string {
  return getHostname(url).replace(/^www\./, '');
}

function parseTags(value: string): string[] {
  return value
    .split(/[,，#\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildDefaultMetadata(content: ExtractedPageContent): KnowledgeMetadata {
  return {
    tags: [],
    source: getDefaultSource(content.url),
    status: '未处理',
    excerpt: content.selectedText || content.description || '',
    note: '',
    reviewAt: '',
  };
}

async function getHtmlElementsFromActiveTab(): Promise<HtmlElementInfo[] | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return undefined;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selectors = [
        '#js_content', 'article', '[role="main"]',
        '.post-content', '.entry-content', '.article-content',
        '.markdown-body', 'main', '.content', '#content',
      ];
      let html = '';
      for (const selector of selectors) {
        const el = document.querySelector(selector) as HTMLElement;
        if (el && el.innerHTML?.trim().length > 50) {
          html = el.innerHTML.trim();
          break;
        }
      }
      if (!html) html = document.body.innerHTML?.trim() || '';

      const elements: Array<{
        type: string;
        content?: string;
        level?: number;
        imageUrl?: string;
        listType?: string;
        linkUrl?: string;
      }> = [];
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const contentEl = doc.querySelector('body');
      if (!contentEl) return elements;

      const processed = new Set<Element>();
      const process = (element: Element) => {
        const tag = element.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tag)) return;
        if (processed.has(element)) return;

        if (['h1', 'h2', 'h3'].includes(tag)) {
          processed.add(element);
          const text = element.textContent?.trim();
          if (text) elements.push({ type: 'heading', content: text, level: tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3 });
          return;
        }
        if (tag === 'blockquote') {
          processed.add(element);
          const text = element.textContent?.trim();
          if (text) elements.push({ type: 'quote', content: text });
          return;
        }
        if (tag === 'img') {
          processed.add(element);
          const src = element.getAttribute('data-src') || element.getAttribute('data-original') || element.getAttribute('src');
          if (src && !src.startsWith('data:')) {
            const normalized = src.replace(/&amp;/g, '&').trim().replace(/^\/\//, 'https://');
            if (!normalized.includes('icon') && !normalized.includes('avatar') && !normalized.includes('logo')) {
              elements.push({ type: 'image', imageUrl: normalized });
            }
          }
          return;
        }
        if (tag === 'ul' || tag === 'ol') {
          processed.add(element);
          element.querySelectorAll(':scope > li').forEach(li => {
            processed.add(li);
            const text = li.textContent?.trim();
            if (text) elements.push({ type: 'list', content: text, listType: tag === 'ul' ? 'bullet' : 'ordered' });
          });
          return;
        }
        if (tag === 'li' && processed.has(element.parentElement!)) return;
        if (tag === 'a') {
          const href = element.getAttribute('href');
          const text = element.textContent?.trim();
          if (href && text) {
            processed.add(element);
            elements.push({ type: 'link', content: text, linkUrl: href });
            return;
          }
        }
        if (['p', 'div', 'section', 'article', 'main', 'pre'].includes(tag)) {
          const children = element.querySelectorAll(':scope > h1, :scope > h2, :scope > h3, :scope > blockquote, :scope > ul, :scope > ol, :scope > img, :scope > p, :scope > div');
          if (children.length > 0) {
            Array.from(element.children).forEach(process);
          } else {
            const text = element.textContent?.trim();
            if (text) {
              processed.add(element);
              element.querySelectorAll('*').forEach(el => processed.add(el));
              elements.push({ type: 'text', content: text });
            }
          }
          return;
        }
        Array.from(element.children).forEach(process);
      };
      Array.from(contentEl.children).forEach(process);
      return elements;
    },
  });

  return results?.[0]?.result as HtmlElementInfo[] | undefined;
}

/**
 * 页面内容预览组件
 */
function ContentPreview({ content }: { content: ExtractedPageContent }) {
  return (
    <div className="sf-preview-card">
      <div className="sf-preview-header">
        <div className="sf-preview-icon">
          <FileText size={18} strokeWidth={1.5} />
        </div>
        <span className="sf-preview-label">当前页面</span>
      </div>
      <div className="sf-preview-body">
        <h3 className="sf-preview-title" title={content.title}>
          {content.title}
        </h3>
        <div className="sf-preview-meta">
          <div className="sf-meta-item">
            <Link2 size={12} strokeWidth={1.5} />
            <span className="sf-truncate">{getHostname(content.url)}</span>
          </div>
          {content.mainImage && (
            <div className="sf-meta-badge">
              <ImageIcon size={12} strokeWidth={1.5} />
              <span>含图片</span>
            </div>
          )}
          {content.selectedText && (
            <div className="sf-meta-badge sf-meta-badge-selection">
              <Inbox size={12} strokeWidth={1.5} />
              <span>选中文本</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KnowledgeFields({
  metadata,
  onChange,
}: {
  metadata: KnowledgeMetadata;
  onChange: (metadata: KnowledgeMetadata) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const tagsText = metadata.tags.length > 0 ? metadata.tags.join(', ') : '未加标签';

  return (
    <div className={`sf-knowledge-card ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="sf-knowledge-header">
        <div>
          <span className="sf-knowledge-label">整理信息</span>
          <h3 className="sf-knowledge-title">自动归入 {metadata.status}</h3>
          <p className="sf-knowledge-desc">
            {metadata.source} · {tagsText}
          </p>
        </div>
        <button
          type="button"
          className="sf-knowledge-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '收起' : '补充'}
        </button>
      </div>

      <div className="sf-knowledge-body">
        <label className="sf-field">
          <span><Tags size={13} strokeWidth={1.5} /> 标签</span>
          <input
            value={metadata.tags.join(', ')}
            onChange={(event) => onChange({ ...metadata, tags: parseTags(event.target.value) })}
            placeholder="行业研究, 内容素材"
          />
        </label>

        <div className="sf-field-grid">
          <label className="sf-field">
            <span>状态</span>
            <select
              value={metadata.status}
              onChange={(event) => onChange({ ...metadata, status: event.target.value })}
            >
              <option value="未处理">未处理</option>
              <option value="待读">待读</option>
              <option value="精读">精读</option>
              <option value="已整理">已整理</option>
            </select>
          </label>
          <label className="sf-field">
            <span>下次回顾</span>
            <input
              type="date"
              value={metadata.reviewAt || ''}
              onChange={(event) => onChange({ ...metadata, reviewAt: event.target.value })}
            />
          </label>
        </div>

        <label className="sf-field">
          <span><MessageSquare size={13} strokeWidth={1.5} /> 个人备注</span>
          <textarea
            value={metadata.note || ''}
            onChange={(event) => onChange({ ...metadata, note: event.target.value })}
            placeholder="为什么值得保存？后续准备用在哪里？"
            rows={3}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * 保存结果提示组件
 */
function SaveResultAlert({ result }: { result: SaveResult }) {
  const isSuccess = result.success;
  const tableUrl = result.tableUrl;

  const handleOpenTable = () => {
    if (tableUrl) {
      chrome.tabs.create({ url: tableUrl });
    }
  };

  return (
    <div className={`sf-alert ${isSuccess ? 'sf-alert-success' : 'sf-alert-error'}`}>
      <div className="sf-alert-icon">
        {isSuccess ? (
          <CheckCircle size={18} strokeWidth={1.5} />
        ) : (
          <AlertCircle size={18} strokeWidth={1.5} />
        )}
      </div>
      <div className="sf-alert-content">
        <span className="sf-alert-title">
          {isSuccess ? '保存成功' : '保存失败'}
        </span>
        {!isSuccess && result.error && (
          <span className="sf-alert-message">{result.error}</span>
        )}
        {isSuccess && tableUrl && (
          <button className="sf-alert-action" onClick={handleOpenTable}>
            打开多维表格
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 主应用组件
 */
function PopupApp() {
  const [content, setContent] = useState<ExtractedPageContent | null>(null);
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<KnowledgeMetadata | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>('feishu');

  /**
   * 提取页面内容
   */
  const extractContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('无法获取当前页面');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const getMetaContent = (name: string, property?: string) => {
            // 先尝试按 name 查询
            const byName = document.querySelector(`meta[name="${name}"]`);
            if (byName?.getAttribute('content')) return byName.getAttribute('content');

            // 再尝试按 property 查询
            const propertyValue = property || (name.startsWith('og:') ? name : `og:${name}`);
            const byProperty = document.querySelector(`meta[property="${propertyValue}"]`);
            return byProperty?.getAttribute('content') || '';
          };

          // 优先使用 og:title，其次是 document.title
          let title = getMetaContent('title') || document.title || '';
          // 移除可能的通知计数前缀，例如 "(3) 消息..."
          title = title.replace(/^\(\d+\)\s*/, '').trim();

          // 优先使用 canonical URL，其次是 window.location.href
          const canonical = document.querySelector('link[rel="canonical"]');
          const url = canonical?.getAttribute('href') || window.location.href;
          
          const getCleanText = (selector: string) => {
            const el = document.querySelector(selector);
            if (!el) return '';

            // 克隆元素以避免修改原始 DOM
            const clone = el.cloneNode(true) as HTMLElement;

            // 移除干扰元素（脚本、样式、导航栏、侧边栏等）
            const toRemove = clone.querySelectorAll(
              'script, style, noscript, iframe, svg, header, footer, nav, aside, .sf-ignore'
            );
            toRemove.forEach(node => node.remove());

            // 移除行内 style 标记为隐藏的元素（不用 getComputedStyle，因为 clone 已脱离 DOM）
            const hiddenEls = Array.from(clone.querySelectorAll('[style*="display:none"],[style*="display: none"],[style*="visibility:hidden"],[style*="visibility: hidden"]'));
            hiddenEls.forEach(node => node.remove());

            // 清理空白并截取，正文最多保留 3000 字
            return clone.textContent?.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, 3000) || '';
          };

          // meta description 用于摘要字段
          const description = getMetaContent('description', 'og:description') || '';

          // 正文内容：按优先级尝试常见选择器
          const selectedText = window.getSelection()?.toString().trim().slice(0, 6000) || '';
          const pageContent =
            getCleanText('#js_content') ||        // 微信公众号
            getCleanText('article') ||
            getCleanText('[role="main"]') ||
            getCleanText('.post-content') ||
            getCleanText('.entry-content') ||
            getCleanText('.article-content') ||
            getCleanText('.markdown-body') ||      // GitHub/文档类
            getCleanText('main') ||
            getCleanText('body') || '';

          const mainImage = getMetaContent('', 'og:image') ||
            document.querySelector('article img, main img')?.getAttribute('src') || '';

          return {
            title,
            url,
            description,
            content: selectedText || pageContent,
            selectedText,
            mainImage
          };
        },
      });

      if (results?.[0]?.result) {
        const extracted = {
          ...results[0].result,
          savedAt: new Date().toISOString(),
        };
        setContent(extracted);
        setMetadata(buildDefaultMetadata(extracted));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提取内容失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 加载表格配置
   */
  const loadTables = useCallback(async () => {
    try {
      const configs = await getTableConfigs();
      setTables(configs);
      setSaveMode(await getSaveMode());
    } catch (err) {
      console.error('加载表格配置失败:', err);
    }
  }, []);

  /**
   * 初始化
   */
  useEffect(() => {
    extractContent();
    loadTables();
  }, [extractContent, loadTables]);

  /**
   * 处理保存
   */
  const handleSave = async () => {
    if (!selectedTable || !content) return;

    setIsSaving(true);
    setSaveResult(null);

    try {
      const clipMetadata = metadata || buildDefaultMetadata(content);
      const htmlElements = await getHtmlElementsFromActiveTab();
      let result: SaveResult = { success: true };
      if (saveMode !== 'markdown') {
        result = await saveToFeishu(selectedTable, content, htmlElements, clipMetadata);
      }
      if (saveMode !== 'feishu') {
        const markdown = generateMarkdown(content, htmlElements, {
          metadata: clipMetadata,
          documentUrl: result.documentUrl,
        });
        downloadMarkdown(markdown, generateMarkdownFilename(content.title));
      }
      setSaveResult(result.success ? result : {
        ...result,
        markdownFallback: true,
        error: saveMode !== 'feishu'
          ? `${result.error || '保存到飞书失败'}；已为你下载 Markdown 备份。`
          : result.error,
      });
    } catch (err) {
      const clipMetadata = metadata || buildDefaultMetadata(content);
      const markdown = generateMarkdown(content, undefined, { metadata: clipMetadata });
      downloadMarkdown(markdown, generateMarkdownFilename(content.title));
      setSaveResult({
        success: false,
        markdownFallback: true,
        error: `${err instanceof Error ? err.message : '保存到飞书失败'}；已为你下载 Markdown 备份。`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 保存为 Markdown 文件
   */
  const handleSaveAsMarkdown = async () => {
    if (!content) return;

    try {
      const htmlElements = await getHtmlElementsFromActiveTab();
      const markdown = generateMarkdown(content, htmlElements, {
        metadata: metadata || buildDefaultMetadata(content),
      });
      const filename = generateMarkdownFilename(content.title);
      downloadMarkdown(markdown, filename);
    } catch (err) {
      console.error('保存 Markdown 失败:', err);
      // 降级：只使用纯文本内容
      const markdown = generateMarkdown(content, undefined, {
        metadata: metadata || buildDefaultMetadata(content),
      });
      const filename = generateMarkdownFilename(content.title);
      downloadMarkdown(markdown, filename);
    }
  };

  /**
   * 处理表格排序
   */
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newTables = [...tables];
    [newTables[index - 1], newTables[index]] = [newTables[index], newTables[index - 1]];
    setTables(newTables);
    await saveTableConfigs(newTables);
  };

  const handleMoveDown = async (index: number) => {
    if (index === tables.length - 1) return;
    const newTables = [...tables];
    [newTables[index], newTables[index + 1]] = [newTables[index + 1], newTables[index]];
    setTables(newTables);
    await saveTableConfigs(newTables);
  };

  /**
   * 打开设置页面
   */
  const openOptions = (view?: 'interop') => {
    if (view === 'interop') {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/index.html#interop') });
      return;
    }
    chrome.runtime.openOptionsPage();
  };

  /**
   * 关闭浮窗
   */
  const closePopup = () => {
    window.close();
  };

  /**
   * 渲染表格列表页面
   */
  const renderTableList = () => {
    if (tables.length === 0) {
      return (
        <div className="sf-empty-state">
          <div className="sf-empty-icon">
            <FolderOpen size={32} strokeWidth={1} />
          </div>
          <h3 className="sf-empty-title">先保存成笔记文件</h3>
          <p className="sf-empty-desc">还没连接飞书也没关系，可以先把当前网页整理成一份 Markdown 笔记。</p>
          <button
            className="sf-btn sf-btn-primary sf-btn-large"
            onClick={handleSaveAsMarkdown}
            disabled={!content}
          >
            <Download size={18} strokeWidth={1.5} />
            <span>保存到电脑</span>
          </button>
          <button className="sf-btn sf-btn-secondary sf-btn-large" onClick={() => openOptions()}>
            连接飞书资料库
          </button>
          <button
            className="sf-interop-card"
            onClick={() => openOptions('interop')}
          >
            <span className="sf-interop-icon">
              <ArrowLeftRight size={18} strokeWidth={1.5} />
            </span>
            <span className="sf-interop-copy">
              <span className="sf-interop-title">Notion 与飞书同步</span>
              <span className="sf-interop-desc">将一侧资料同步到另一侧</span>
            </span>
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      );
    }

    return (
      <div className="sf-list-page">
        <div className="sf-list-header">
          <span className="sf-list-label">选择要保存到哪里</span>
          <span className="sf-badge">{tables.length}</span>
        </div>
        <div className="sf-list-container">
          {tables.map((table, index) => (
            <TableListItem
              key={table.id}
              table={table}
              index={index}
              total={tables.length}
              onSelect={() => setSelectedTable(table)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}
        </div>
        <div className="sf-list-footer">
          <Clock size={12} strokeWidth={1.5} />
          <span>点一个资料库开始保存，箭头可以调整常用顺序</span>
        </div>
        <div className="sf-markdown-action">
          <button
            className="sf-interop-card"
            onClick={() => openOptions('interop')}
          >
            <span className="sf-interop-icon">
              <ArrowLeftRight size={18} strokeWidth={1.5} />
            </span>
            <span className="sf-interop-copy">
              <span className="sf-interop-title">Notion 与飞书同步</span>
              <span className="sf-interop-desc">将一侧资料同步到另一侧</span>
            </span>
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
          <button
            className="sf-btn sf-btn-secondary sf-btn-large sf-btn-markdown"
            onClick={handleSaveAsMarkdown}
            disabled={!content}
          >
            <Download size={18} strokeWidth={1.5} />
            <span>只保存到电脑</span>
          </button>
        </div>
      </div>
    );
  };

  /**
   * 渲染保存详情页面
   */
  const renderSavePage = () => {
    if (!selectedTable || !content) return null;
    const tableUrl = getTableUrl(selectedTable);
    const hasTableUrl = Boolean(tableUrl);

    return (
      <div className="sf-save-page">
        <button className="sf-back-btn" onClick={() => setSelectedTable(null)}>
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span>返回</span>
        </button>

        <div className="sf-save-content">
          {/* 选中的表格信息 - 可点击跳转 */}
          <div
            className="sf-target-card sf-target-card-clickable"
            onClick={() => {
              console.log('[Popup] 点击表格卡片', selectedTable);
              console.log('[Popup] tableUrl:', selectedTable?.tableUrl);
              console.log('[Popup] appToken:', selectedTable?.appToken);
              console.log('[Popup] tableId:', selectedTable?.tableId);

              let tableUrl = getTableUrl(selectedTable);

              console.log('[Popup] 最终使用的链接:', tableUrl);

              if (tableUrl) {
                // 在 popup 中使用 window.open 更可靠
                window.open(tableUrl, '_blank');
              } else {
                console.error('[Popup] 无法生成表格链接');
                alert('无法打开表格：请先在设置页重新粘贴一次飞书表格链接');
              }
            }}
            title="点击打开飞书表格"
          >
            <div className="sf-target-icon">
              <Database size={20} strokeWidth={1.5} />
            </div>
            <div className="sf-target-info">
              <span className="sf-target-label">保存到这里 · 点击可打开</span>
              <span className="sf-target-name">{selectedTable.name}</span>
            </div>
            <ExternalLink size={16} strokeWidth={1.5} className="sf-target-link-icon" />
          </div>

          {/* 页面内容预览 */}
          <ContentPreview content={content} />

          {metadata && (
            <KnowledgeFields
              metadata={metadata}
              onChange={setMetadata}
            />
          )}

          {/* 保存结果提示 */}
          {saveResult && <SaveResultAlert result={saveResult} />}

          <button
            className="sf-interop-card sf-interop-card-compact"
            onClick={() => openOptions('interop')}
          >
            <span className="sf-interop-icon">
              <ArrowLeftRight size={18} strokeWidth={1.5} />
            </span>
            <span className="sf-interop-copy">
              <span className="sf-interop-title">同步到 Notion</span>
              <span className="sf-interop-desc">前往设置页配置 Notion 与飞书同步</span>
            </span>
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* 保存按钮 */}
        <div className="sf-save-actions">
          <button
            onClick={() => {
              if (tableUrl) {
                window.open(tableUrl, '_blank');
              }
            }}
            disabled={!hasTableUrl}
            className="sf-btn sf-btn-secondary sf-btn-large"
            title={hasTableUrl ? '打开飞书表格' : '请先在设置页粘贴飞书表格链接'}
          >
            <ExternalLink size={18} strokeWidth={1.5} />
            <span>打开飞书表格</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`sf-btn sf-btn-primary sf-btn-large ${isSaving ? 'sf-btn-loading' : ''}`}
          >
            {isSaving ? (
              <>
                <Loader2 className="sf-spin" size={18} strokeWidth={1.5} />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save size={18} strokeWidth={1.5} />
                <span>
                  {saveMode === 'both'
                    ? '保存到飞书，也存一份到电脑'
                    : saveMode === 'markdown'
                      ? '保存到电脑'
                      : '保存到飞书'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="sf-popup">
      {/* 标题栏 */}
      <header className="sf-header">
        <div className="sf-header-brand">
          <img 
            src="/icons/icon-32.png" 
            alt="Save to Feishu" 
            className="sf-logo"
          />
          <span className="sf-header-title">
            {selectedTable ? '确认后保存' : '保存当前网页'}
          </span>
        </div>
        <div className="sf-header-actions">
          <button 
            className="sf-header-btn" 
            onClick={extractContent}
            disabled={isLoading}
            title="刷新"
          >
            <RefreshCw size={14} strokeWidth={1.5} className={isLoading ? 'sf-spin' : ''} />
          </button>
          <button 
            className="sf-header-btn" 
            onClick={() => openOptions()}
            title="设置"
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
          <button 
            className="sf-header-btn sf-header-btn-close" 
            onClick={closePopup}
            title="关闭"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="sf-main">
        {isLoading ? (
          <div className="sf-loading">
            <div className="sf-loading-spinner">
              <Loader2 size={28} strokeWidth={1.5} className="sf-spin" />
            </div>
            <span className="sf-loading-text">正在获取页面内容...</span>
          </div>
        ) : error ? (
          <div className="sf-empty-state">
            <div className="sf-empty-icon sf-empty-icon-error">
              <AlertCircle size={32} strokeWidth={1} />
            </div>
            <h3 className="sf-empty-title">获取失败</h3>
            <p className="sf-empty-desc">{error}</p>
            <button className="sf-btn sf-btn-secondary" onClick={extractContent}>
              <RefreshCw size={14} strokeWidth={1.5} />
              <span>重试</span>
            </button>
          </div>
        ) : content ? (
          <div className="sf-content">
            {selectedTable ? renderSavePage() : renderTableList()}
          </div>
        ) : (
          <div className="sf-empty-state">
            <div className="sf-empty-icon sf-empty-icon-error">
              <FileText size={32} strokeWidth={1} />
            </div>
            <h3 className="sf-empty-title">无法获取内容</h3>
            <p className="sf-empty-desc">请刷新页面后重试</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default PopupApp;
