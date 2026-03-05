import type { ExtractedPageContent, TableConfig, SaveResult, HtmlElementInfo } from '@/types';

/**
 * 从 meta 标签获取内容
 * @param name - meta 标签的 name 属性值
 * @param property - 可选的 meta 标签的 property 属性值（用于 Open Graph）
 */
function getMetaContent(name: string, property?: string): string | null {
  // 先尝试按 name 查询
  const byName = document.querySelector(`meta[name="${name}"]`);
  if (byName?.getAttribute('content')) return byName.getAttribute('content');

  // 再尝试按 property 查询
  const propertyValue = property || (name.startsWith('og:') ? name : `og:${name}`);
  const byProperty = document.querySelector(`meta[property="${propertyValue}"]`);
  return byProperty?.getAttribute('content') || null;
}

/**
 * 提取页面主要图片
 */
function extractMainImage(): string | null {
  const ogImage = getMetaContent('og:image');
  if (ogImage) return ogImage;

  const twitterImage = getMetaContent('twitter:image');
  if (twitterImage) return twitterImage;

  const images = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const src = img.src || img.getAttribute('data-src');
      if (!src) return false;
      if (src.includes('icon') || src.includes('logo') || src.includes('avatar')) return false;
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      return width > 200 && height > 100;
    })
    .map(img => img.src || img.getAttribute('data-src') || '')
    .filter(Boolean);

  return images[0] || null;
}

/**
 * 清理元素并获取纯文本
 */
function getCleanText(element: HTMLElement | null): string {
  if (!element) return '';

  // 克隆元素以避免修改原始 DOM
  const clone = element.cloneNode(true) as HTMLElement;

  // 移除干扰元素（脚本、样式、导航栏、侧边栏等）
  const toRemove = clone.querySelectorAll(
    'script, style, noscript, iframe, svg, header, footer, nav, aside, .sf-ignore, .sidebar, .menu, .navigation'
  );
  toRemove.forEach(node => node.remove());

  // 移除行内 style 标记为隐藏的元素
  const hiddenEls = Array.from(
    clone.querySelectorAll('[style*="display:none"],[style*="display: none"],[style*="visibility:hidden"],[style*="visibility: hidden"]')
  );
  hiddenEls.forEach(node => node.remove());

  // 清理空白并截取，正文最多保留 3000 字
  return clone.textContent?.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, 3000) || '';
}

/**
 * 提取页面主要内容
 */
function extractMainContent(): string {
  const selectors = [
    '#js_content',              // 微信公众号
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.markdown-body',            // GitHub/文档类
    'main',
    '.content',
    '#content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      const text = getCleanText(element);
      if (text.length > 50) {
        return text;
      }
    }
  }

  return getCleanText(document.body);
}

/**
 * 提取发布日期
 */
function extractPublishDate(): string | null {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="published_time"]',
    'time[datetime]',
    '.publish-date',
    '.post-date',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const date = element.getAttribute('content') ||
        element.getAttribute('datetime') ||
        element.textContent;
      if (date) return date;
    }
  }

  return null;
}

/**
 * 提取页面HTML内容
 */
function extractPageHtml(): string {
  const selectors = [
    '#js_content',              // 微信公众号
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.markdown-body',            // GitHub/文档类
    'main',
    '.content',
    '#content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      const html = element.innerHTML?.trim();
      if (html && html.length > 50) {
        return html;
      }
    }
  }

  return document.body.innerHTML?.trim() || '';
}

/**
 * 解析HTML为元素信息数组（在 content-script 中执行，因为 Service Worker 没有 DOMParser）
 */
function parseHtmlToElements(html: string): HtmlElementInfo[] {
  const elements: HtmlElementInfo[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 提取主要内容
    const contentElement = doc.querySelector('body');
    if (!contentElement) return elements;

    // 记录已处理的元素，避免重复
    const processedElements = new Set<Element>();

    // 递归处理元素
    const processElement = (element: Element): void => {
      const tagName = element.tagName.toLowerCase();

      // 跳过不需要的元素
      if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
        return;
      }

      // 如果已经被处理过，跳过
      if (processedElements.has(element)) {
        return;
      }

      // 处理标题
      if (['h1', 'h2', 'h3'].includes(tagName)) {
        processedElements.add(element);
        const level = tagName === 'h1' ? 1 : tagName === 'h2' ? 2 : 3;
        const text = element.textContent?.trim();
        if (text) {
          elements.push({
            type: 'heading',
            content: text,
            level: level as 1 | 2 | 3,
          });
        }
        return;
      }

      // 处理图片
      if (tagName === 'img') {
        processedElements.add(element);
        const src = element.getAttribute('src') || element.getAttribute('data-src');
        if (src && !src.startsWith('data:')) {
          // 跳过 data URI 和小图标
          if (!src.includes('icon') && !src.includes('avatar') && !src.includes('logo')) {
            elements.push({
              type: 'image',
              imageUrl: src,
            });
          }
        }
        return;
      }

      // 处理列表
      if (tagName === 'ul' || tagName === 'ol') {
        processedElements.add(element);
        const listType = tagName === 'ul' ? 'bullet' : 'ordered';
        const listItems = element.querySelectorAll(':scope > li');

        listItems.forEach(li => {
          processedElements.add(li);
          const text = li.textContent?.trim();
          if (text) {
            elements.push({
              type: 'list',
              content: text,
              listType,
            });
          }
        });
        return;
      }

      // 处理列表项（如果父元素已经被处理，跳过）
      if (tagName === 'li' && processedElements.has(element.parentElement!)) {
        return;
      }

      // 处理链接（独立链接）
      if (tagName === 'a') {
        const href = element.getAttribute('href');
        const text = element.textContent?.trim();
        const parent = element.parentElement;
        const isInlineLink = parent && !['p', 'div', 'section', 'article', 'li'].includes(parent.tagName.toLowerCase());

        if (href && text && isInlineLink) {
          processedElements.add(element);
          elements.push({
            type: 'link',
            content: text,
            linkUrl: href,
          });
          return;
        }
      }

      // 处理段落和块级元素
      if (['p', 'div', 'section', 'article', 'main', 'blockquote', 'pre'].includes(tagName)) {
        const childBlocks = element.querySelectorAll(':scope > h1, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > img, :scope > p, :scope > div, :scope > article, :scope > section');

        if (childBlocks.length > 0) {
          Array.from(element.children).forEach(child => {
            processElement(child);
          });
        } else {
          const text = element.textContent?.trim();
          if (text && text.length > 0) {
            processedElements.add(element);
            element.querySelectorAll('*').forEach(el => processedElements.add(el));
            elements.push({
              type: 'text',
              content: text,
            });
          }
        }
        return;
      }

      // 其他元素，递归处理子元素
      Array.from(element.children).forEach(child => {
        processElement(child);
      });
    };

    // 开始处理
    Array.from(contentElement.children).forEach(child => {
      processElement(child);
    });

  } catch (error) {
    console.error('[ContentScript] HTML解析异常:', error);
  }

  return elements;
}

/**
 * 提取页面内容
 */
function extractPageContent(): ExtractedPageContent {
  const title = document.title || '';
  const url = window.location.href;
  const description = getMetaContent('description', 'og:description') || '';
  const mainImage = extractMainImage();
  const content = extractMainContent();
  const publishedAt = extractPublishDate();

  return {
    title,
    url,
    description,
    mainImage: mainImage || undefined,
    content,
    publishedAt: publishedAt || undefined,
    savedAt: new Date().toISOString(),
  };
}

/**
 * 通过 background 获取存储的表格配置
 */
async function getTableConfigs(): Promise<TableConfig[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getTableConfigs' }, (response) => {
      resolve(response?.tables || []);
    });
  });
}

/**
 * 通过 background 保存表格配置
 */
async function saveTableConfigs(tables: TableConfig[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'saveTableConfigs', tables }, () => {
      resolve();
    });
  });
}

/**
 * 通过 background 保存到飞书
 */
async function saveToFeishu(table: TableConfig, content: ExtractedPageContent, htmlElements?: HtmlElementInfo[]): Promise<SaveResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'saveToFeishu', table, content, htmlElements },
      (response) => {
        resolve(response || { success: false, error: '保存失败' });
      }
    );
  });
}

/**
 * 浮窗管理器
 */
class FloatingPanel {
  private panel: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private content: ExtractedPageContent | null = null;
  private tables: TableConfig[] = [];
  private selectedTable: TableConfig | null = null;

  /**
   * 获取扩展资源 URL
   */
  private getExtensionURL(path: string): string {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    return '';
  }

  /**
   * 创建 SVG 图标（字符串版本）
   */
  private createSVGIcon(type: string, size = 16): string {
    const icons: Record<string, string> = {
      database: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
      chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
      chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
      chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
      arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
      fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
      image: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
      link: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      save: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
      checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      alertCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
      loader: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="sf-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
      refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>`,
      settings: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
      close: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      folderOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`,
      clock: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    };
    return icons[type] || '';
  }

  /**
   * 创建 SVG 图标元素（DOM 版本）
   */
  private createSVGIconElement(type: string, size = 16): Element {
    const iconString = this.createSVGIcon(type, size);
    const template = document.createElement('template');
    template.innerHTML = iconString.trim();
    const element = template.content.firstChild;
    return (element as Element) || document.createElement('span');
  }

  /**
   * 显示浮窗
   */
  async show() {
    // 检查扩展上下文是否有效
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      console.error('Extension context invalidated');
      alert('插件上下文已失效，请刷新页面后重试。');
      return;
    }

    if (this.shadowRoot) {
      this.close();
      return;
    }

    // 提取页面内容
    this.content = extractPageContent();

    // 加载表格配置
    try {
      this.tables = await getTableConfigs();
    } catch (e) {
      console.error('加载表格配置失败:', e);
      this.tables = [];
    }

    // 创建浮窗
    this.createPanel();
    this.render();
  }

  /**
   * 创建浮窗 DOM
   */
  private createPanel() {
    // 创建 Host 元素
    const host = document.createElement('div');
    host.id = 'save-to-feishu-host';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '0';
    host.style.height = '0';
    host.style.zIndex = '2147483647';
    
    // 创建 Shadow DOM
    this.shadowRoot = host.attachShadow({ mode: 'closed' });

    // 注入 CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = this.getExtensionURL('content-script/floating-panel.css');
    this.shadowRoot.appendChild(link);

    // 创建浮窗容器
    this.panel = document.createElement('div');
    this.panel.className = 'sf-floating-panel';
    this.panel.id = 'sf-floating-panel';
    
    // 阻止事件冒泡到宿主页面
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
    this.panel.addEventListener('mouseup', (e) => e.stopPropagation());
    this.panel.addEventListener('wheel', (e) => e.stopPropagation());

    this.shadowRoot.appendChild(this.panel);
    document.body.appendChild(host);

    // 点击外部关闭 (需要监听 document，但判断 target 是否在 shadow host 内部比较麻烦，因为 closed mode)
    // 简单方案：在 Shadow DOM 内部放一个全屏透明遮罩层来捕获点击
    const overlay = document.createElement('div');
    overlay.className = 'sf-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '-1';
    overlay.addEventListener('click', () => this.close());
    this.shadowRoot.appendChild(overlay);
  }

  /**
   * 处理外部点击
   */
  // private handleOutsideClick = (e: MouseEvent) => {
  //   if (this.panel && !this.panel.contains(e.target as Node)) {
  //     this.close();
  //   }
  // };

  /**
   * 关闭浮窗
   */
  close() {
    if (this.panel) {
      this.panel.classList.add('sf-closing');
      setTimeout(() => {
        const host = document.getElementById('save-to-feishu-host');
        host?.remove();
        this.panel = null;
        this.shadowRoot = null;
        this.selectedTable = null;
      }, 200);
    }
    // document.removeEventListener('click', this.handleOutsideClick);
  }

  /**
   * 渲染浮窗内容
   */
  private render() {
    if (!this.panel) return;

    const header = this.renderHeader();
    const body = this.selectedTable ? this.renderSavePage() : this.renderTableList();

    this.panel.innerHTML = `
      ${header}
      <div class="sf-panel-body">
        ${body}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * 渲染标题栏
   */
  private renderHeader(): string {
    const title = this.selectedTable ? '确认保存' : 'Save to Feishu';
    return `
      <div class="sf-panel-header">
        <div class="sf-panel-brand">
          <img src="${this.getExtensionURL('icons/icon-32.png')}" alt="Save to Feishu" class="sf-panel-logo">
          <span class="sf-panel-title">${title}</span>
        </div>
        <div class="sf-panel-actions">
          <button class="sf-panel-btn" id="sf-btn-refresh" title="刷新">
            ${this.createSVGIcon('refresh', 14)}
          </button>
          <button class="sf-panel-btn" id="sf-btn-settings" title="设置">
            ${this.createSVGIcon('settings', 14)}
          </button>
          <button class="sf-panel-btn sf-panel-btn-close" id="sf-btn-close" title="关闭">
            ${this.createSVGIcon('close', 14)}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染表格列表
   */
  private renderTableList(): string {
    if (this.tables.length === 0) {
      return `
        <div class="sf-empty-state">
          <div class="sf-empty-icon">
            ${this.createSVGIcon('folderOpen', 28)}
          </div>
          <h3 class="sf-empty-title">暂无保存目标</h3>
          <p class="sf-empty-desc">请先添加飞书多维表格配置</p>
          <button class="sf-btn sf-btn-primary" id="sf-btn-open-settings">前往设置</button>
        </div>
      `;
    }

    const tableItems = this.tables.map((table, index) => `
      <div class="sf-list-item" data-index="${index}">
        <button class="sf-list-content" data-action="select" data-index="${index}">
          <div class="sf-list-icon">
            ${this.createSVGIcon('database', 16)}
          </div>
          <div class="sf-list-info">
            <span class="sf-list-title">${this.escapeHtml(table.name)}</span>
            <span class="sf-list-subtitle">${table.fieldMappings?.length || 0} 个字段</span>
          </div>
          ${this.createSVGIcon('chevronRight', 16)}
        </button>
        <div class="sf-list-actions">
          <button class="sf-action-btn" data-action="move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
            ${this.createSVGIcon('chevronUp', 14)}
          </button>
          <button class="sf-action-btn" data-action="move-down" data-index="${index}" ${index === this.tables.length - 1 ? 'disabled' : ''}>
            ${this.createSVGIcon('chevronDown', 14)}
          </button>
        </div>
      </div>
    `).join('');

    return `
      <div class="sf-list-page">
        <div class="sf-list-header">
          <span class="sf-list-label">选择保存位置</span>
          <span class="sf-badge">${this.tables.length}</span>
        </div>
        <div class="sf-list-container">
          ${tableItems}
        </div>
        <div class="sf-list-footer">
          ${this.createSVGIcon('clock', 12)}
          <span>点击表格选择，使用箭头调整顺序</span>
        </div>
      </div>
    `;
  }

  /**
   * 安全获取 URL 的 hostname
   * @param url - URL 字符串
   * @returns hostname 或原始 URL
   */
  private getHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  private getTableUrl(table: TableConfig): string {
    if (table?.tableUrl && table.tableUrl.trim()) {
      return table.tableUrl.trim();
    }
    if (table?.appToken && table?.tableId) {
      return `https://feishu.cn/base/${table.appToken}?table=${table.tableId}`;
    }
    return '';
  }

  /**
   * 渲染保存页面
   */
  private renderSavePage(): string {
    if (!this.content || !this.selectedTable) return '';

    const hostname = this.getHostname(this.content.url);
    const tableUrl = this.getTableUrl(this.selectedTable);

    return `
      <div class="sf-save-page">
        <button class="sf-back-btn" id="sf-btn-back">
          ${this.createSVGIcon('arrowLeft', 16)}
          <span>返回</span>
        </button>

        <div class="sf-target-card">
          <div class="sf-target-icon">
            ${this.createSVGIcon('database', 20)}
          </div>
          <div class="sf-target-info">
            <span class="sf-target-label">保存到</span>
            <span class="sf-target-name">${this.escapeHtml(this.selectedTable.name)}</span>
          </div>
        </div>

        <div class="sf-preview-card">
          <div class="sf-preview-header">
            <div class="sf-preview-icon">
              ${this.createSVGIcon('fileText', 18)}
            </div>
            <span class="sf-preview-label">当前页面</span>
          </div>
          <div class="sf-preview-body">
            <h3 class="sf-preview-title">${this.escapeHtml(this.content.title)}</h3>
            ${this.content.content ? `<div class="sf-preview-content">${this.escapeHtml(this.content.content.substring(0, 200))}${this.content.content.length > 200 ? '...' : ''}</div>` : ''}
            <div class="sf-preview-meta">
              <div class="sf-meta-item">
                ${this.createSVGIcon('link', 12)}
                <a href="${this.content.url}" target="_blank" title="${this.content.url}">${hostname}</a>
              </div>
              ${this.content.mainImage ? `
                <div class="sf-meta-badge">
                  ${this.createSVGIcon('image', 12)}
                  <span>含图片</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="sf-save-actions">
          <button class="sf-btn sf-btn-secondary sf-btn-large" id="sf-btn-open-table" ${tableUrl ? '' : 'disabled'} title="${tableUrl ? '打开多维表格' : '请先在设置页配置表格链接'}">
            ${this.createSVGIcon('link', 18)}
            <span>一键打开飞书表格</span>
          </button>
          <button class="sf-btn sf-btn-primary sf-btn-large" id="sf-btn-save">
            ${this.createSVGIcon('save', 18)}
            <span>保存到飞书</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 附加事件监听器
   */
  private attachEventListeners() {
    if (!this.panel) return;

    // 关闭按钮
    this.panel.querySelector('#sf-btn-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // 刷新按钮
    this.panel.querySelector('#sf-btn-refresh')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.content = extractPageContent();
      this.render();
    });

    // 设置按钮
    this.panel.querySelector('#sf-btn-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openOptions' });
    });

    // 打开设置（空状态）
    this.panel.querySelector('#sf-btn-open-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openOptions' });
    });

    // 返回按钮
    this.panel.querySelector('#sf-btn-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedTable = null;
      this.render();
    });

    // 保存按钮
    this.panel.querySelector('#sf-btn-save')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleSave();
    });

    this.panel.querySelector('#sf-btn-open-table')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.selectedTable) return;
      const tableUrl = this.getTableUrl(this.selectedTable);
      if (tableUrl) {
        window.open(tableUrl, '_blank');
      }
    });

    // 表格选择
    this.panel.querySelectorAll('[data-action="select"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0');
        this.selectedTable = this.tables[index];
        this.render();
      });
    });

    // 上移
    this.panel.querySelectorAll('[data-action="move-up"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0');
        this.handleMoveUp(index);
      });
    });

    // 下移
    this.panel.querySelectorAll('[data-action="move-down"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0');
        this.handleMoveDown(index);
      });
    });

    // 阻止浮窗内部的点击事件冒泡到 document
    this.panel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * 处理保存
   */
  private async handleSave() {
    if (!this.content || !this.selectedTable) return;

    const saveBtn = this.panel?.querySelector('#sf-btn-save');
    if (saveBtn) {
      saveBtn.setAttribute('disabled', 'true');
      // 使用 DOM API 而非 innerHTML
      saveBtn.textContent = '';
      const loaderIcon = this.createSVGIconElement('loader', 18);
      const span = document.createElement('span');
      span.textContent = '保存中...';
      saveBtn.appendChild(loaderIcon);
      saveBtn.appendChild(span);
    }

    try {
      // 提取并解析HTML内容（在 content-script 中解析，因为 Service Worker 没有 DOMParser）
      console.log('[ContentScript] 开始提取HTML...');
      const html = extractPageHtml();
      console.log('[ContentScript] HTML长度:', html.length);

      console.log('[ContentScript] 开始解析HTML为元素...');
      const htmlElements = parseHtmlToElements(html);
      console.log('[ContentScript] 解析完成，共', htmlElements.length, '个元素');

      const result = await saveToFeishu(this.selectedTable, this.content, htmlElements);
      this.showResult(result);
    } catch (err) {
      this.showResult({
        success: false,
        error: err instanceof Error ? err.message : '保存失败',
      });
    }
  }

  /**
   * 显示保存结果
   */
  private showResult(result: SaveResult) {
    const savePage = this.panel?.querySelector('.sf-save-page');
    if (!savePage) return;

    const existingAlert = savePage.querySelector('.sf-alert');
    existingAlert?.remove();

    let messageHtml = '';
    if (result.success) {
      messageHtml = `
        <span class="sf-alert-title">保存成功</span>
        ${result.tableUrl ? `<span class="sf-alert-message"><a href="${this.escapeHtml(result.tableUrl)}" target="_blank">查看表格记录</a></span>` : ''}
        ${result.documentUrl ? `<span class="sf-alert-message"><a href="${this.escapeHtml(result.documentUrl)}" target="_blank">查看飞书文档</a></span>` : ''}
      `;
    } else {
      messageHtml = `
        <span class="sf-alert-title">保存失败</span>
        ${result.error ? `<span class="sf-alert-message">${this.escapeHtml(result.error)}</span>` : ''}
      `;
    }

    const alertHtml = `
      <div class="sf-alert ${result.success ? 'sf-alert-success' : 'sf-alert-error'}">
        <div class="sf-alert-icon">
          ${result.success ? this.createSVGIcon('checkCircle', 18) : this.createSVGIcon('alertCircle', 18)}
        </div>
        <div class="sf-alert-content">
          ${messageHtml}
        </div>
      </div>
    `;

    const actions = savePage.querySelector('.sf-save-actions');
    if (actions) {
      actions.insertAdjacentHTML('beforebegin', alertHtml);
    }

    // 重置保存按钮
    const saveBtn = this.panel?.querySelector('#sf-btn-save');
    if (saveBtn) {
      saveBtn.removeAttribute('disabled');
      saveBtn.innerHTML = `${this.createSVGIcon('save', 18)}<span>保存到飞书</span>`;
    }
  }

  /**
   * 处理上移
   */
  private async handleMoveUp(index: number) {
    if (index === 0) return;
    [this.tables[index - 1], this.tables[index]] = [this.tables[index], this.tables[index - 1]];
    await saveTableConfigs(this.tables);
    this.render();
  }

  /**
   * 处理下移
   */
  private async handleMoveDown(index: number) {
    if (index === this.tables.length - 1) return;
    [this.tables[index], this.tables[index + 1]] = [this.tables[index + 1], this.tables[index]];
    await saveTableConfigs(this.tables);
    this.render();
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 创建浮窗实例
const floatingPanel = new FloatingPanel();

/**
 * 监听来自 background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'togglePanel') {
    floatingPanel.show();
    sendResponse({ success: true });
  } else if (message.action === 'extractContent') {
    const content = extractPageContent();
    sendResponse(content);
  }
  return true;
});

/**
 * 发送提取的内容到 background
 */
function sendExtractedContent() {
  const content = extractPageContent();
  chrome.runtime.sendMessage({
    action: 'contentExtracted',
    content,
  });
}

/**
 * 立即提取内容并存储
 */
if (document.readyState === 'complete') {
  sendExtractedContent();
} else {
  window.addEventListener('load', sendExtractedContent);
}

/**
 * 监听 DOM 变化，如果标题发生变化，重新提取内容
 * 使用单例模式避免重复创建 observer
 */
let titleObserver: MutationObserver | null = null;
let lastTitle = document.title;

/**
 * 清理标题监听器
 */
function cleanupTitleObserver() {
  if (titleObserver) {
    titleObserver.disconnect();
    titleObserver = null;
  }
}

/**
 * 初始化标题监听器
 */
function initTitleObserver() {
  if (titleObserver) return; // 避免重复创建
  
  const titleElement = document.querySelector('title');
  if (!titleElement) return;

  titleObserver = new MutationObserver(() => {
    if (document.title !== lastTitle) {
      lastTitle = document.title;
      sendExtractedContent();
    }
  });

  titleObserver.observe(titleElement, { childList: true });
}

// 初始化监听
initTitleObserver();

// 页面卸载时清理资源
window.addEventListener('beforeunload', cleanupTitleObserver);

// 页面隐藏时也清理（适用于 SPA 路由切换）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cleanupTitleObserver();
  } else {
    initTitleObserver();
  }
});
