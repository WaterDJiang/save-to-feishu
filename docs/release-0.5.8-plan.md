# 0.5.8 版本同步计划

更新时间：2026-06-25

## 目标

将当前开发版本统一升级为 `0.5.8`，并把“右键保存高质量摘录”同步到更新提示、帮助文档、Chrome Web Store 首页文案和宣传图片资产。

## 范围

1. 更新 `package.json`、`package-lock.json`、`public/manifest.json`。
2. 更新本地配置默认版本、配置修复默认版本、设置页可见版本文案。
3. 更新侧栏更新卡和升级提示 highlights，突出右键摘录能力。
4. 更新帮助文档、README 和 Chrome Web Store 商品列表文案。
5. 生成 0.5.8 Chrome Web Store 宣传图片资产，包含摘录功能文案。
6. 更新当前版本相关测试数据。
7. 执行本地构建，确认 `dist/manifest.json` 为 `0.5.8`。

## 验收标准

- 活跃源码中的当前版本号统一为 `0.5.8`。
- 旧版本号只保留在历史发布文档或作为 `previousVersion: '0.5.7'` 的升级来源。
- 更新提示和帮助文档明确说明：选中网页文字后右键保存为摘录。
- Chrome Web Store 首页介绍和宣传图资产包含右键摘录卖点。
- `npm run build` 成功，且 `dist/manifest.json` 为 `0.5.8`。
- 不生成 Chrome Web Store 审核 ZIP，除非用户另行要求。
