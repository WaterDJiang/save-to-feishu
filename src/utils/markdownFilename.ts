function formatDatePrefix(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 生成带下载日期前缀的 Markdown 文件名。
 */
export function generateMarkdownFilename(title: string, downloadDate: Date = new Date()): string {
  const sanitized = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80);
  return `${formatDatePrefix(downloadDate)}_${sanitized || 'page-content'}.md`;
}
