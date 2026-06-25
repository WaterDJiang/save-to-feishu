# 0.5.7 版本同步日志

## 2026-06-20

### 初始化

- 已阅读 `AGENTS.md`、0.5.6 发布计划和发布日志。
- 已盘点当前版本落点：包元数据、锁文件、扩展清单、本地配置兼容、设置页、侧栏更新卡和测试数据。
- 初始版本同步未授权构建；用户随后明确要求构建一次 `dist`，因此本日志补充生产构建与产物校验。

### 当前进度

- [x] 发布范围与历史边界确认
- [x] 源码版本同步
- [x] 用户可见更新说明同步
- [x] 测试数据与静态检查
- [x] 生产构建与 dist 校验
- [x] Chrome Web Store 审核包生成与检查

### 源码版本同步

- `package.json`、`package-lock.json` 根版本和根包版本、`public/manifest.json` 已统一为 `0.5.7`。
- `storageService` 的 `CONFIG_VERSION` 与配置修复默认版本已同步为 `0.5.7`；旧配置加载时仍按当前版本归一。
- 设置页底部版本文案已同步为 `Save to Feishu v0.5.7`。

### 用户可见更新说明

- 侧栏当前版本更新卡更新为“0.5.7 首次保存优化”。
- 更新提醒的两项内容改为首次保存同时提供飞书与 Markdown 入口，以及无飞书配置时可直接下载 Markdown。
- 更新提醒项的辅助文案同步移除旧的回顾流程描述，避免版本内容不一致。

### 测试数据与检查

- 当前版本相关的反馈链接和更新提醒测试数据已更新为 `0.5.7`；升级来源保留为 `0.5.6`。
- 已用 Node 解析验证 `package.json`、`package-lock.json` 根包与扩展清单均为 `0.5.7`。
- `git diff --check`：通过。
- 版本同步阶段未运行 npm 命令；随后按用户明确请求执行了 `npm run build`。

### 发布边界

- 本次没有修改权限、host permissions 或网络行为。
- 历史 `0.5.6` 发布计划和日志保持原样；未生成 0.5.7 审核压缩包。

### 生产构建与 dist 校验

- 已执行 `npm run build`，包括 TypeScript 检查、主界面 Vite 构建、后台脚本构建和内容脚本构建，退出码为 0。
- 已确认构建产物包含侧栏、设置页、后台 Service Worker、内容脚本、内容脚本样式、图标和扩展清单。
- 已解析验证 `dist/manifest.json`，版本为 `0.5.7`。
- 构建后再次执行 `git diff --check`，通过。

### Chrome Web Store 审核包

- 用户明确要求生成可上传 Google 审核的包。
- 基于包含公众号内容提取修复的最新 `dist/`，从 `dist` 根目录执行 `zip -r -FS` 生成：`release/save-to-feishu-0.5.7-google-review-20260624.zip`。
- 已执行 `unzip -t`，21 个条目均通过压缩完整性检查。
- 已执行 `unzip -l` 与 `unzip -p ... manifest.json`：`manifest.json` 位于 ZIP 根目录，版本为 `0.5.7`；包内包含 background、options、content-script、sidepanel、icons、assets 和 manifest，不包含源码、测试、文档或本地配置。
