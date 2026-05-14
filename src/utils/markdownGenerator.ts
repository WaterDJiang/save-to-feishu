import type { ExtractedPageContent, HtmlElementInfo, KnowledgeMetadata } from '@/types';

export interface MarkdownOptions {
  metadata?: KnowledgeMetadata;
  documentUrl?: string;
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderYamlValue(value: string | undefined): string {
  if (!value) return '""';
  return `"${escapeYaml(value)}"`;
}

/**
 * 将页面内容生成为结构化 Markdown
 * - 保留标题层级（h1~h3 对应 ## ~ ####）
 * - 列表项连续归组，有序列表自动编号
 * - 列表组前后加空行，与其他内容分隔
 */
export function generateMarkdown(
  content: ExtractedPageContent,
  htmlElements?: HtmlElementInfo[],
  options: MarkdownOptions = {}
): string {
  const lines: string[] = [];
  const metadata = options.metadata;

  lines.push('---');
  lines.push(`title: ${renderYamlValue(content.title)}`);
  lines.push(`url: ${renderYamlValue(content.url)}`);
  lines.push(`source: ${renderYamlValue(metadata?.source || getHostname(content.url))}`);
  lines.push(`saved_at: ${renderYamlValue(content.savedAt)}`);
  if (content.publishedAt) {
    lines.push(`published_at: ${renderYamlValue(content.publishedAt)}`);
  }
  if (options.documentUrl) {
    lines.push(`feishu_doc_url: ${renderYamlValue(options.documentUrl)}`);
  }
  lines.push(`status: ${renderYamlValue(metadata?.status || '未处理')}`);
  if (metadata?.contentType) {
    lines.push(`content_type: ${renderYamlValue(metadata.contentType)}`);
  }
  if (metadata?.reviewAt) {
    lines.push(`review_at: ${renderYamlValue(metadata.reviewAt)}`);
  }
  const tags = metadata?.tags?.filter((tag) => tag.trim()) || [];
  if (tags.length > 0) {
    lines.push('tags:');
    tags.forEach((tag) => {
      lines.push(`  - ${renderYamlValue(tag.trim())}`);
    });
  } else {
    lines.push('tags: []');
  }
  if (metadata?.excerpt) {
    lines.push(`excerpt: ${renderYamlValue(metadata.excerpt)}`);
  }
  lines.push('---');
  lines.push('');

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
  if (content.selectedText) {
    metaLines.push('- **剪藏范围**: 选中文本');
  }
  if (content.publishedAt) {
    metaLines.push(`- **发布时间**: ${content.publishedAt}`);
  }
  if (metadata?.source) {
    metaLines.push(`- **来源**: ${metadata.source}`);
  }
  if (metadata?.status) {
    metaLines.push(`- **状态**: ${metadata.status}`);
  }
  if (metadata?.contentType) {
    metaLines.push(`- **资料类型**: ${metadata.contentType}`);
  }
  if (metadata?.tags?.length) {
    metaLines.push(`- **标签**: ${metadata.tags.join(', ')}`);
  }
  if (options.documentUrl) {
    metaLines.push(`- **飞书文档**: ${options.documentUrl}`);
  }
  metaLines.push(`- **保存时间**: ${content.savedAt}`);

  if (metaLines.length > 0) {
    lines.push(...metaLines);
    lines.push('');
  }

  // 分隔线
  lines.push('---');
  lines.push('');

  if (metadata?.note) {
    lines.push('## 个人备注');
    lines.push('');
    lines.push(metadata.note);
    lines.push('');
  }

  if (metadata?.excerpt) {
    lines.push('## 摘录');
    lines.push('');
    lines.push(`> ${metadata.excerpt.replace(/\n+/g, '\n> ')}`);
    lines.push('');
  }

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
        case 'quote': {
          if (inList) {
            lines.push('');
            inList = false;
          }
          const quote = el.content?.trim();
          if (quote) {
            lines.push(`> ${quote.replace(/\n+/g, '\n> ')}`);
            lines.push('');
          }
          orderedIndex = 0;
          break;
        }
        case 'image': {
          if (inList) {
            lines.push('');
            inList = false;
          }
          if (el.imageUrl) {
            lines.push(`![${content.title}](${el.imageUrl})`);
            lines.push('');
          }
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

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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
