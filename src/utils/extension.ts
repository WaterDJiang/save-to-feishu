/**
 * Chrome 扩展上下文检查工具
 * 用于检测扩展上下文是否有效
 */

/**
 * 检查扩展上下文是否有效
 * @returns 扩展上下文是否有效
 */
export function isExtensionContextValid(): boolean {
  return typeof chrome !== 'undefined' && 
         chrome.runtime !== undefined && 
         chrome.runtime.id !== undefined;
}

/**
 * 安全调用 Chrome API
 * @param fn - 要调用的函数
 * @param fallback - 失败时的回退值
 * @returns 调用结果或回退值
 */
export async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isExtensionContextValid()) {
    console.warn('[Extension] 扩展上下文已失效');
    return fallback;
  }
  
  try {
    return await fn();
  } catch (error) {
    console.error('[Extension] Chrome API 调用失败:', error);
    
    // 如果是上下文失效错误，提示用户
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      alert('插件上下文已失效，请刷新页面后重试。');
    }
    
    return fallback;
  }
}

/**
 * 安全发送消息
 * @param message - 要发送的消息
 * @returns 响应结果
 */
export async function safeSendMessage<T = any>(message: any): Promise<T | null> {
  return safeCall(
    () => chrome.runtime.sendMessage(message),
    null
  );
}

/**
 * 检查并提示扩展上下文失效
 */
export function checkAndAlertContextInvalid(): void {
  if (!isExtensionContextValid()) {
    alert('插件上下文已失效，请刷新页面后重试。');
  }
}
