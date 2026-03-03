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
} from 'lucide-react';
import type { ExtractedPageContent, TableConfig, SaveResult } from '@/types';
import { getTableConfigs, saveTableConfigs } from '@/services/storageService';
import { saveToFeishu } from '@/services/feishuService';

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
        aria-label={`选择表格 ${table.name}，包含 ${table.fieldMappings?.length || 0} 个字段`}
      >
        <div className="sf-list-icon" aria-hidden="true">
          <Database size={16} strokeWidth={1.5} />
        </div>
        <div className="sf-list-info">
          <span className="sf-list-title">{table.name}</span>
          <span className="sf-list-subtitle">
            {table.fieldMappings?.length || 0} 个字段
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
        </div>
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
          const content =
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

          return { title, url, description, content, mainImage };
        },
      });

      if (results?.[0]?.result) {
        setContent({
          ...results[0].result,
          savedAt: new Date().toISOString(),
        });
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
      const result = await saveToFeishu(selectedTable, content);
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
  const openOptions = () => {
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
          <h3 className="sf-empty-title">暂无保存目标</h3>
          <p className="sf-empty-desc">请先添加飞书多维表格配置</p>
          <button className="sf-btn sf-btn-primary" onClick={openOptions}>
            前往设置
          </button>
        </div>
      );
    }

    return (
      <div className="sf-list-page">
        <div className="sf-list-header">
          <span className="sf-list-label">选择保存位置</span>
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
          <span>点击表格选择，使用箭头调整顺序</span>
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
                alert('无法打开表格：缺少必要的表格信息 (tableUrl 或 appToken + tableId)');
              }
            }}
            title="点击打开多维表格"
          >
            <div className="sf-target-icon">
              <Database size={20} strokeWidth={1.5} />
            </div>
            <div className="sf-target-info">
              <span className="sf-target-label">保存到 · 点击打开表格</span>
              <span className="sf-target-name">{selectedTable.name}</span>
            </div>
            <ExternalLink size={16} strokeWidth={1.5} className="sf-target-link-icon" />
          </div>

          {/* 页面内容预览 */}
          <ContentPreview content={content} />

          {/* 保存结果提示 */}
          {saveResult && <SaveResultAlert result={saveResult} />}
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
            title={hasTableUrl ? '打开多维表格' : '请先在设置页配置表格链接'}
          >
            <ExternalLink size={18} strokeWidth={1.5} />
            <span>一键打开飞书表格</span>
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
                <span>保存到飞书</span>
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
            {selectedTable ? '确认保存' : 'Save to Feishu'}
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
            onClick={openOptions}
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
