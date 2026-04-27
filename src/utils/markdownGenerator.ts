import type { ExtractedPageContent, HtmlElementInfo } from '@/types';

/**
 * 将页面内容生成为结构化 Markdown
 * - 保留标题层级（h1~h3 对应 ## ~ ####）
 * - 列表项连续归组，有序列表自动编号
 * - 列表组前后加空行，与其他内容分隔
 * - 跳过图片
 */
export function generateMarkdown(content: ExtractedPageContent, htmlElements?: HtmlElementInfo[]): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${content.title}`);
  lines.push('');

  // 元信息
  const metaLines: string[] = [];
  if (content.url) {
    metaLines.push(`- **链接**: ${content.url}`);
  }
  if (content.description) {
    metaLines.push(`- **摘要**: ${content.description}`);
  }
  if (content.publishedAt) {
    metaLines.push(`- **发布时间**: ${content.publishedAt}`);
  }
  metaLines.push(`- **保存时间**: ${content.savedAt}`);

  if (metaLines.length > 0) {
    lines.push(...metaLines);
    lines.push('');
  }

  // 分隔线
  lines.push('---');
  lines.push('');

  // 正文内容
  if (htmlElements && htmlElements.length > 0) {
    let inList = false;        // 当前是否在列表组中
    let orderedIndex = 0;      // 有序列表计数器

    for (let i = 0; i < htmlElements.length; i++) {
      const el = htmlElements[i];

      switch (el.type) {
        case 'heading': {
          // 标题前关闭列表组
          if (inList) {
            lines.push('');
            inList = false;
          }
          // h1 -> ##, h2 -> ###, h3 -> ####
          const prefix = '#'.repeat((el.level || 1) + 1);
          lines.push(`${prefix} ${el.content}`);
          lines.push('');
          orderedIndex = 0;
          break;
        }
        case 'text': {
          // 文本前关闭列表组
          if (inList) {
            lines.push('');
            inList = false;
          }
          lines.push(el.content || '');
          lines.push('');
          orderedIndex = 0;
          break;
        }
        case 'list': {
          // 检测列表组是否断开（有序↔无序切换视为断开）
          const nextEl = htmlElements[i + 1];
          const isListContinuation = nextEl?.type === 'list' && nextEl.listType === el.listType;

          if (!inList) {
            // 列表组开始前加空行
            lines.push('');
            inList = true;
            orderedIndex = 0;
          }

          if (el.listType === 'ordered') {
            orderedIndex++;
            lines.push(`${orderedIndex}. ${el.content}`);
          } else {
            lines.push(`- ${el.content}`);
          }

          // 列表组结束时加空行
          if (!isListContinuation) {
            lines.push('');
            inList = false;
          }
          break;
        }
        case 'link': {
          // 链接前关闭列表组
          if (inList) {
            lines.push('');
            inList = false;
          }
          if (el.linkUrl && el.content) {
            lines.push(`[${el.content}](${el.linkUrl})`);
          } else {
            lines.push(el.content || '');
          }
          lines.push('');
          orderedIndex = 0;
          break;
        }
      }
    }
  } else if (content.content) {
    // 没有 htmlElements 时，使用纯文本内容
    lines.push(content.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 生成 Markdown 文件名（基于标题，清理非法字符）
 */
export function generateMarkdownFilename(title: string): string {
  const sanitized = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80);
  return `${sanitized || 'page-content'}.md`;
}

/**
 * 触发 Markdown 文件下载
 */
export function downloadMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
