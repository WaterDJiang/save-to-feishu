/**
 * 日志工具模块
 * 根据构建模式决定是否输出日志
 */

// 简单的开发环境判断
const isDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * 日志级别
 */
type LogLevel = 'log' | 'warn' | 'error';

/**
 * 统一日志输出
 * @param level - 日志级别
 * @param tag - 日志标签
 * @param args - 日志参数
 */
function log(level: LogLevel, tag: string, ...args: any[]) {
  if (!isDev && level === 'log') return;
  
  const prefix = `[${tag}]`;
  
  switch (level) {
    case 'log':
      console.log(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'error':
      console.error(prefix, ...args);
      break;
  }
}

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 普通日志（仅开发环境）
   */
  log: (tag: string, ...args: any[]) => log('log', tag, ...args),
  
  /**
   * 警告日志（生产环境保留）
   */
  warn: (tag: string, ...args: any[]) => log('warn', tag, ...args),
  
  /**
   * 错误日志（生产环境保留）
   */
  error: (tag: string, ...args: any[]) => log('error', tag, ...args),
  
  /**
   * 调试日志（仅开发环境，带时间戳）
   */
  debug: (tag: string, ...args: any[]) => {
    if (!isDev) return;
    console.log(`[${tag}] [${new Date().toLocaleTimeString()}]`, ...args);
  },
};
