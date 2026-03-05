import type { ExtractedPageContent } from '@/types';
import { getTableConfigs, saveTableConfigs } from '@/services/storageService';
import { saveToFeishu as feishuSaveToFeishu } from '@/services/feishuService';

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
});
