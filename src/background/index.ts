import type { ExtractedPageContent, HtmlElementInfo, KnowledgeMetadata } from '@/types';
import { getExtensionUpdateNotice, getSaveMode, getTableConfigs, rememberSavedContent, saveExtensionUpdateNotice, saveTableConfigs } from '@/services/storageService';
import { saveToFeishu as feishuSaveToFeishu } from '@/services/feishuService';
import { buildFeishuSavedContentTarget, buildMarkdownSavedContentTarget, createSavedContentRecord } from '@/utils/savedContent';
import { createExtensionUpdateNotice, shouldClearUpdateBadgeOnLaunch } from '@/utils/updateNotice';

// 右键菜单 ID
const CONTEXT_MENU_ID = 'save-to-feishu-menu';
const CONTEXT_MENU_DIRECT = 'save-to-feishu-direct';

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
      .catch(() => sendResponse({ saveMode: 'feishu' }));
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
      contexts: ['page', 'link', 'image'],
    });

    // 创建子菜单：直接保存到第一个表格
    chrome.contextMenus.create({
      id: CONTEXT_MENU_DIRECT,
      parentId: CONTEXT_MENU_ID,
      title: '直接保存到第一个表格',
      contexts: ['page'],
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
  }
});

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
