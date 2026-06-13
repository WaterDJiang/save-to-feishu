const FEEDBACK_ISSUE_URL = 'https://github.com/WaterDJiang/save-to-feishu/issues/new';

export function getChromeVersion(userAgent: string): string {
  return userAgent.match(/(?:Chrome|CriOS)\/([\d.]+)/)?.[1] || '未知';
}

export function buildFeedbackIssueUrl({
  extensionVersion,
  userAgent,
}: {
  extensionVersion: string;
  userAgent: string;
}): string {
  const params = new URLSearchParams({
    title: '[问题反馈] ',
    body: [
      '## 问题类型',
      '',
      '- [ ] 网页内容提取不完整',
      '- [ ] 保存到飞书失败',
      '- [ ] Markdown 下载异常',
      '- [ ] 配置或字段映射问题',
      '- [ ] 其他建议',
      '',
      '## 发生了什么',
      '',
      '请描述你看到的问题。',
      '',
      '## 如何复现',
      '',
      '1. ',
      '2. ',
      '3. ',
      '',
      '## 环境信息',
      '',
      `- 插件版本：${extensionVersion}`,
      `- Chrome 版本：${getChromeVersion(userAgent)}`,
      '',
      '> 为保护隐私，插件不会自动附带当前网页地址、网页内容、飞书配置或密钥。请只补充你愿意公开的信息。',
    ].join('\n'),
  });

  return `${FEEDBACK_ISSUE_URL}?${params.toString()}`;
}
