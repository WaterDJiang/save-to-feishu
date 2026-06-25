import type { ExtractedPageContent, HtmlElementInfo } from '@/types';

export interface ExtractedPageSnapshot {
  content: ExtractedPageContent;
  htmlElements: HtmlElementInfo[];
}

/**
 * 在页面上下文中提取剪藏数据。
 *
 * 保持函数自包含，才能安全作为 chrome.scripting.executeScript 的 func 注入；
 * 也可由内容脚本直接调用，避免三个保存入口维护不同的解析规则。
 */
export function extractCurrentPageSnapshot(): ExtractedPageSnapshot {
  const selectors = [
    '#js_content',
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.markdown-body',
    'main',
    '.content',
    '#content',
  ];
  const ignoredSelector = 'script, style, noscript, svg, header, footer, nav, aside, .sf-ignore, .sidebar, .menu, .navigation';

  const findRoot = (): HTMLElement => {
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element && element.textContent?.trim().length) return element;
    }
    return document.body;
  };

  const resolveUrl = (value: string | null | undefined): string => {
    if (!value) return '';
    const normalized = value.replace(/&amp;/g, '&').trim();
    if (!normalized || normalized.startsWith('data:')) return '';
    try {
      return new URL(normalized, document.baseURI).href;
    } catch {
      return normalized.startsWith('//') ? `https:${normalized}` : normalized;
    }
  };

  const getAttributeUrl = (element: Element | null): string => {
    if (!element) return '';
    return resolveUrl(
      element.getAttribute('data-src') ||
      element.getAttribute('data-original') ||
      element.getAttribute('data-actualsrc') ||
      element.getAttribute('data-lazy-src') ||
      element.getAttribute('src') ||
      element.getAttribute('href')
    );
  };

  const cleanText = (element: HTMLElement): string => {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(ignoredSelector).forEach(node => node.remove());
    clone.querySelectorAll('[style*="display:none" i], [style*="visibility:hidden" i]').forEach(node => node.remove());
    clone.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
    return (clone.innerText || clone.textContent || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const root = findRoot();
  const rootHtml = root.innerHTML?.trim() || '';
  const documentCopy = new DOMParser().parseFromString(rootHtml, 'text/html');
  const elements: HtmlElementInfo[] = [];
  const processed = new Set<Element>();

  const pushText = (type: 'text' | 'heading' | 'quote', element: Element, level?: 1 | 2 | 3) => {
    const text = cleanText(element as HTMLElement);
    if (!text) return;
    processed.add(element);
    element.querySelectorAll('*').forEach(child => processed.add(child));
    elements.push({ type, content: text, ...(level ? { level } : {}) });
  };

  const walk = (element: Element): void => {
    if (processed.has(element)) return;
    const tag = element.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'svg'].includes(tag)) return;

    if (['h1', 'h2', 'h3'].includes(tag)) {
      pushText('heading', element, tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3);
      return;
    }
    if (tag === 'img') {
      processed.add(element);
      const imageUrl = getAttributeUrl(element);
      if (imageUrl && !/(?:icon|avatar|logo)/i.test(imageUrl)) elements.push({ type: 'image', imageUrl });
      return;
    }
    if (tag === 'video' || tag === 'audio' || tag === 'iframe' || ['mp-video', 'mpvoice', 'mp-common-mpaudio', 'qqmusic', 'mp-miniprogram'].includes(tag)) {
      processed.add(element);
      const mediaUrl = getAttributeUrl(element) || resolveUrl(element.querySelector('source')?.getAttribute('src'));
      const mediaType = tag === 'audio' || tag.includes('audio') || tag === 'mpvoice' || tag === 'qqmusic'
        ? 'audio'
        : tag === 'mp-miniprogram'
          ? 'mini-program'
          : tag === 'iframe'
            ? 'embed'
            : 'video';
      const label = cleanText(element as HTMLElement) || element.getAttribute('alt') || element.getAttribute('title') || '';
      if (mediaUrl || label) elements.push({ type: 'media', content: label || undefined, linkUrl: mediaUrl || undefined, mediaType });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      processed.add(element);
      const listType = tag === 'ul' ? 'bullet' : 'ordered';
      element.querySelectorAll(':scope > li').forEach(item => {
        processed.add(item);
        const text = cleanText(item as HTMLElement);
        if (text) elements.push({ type: 'list', content: text, listType });
      });
      return;
    }
    if (tag === 'blockquote') {
      pushText('quote', element);
      return;
    }
    if (tag === 'a') {
      const href = resolveUrl(element.getAttribute('href'));
      const text = cleanText(element as HTMLElement);
      const parentTag = element.parentElement?.tagName.toLowerCase();
      if (href && text && parentTag && !['p', 'div', 'section', 'article', 'li'].includes(parentTag)) {
        processed.add(element);
        elements.push({ type: 'link', content: text, linkUrl: href });
        return;
      }
    }
    if (['p', 'div', 'section', 'article', 'main', 'pre', 'figure', 'figcaption'].includes(tag)) {
      const hasBlockChild = Array.from(element.children).some(child =>
        /^(h1|h2|h3|blockquote|ul|ol|img|video|audio|iframe|p|div|section|article|main|pre|figure|figcaption|mp-video|mpvoice|mp-common-mpaudio|qqmusic|mp-miniprogram)$/i.test(child.tagName)
      );
      if (!hasBlockChild) {
        pushText('text', element);
        return;
      }
    }
    Array.from(element.children).forEach(walk);
  };

  const parsedBody = documentCopy.body;
  Array.from(parsedBody.children).forEach(walk);

  const metaContent = (name: string, property?: string): string => {
    const byName = document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
    if (byName) return byName;
    return document.querySelector(`meta[property="${property || (name.startsWith('og:') ? name : `og:${name}`)}"]`)?.getAttribute('content') || '';
  };
  const selectedText = window.getSelection()?.toString().trim() || '';
  const mainImage = metaContent('og:image') || getAttributeUrl(root.querySelector('img'));
  const publishedAt = document.querySelector('meta[property="article:published_time"], meta[name="publish-date"], meta[name="published_time"], meta[itemprop="datePublished"], time[datetime], #publish_time')?.getAttribute('content') ||
    document.querySelector('time[datetime]')?.getAttribute('datetime') ||
    document.querySelector('#publish_time, .publish-date, .post-date')?.textContent?.trim() || '';

  return {
    content: {
      title: (metaContent('title') || document.title || '').replace(/^\(\d+\)\s*/, '').trim(),
      url: resolveUrl(document.querySelector('link[rel="canonical"]')?.getAttribute('href')) || window.location.href,
      description: metaContent('description', 'og:description'),
      content: selectedText || cleanText(root),
      selectedText: selectedText || undefined,
      mainImage: mainImage || undefined,
      publishedAt: publishedAt || undefined,
      savedAt: new Date().toISOString(),
    },
    htmlElements: elements,
  };
}
