import type { ExtractedPageContent, HtmlElementInfo, KnowledgeMetadata } from '@/types';
import { getClipFields, getExtensionUpdateNotice, getSaveMode, getTableConfigs, rememberSavedContent, saveExtensionUpdateNotice, saveTableConfigs } from '@/services/storageService';
import { saveToFeishu as feishuSaveToFeishu } from '@/services/feishuService';
import { buildFeishuSavedContentTarget, buildMarkdownSavedContentTarget, createSavedContentRecord } from '@/utils/savedContent';
import { createExtensionUpdateNotice, shouldClearUpdateBadgeOnLaunch } from '@/utils/updateNotice';
import { createDefaultKnowledgeMetadata } from '@/utils/knowledgeMetadata';
import { generateMarkdown, generateMarkdownFilename } from '@/utils/markdownGenerator';

// 右键菜单 ID
const CONTEXT_MENU_ID = 'save-to-feishu-menu';
const CONTEXT_MENU_DIRECT = 'save-to-feishu-direct';
const CONTEXT_MENU_EXCERPT_MARKDOWN = 'save-to-feishu-excerpt-markdown';
const CONTEXT_MENU_EXCERPT_OPTIONS = 'save-to-feishu-excerpt-options';
const CONTEXT_MENU_EXCERPT_TABLE_PREFIX = 'save-to-feishu-excerpt-table:';

/**
 * 缓存的最新页面内容
 */
let latestContent: ExtractedPageContent | null = null;

/**
 * 监听消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 处理 content script 发来的消息
  if (message.action === 'contentExtracted') {
    latestContent = message.content;
    sendResponse({ success: true });
  } else if (message.action === 'getLatestContent') {
    sendResponse({ content: latestContent });
  } else if (message.action === 'getSaveMode') {
    getSaveMode()
      .then(saveMode => sendResponse({ saveMode }))
      .catch(() => sendResponse({ saveMode: 'markdown' }));
    return true;
  } else if (message.action === 'recordMarkdownSave') {
    if (message.content) {
      rememberSavedContent(createSavedContentRecord({
        content: message.content,
        target: buildMarkdownSavedContentTarget(),
        metadata: message.metadata,
      }))
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '记录保存次数失败',
        }));
      return true;
    }
    sendResponse({ success: false, error: '缺少网页内容' });
  } else if (message.action === 'openInteropOptions') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/index.html#interop') });
    sendResponse({ success: true });
  } else if (message.action === 'openOptionsPage' || message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
  // 兼容旧入口和设置页发来的保存消息
  else if (message.action === 'getTableConfigs') {
    getTableConfigs()
      .then(tables => {
        sendResponse({ tables });
      })
      .catch(error => {
        console.error('获取表格配置失败:', error);
        sendResponse({ tables: [], error: error instanceof Error ? error.message : '获取失败' });
      });
    return true; // 保持消息通道开放
  } else if (message.action === 'saveTableConfigs') {
    saveTableConfigs(message.tables)
      .then(() => {
        createContextMenus();
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('保存表格配置失败:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '保存失败' });
      });
    return true;
  } else if (message.action === 'saveToFeishu') {
    feishuSaveToFeishu(message.table, message.content, message.htmlElements, message.metadata)
      .then(async result => {
        if (result.success && message.table && message.content) {
          await rememberSavedContent(createSavedContentRecord({
            content: message.content,
            target: buildFeishuSavedContentTarget(message.table),
            result,
            metadata: message.metadata,
          }));
        }
        sendResponse(result);
      })
      .catch(error => {
        console.error('保存到飞书失败:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '保存失败'
        });
      });
    return true;
  }
  return true;
});

/**
 * 点击插件图标时打开侧边栏
 */
chrome.action.onClicked.addListener(async (tab) => {
  await clearUpdateBadgeOnLaunch();
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('无法打开侧边栏:', error);
    }
  }
});

/**
 * 插件安装时
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Save to Feishu extension installed');
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(error => {
    console.warn('设置点击图标打开侧边栏失败:', error);
  });
  handleInstalled(details);
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

/**
 * 创建右键菜单
 */
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.warn('清理右键菜单失败:', chrome.runtime.lastError.message);
    }

    // 创建顶级菜单
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: '保存到飞书',
      contexts: ['page', 'link', 'image', 'selection'],
    });

    // 创建子菜单：直接保存到第一个表格
    chrome.contextMenus.create({
      id: CONTEXT_MENU_DIRECT,
      parentId: CONTEXT_MENU_ID,
      title: '直接保存到第一个表格',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_EXCERPT_MARKDOWN,
      parentId: CONTEXT_MENU_ID,
      title: '保存选中摘录为 Markdown',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_EXCERPT_OPTIONS,
      parentId: CONTEXT_MENU_ID,
      title: '打开设置配置资料库...',
      contexts: ['selection'],
    });

    getTableConfigs()
      .then(tables => {
        tables.slice(0, 8).forEach(table => {
          chrome.contextMenus.create({
            id: getExcerptTableMenuId(table.id),
            parentId: CONTEXT_MENU_ID,
            title: `保存选中摘录到：${truncateMenuTitle(table.name || '未命名资料库')}`,
            contexts: ['selection'],
          });
        });
      })
      .catch(error => {
        console.warn('创建摘录右键菜单失败:', error);
      });

    console.log('右键菜单已创建');
  });
}

async function handleInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
  const notice = createExtensionUpdateNotice({
    reason: details.reason,
    previousVersion: details.previousVersion,
    version: chrome.runtime.getManifest().version,
  });
  if (!notice) return;

  try {
    await saveExtensionUpdateNotice(notice);
    await chrome.action.setBadgeBackgroundColor({ color: '#1456d9' });
    await chrome.action.setBadgeText({ text: 'NEW' });
  } catch (error) {
    console.warn('保存更新提醒失败:', error);
  }
}

async function clearUpdateBadgeOnLaunch(): Promise<void> {
  try {
    const notice = await getExtensionUpdateNotice();
    if (shouldClearUpdateBadgeOnLaunch(notice)) {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.warn('清除更新标记失败:', error);
  }
}

/**
 * 处理右键菜单点击
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === CONTEXT_MENU_ID) {
    try {
      await clearUpdateBadgeOnLaunch();
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('无法打开侧边栏:', error);
    }
  } else if (info.menuItemId === CONTEXT_MENU_DIRECT) {
    // 直接保存到第一个表格
    await handleDirectSave(tab.id);
  } else if (info.menuItemId === CONTEXT_MENU_EXCERPT_MARKDOWN) {
    await handleSelectionExcerptSave(tab, info, { type: 'markdown' });
  } else if (info.menuItemId === CONTEXT_MENU_EXCERPT_OPTIONS) {
    chrome.runtime.openOptionsPage();
  } else if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith(CONTEXT_MENU_EXCERPT_TABLE_PREFIX)) {
    const tableId = info.menuItemId.slice(CONTEXT_MENU_EXCERPT_TABLE_PREFIX.length);
    await handleSelectionExcerptSave(tab, info, { type: 'feishu', tableId });
  }
});

function getExcerptTableMenuId(tableId: string): string {
  return `${CONTEXT_MENU_EXCERPT_TABLE_PREFIX}${tableId}`;
}

function truncateMenuTitle(value: string, maxLength = 28): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized;
}

async function buildSelectionExcerptContent(
  tab: chrome.tabs.Tab,
  info: chrome.contextMenus.OnClickData
): Promise<{ content: ExtractedPageContent; metadata: KnowledgeMetadata; htmlElements: HtmlElementInfo[] }> {
  const excerpt = info.selectionText?.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim() || '';
  if (!excerpt) {
    throw new Error('没有读取到选中的文字，请重新选中一段内容后再右键保存。');
  }

  const fallbackUrl = info.pageUrl || tab.url || '';
  const fallbackTitle = tab.title || '未命名网页';
  let pageInfo: { title: string; url: string; mainImage?: string } = {
    title: fallbackTitle,
    url: fallbackUrl,
  };

  if (tab.id) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const getMeta = (name: string, property?: string): string => {
            const selector = property
              ? `meta[property="${property}"]`
              : `meta[name="${name}"], meta[property="${name}"]`;
            return document.querySelector(selector)?.getAttribute('content') || '';
          };
          return {
            title: getMeta('title', 'og:title') || document.title || '',
            url: window.location.href,
            mainImage: getMeta('image', 'og:image'),
          };
        },
      });
      if (result?.result) {
        pageInfo = {
          title: result.result.title || fallbackTitle,
          url: result.result.url || fallbackUrl,
          mainImage: result.result.mainImage || undefined,
        };
      }
    } catch (error) {
      console.warn('读取页面元信息失败，使用右键事件信息:', error);
    }
  }

  const content: ExtractedPageContent = {
    title: `摘录：${pageInfo.title || fallbackTitle}`,
    url: pageInfo.url || fallbackUrl,
    content: excerpt,
    description: excerpt.length > 160 ? `${excerpt.slice(0, 160).trim()}...` : excerpt,
    selectedText: excerpt,
    mainImage: pageInfo.mainImage,
    savedAt: new Date().toISOString(),
    contentKind: 'excerpt',
    excerptType: '观点',
  };

  return {
    content,
    metadata: createDefaultKnowledgeMetadata(content, {
      contentType: '内容素材',
      excerptType: '观点',
      customFields: {},
    }),
    htmlElements: [{ type: 'quote', content: excerpt }],
  };
}

async function handleSelectionExcerptSave(
  tab: chrome.tabs.Tab,
  info: chrome.contextMenus.OnClickData,
  target: { type: 'markdown' } | { type: 'feishu'; tableId: string }
): Promise<void> {
  if (!tab.id) return;

  try {
    const { content, metadata, htmlElements } = await buildSelectionExcerptContent(tab, info);
    const clipFields = await getClipFields();

    if (target.type === 'markdown') {
      const markdown = generateMarkdown(content, htmlElements, { metadata, clipFields });
      const filename = generateMarkdownFilename(content.title);
      await downloadMarkdownFromTab(tab.id, markdown, filename);
      await rememberSavedContent(createSavedContentRecord({
        content,
        target: buildMarkdownSavedContentTarget(),
        metadata,
      }));
      await showPageToast(tab.id, '已保存 Markdown 摘录', 'success');
      await showActionBadge('✓', '#1f8f4d');
      return;
    }

    const tables = await getTableConfigs();
    const table = tables.find(item => item.id === target.tableId);
    if (!table) {
      throw new Error('没有找到这个飞书资料库，请重新加载扩展或到设置页检查配置。');
    }

    const result = await feishuSaveToFeishu(table, content, htmlElements, metadata, clipFields);
    if (!result.success) {
      throw new Error(result.error || '保存摘录失败');
    }

    await rememberSavedContent(createSavedContentRecord({
      content,
      target: buildFeishuSavedContentTarget(table),
      result,
      metadata,
    }));
    await showPageToast(tab.id, `已保存摘录到 ${table.name || '飞书资料库'}`, 'success');
    await showActionBadge('✓', '#1f8f4d');
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存摘录失败';
    console.error('保存选中摘录失败:', error);
    await showPageToast(tab.id, message, 'error');
    await showActionBadge('!', '#d92d20');
  }
}

async function downloadMarkdownFromTab(tabId: number, markdown: string, filename: string): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [markdown, filename],
    func: (markdownText: string, downloadName: string) => {
      const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}

async function showPageToast(tabId: number, message: string, type: 'success' | 'error'): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [message, type],
      func: (toastMessage: string, toastType: 'success' | 'error') => {
        document.getElementById('save-to-feishu-context-toast')?.remove();
        const toast = document.createElement('div');
        toast.id = 'save-to-feishu-context-toast';
        toast.textContent = toastMessage;
        toast.style.cssText = [
          'position:fixed',
          'top:20px',
          'right:20px',
          'z-index:2147483647',
          'max-width:320px',
          'padding:12px 16px',
          'border-radius:8px',
          'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          'box-shadow:0 10px 30px rgba(15,23,42,0.18)',
          toastType === 'success'
            ? 'background:#ecfdf3;color:#05603a;border:1px solid #abefc6'
            : 'background:#fff4ed;color:#b42318;border:1px solid #fecdca',
        ].join(';');
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 2800);
      },
    });
  } catch (error) {
    console.warn('页面提示展示失败:', error);
  }
}

/**
 * 直接保存到第一个表格
 */
async function handleDirectSave(tabId: number) {
  try {
    // 1. 获取当前标签页内容
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 获取页面基本信息
        const getMetaContent = (name: string): string => {
          const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
          return meta ? meta.getAttribute('content') || '' : '';
        };

        const title = getMetaContent('og:title') || document.title || '';
        const url = window.location.href;
        const mainImage = getMetaContent('og:image') || '';

        return {
          title,
          url,
          mainImage,
          savedAt: new Date().toISOString(),
        };
      },
    });

    const content = results?.[0]?.result as ExtractedPageContent | undefined;
    if (!content) {
      throw new Error('无法提取页面内容');
    }

    // 2. 获取表格配置
    const tables = await getTableConfigs();
    if (tables.length === 0) {
      // 没有配置，打开设置页面
      chrome.runtime.openOptionsPage();
      return;
    }

    // 3. 提取 HTML 元素
    const htmlResults = await chrome.scripting.executeScript<[], HtmlElementInfo[]>({
      target: { tabId },
      func: () => {
        // 复用 content-script 中的 parseHtmlToElements 逻辑
        const parseHtmlToElements = (html: string): HtmlElementInfo[] => {
          const elements: HtmlElementInfo[] = [];
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // 提取图片
          const images = doc.querySelectorAll('img[src]');
          images.forEach((img) => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.includes('avatar')) {
              elements.push({
                type: 'image',
                imageUrl: src,
              });
            }
          });

          // 提取标题
          const headings = doc.querySelectorAll('h1, h2, h3');
          headings.forEach((heading) => {
            const level = parseInt(heading.tagName.charAt(1)) as 1 | 2 | 3;
            if (level <= 3) {
              elements.push({
                type: 'heading',
                level,
                content: heading.textContent?.trim() || '',
              });
            }
          });

          // 提取段落
          const paragraphs = doc.querySelectorAll('p');
          paragraphs.forEach((p) => {
            const text = p.textContent?.trim();
            if (text && text.length > 10) {
              elements.push({
                type: 'text',
                content: text,
              });
            }
          });

          return elements;
        };

        return parseHtmlToElements(document.body.innerHTML);
      },
    });

    const htmlElements = htmlResults?.[0]?.result || [];

    // 4. 使用第一个表格保存
    const metadata: KnowledgeMetadata = {
      tags: [],
      source: (() => {
        try {
          return new URL(content.url).hostname;
        } catch {
          return content.url;
        }
      })(),
      status: '未处理',
      contentType: '阅读资料',
      excerpt: content.description || '',
      note: '',
      reviewAt: '',
    };
    const result = await feishuSaveToFeishu(tables[0], content, htmlElements, metadata);

    if (result.success) {
      await rememberSavedContent(createSavedContentRecord({
        content,
        target: buildFeishuSavedContentTarget(tables[0]),
        result,
        metadata,
      }));
    }

    await showActionBadge(result.success ? '✓' : '!', result.success ? '#1f8f4d' : '#d92d20');
  } catch (error) {
    console.error('直接保存失败:', error);
    await showActionBadge('!', '#d92d20');
  }
}

async function showActionBadge(text: string, color: string): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2500);
}
