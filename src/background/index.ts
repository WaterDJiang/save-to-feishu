import type { ExtractedPageContent, HtmlElementInfo } from '@/types';
import { getTableConfigs, saveTableConfigs } from '@/services/storageService';
import { saveToFeishu as feishuSaveToFeishu } from '@/services/feishuService';

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
  } else if (message.action === 'openOptionsPage' || message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
  // 处理浮窗发来的消息
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
    feishuSaveToFeishu(message.table, message.content, message.htmlElements)
      .then(result => {
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
 * 点击插件图标时显示浮窗
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (error) {
      console.error('无法发送消息到 content script:', error);
    }
  }
});

/**
 * 插件安装时
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Save to Feishu extension installed');
  createContextMenu();
});

/**
 * 创建右键菜单
 */
function createContextMenu() {
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
}

/**
 * 处理右键菜单点击
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === CONTEXT_MENU_ID) {
    // 显示浮窗让用户选择表格
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (error) {
      console.error('无法发送消息到 content script:', error);
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
    const result = await feishuSaveToFeishu(tables[0], content, htmlElements);

    // 5. 通知用户结果
    if (result.success) {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showNotification',
        message: '保存成功！',
        type: 'success',
      });
    } else {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showNotification',
        message: `保存失败: ${result.error}`,
        type: 'error',
      });
    }
  } catch (error) {
    console.error('直接保存失败:', error);
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showNotification',
        message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
        type: 'error',
      });
    } catch (e) {
      // 如果发送消息失败，忽略
    }
  }
}
