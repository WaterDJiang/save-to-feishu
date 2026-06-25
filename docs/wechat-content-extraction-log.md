# 公众号长文内容提取修复日志

## 2026-06-24

### 初始化与取证

- 已阅读 `AGENTS.md`、组件化重构计划和实施日志。
- 已保留工作区中既有未提交的首用 Markdown、回顾工作流与版本发布改动。
- 目标公众号文章：`https://mp.weixin.qq.com/s/y1EprlREsZuNI224FyFZKw`。
- 浏览器对该域名的直接读取受安全策略限制，未尝试绕过；因此不能将目标文章的实时 DOM 作为当前验证证据。

### 已确认问题

- `src/content-script/index.ts` 和 `src/popup/App.tsx` 的正文清理逻辑截断为 3,000 字。
- `src/sidepanel/SidePanelApp.tsx` 的正文清理逻辑截断为 5,000 字。
- 内容脚本、弹窗、侧栏分别维护 HTML 解析实现，导致懒加载图片属性、块级节点和嵌入媒体处理存在差异。

### 当前进度

- [x] 现状检查与问题定位
- [x] 修复计划与验收标准
- [x] 统一页面提取模块
- [x] 三个入口替换为统一模块
- [x] Markdown/飞书元素渲染补齐嵌入引用
- [x] 静态检查与真实浏览器验证说明

### 实际改动

- 新增 `src/utils/pageExtraction.ts`：提供可直接注入 `chrome.scripting.executeScript` 的自包含页面提取函数，同时由内容脚本直接复用。
- 统一正文容器选择、纯文本清理、标题/链接/发布时间/主图元数据、懒加载图片 URL 与结构化块解析。
- 正文不再使用 3,000 或 5,000 字上限；选中文字也不再额外截断。
- `src/content-script/index.ts`、`src/popup/App.tsx`、`src/sidepanel/SidePanelApp.tsx` 均优先使用同一提取结果；旧入口逻辑仅作为共享提取返回异常时的兼容降级。
- 新增 `media` 元素类型，识别 `video`、`audio`、`iframe`、`mp-video`、`mpvoice`、`mp-common-mpaudio`、`qqmusic` 和 `mp-miniprogram`；不下载媒体文件，只在 Markdown 与飞书文档中保留可访问链接或类型占位。

### 关键决策

- 不把嵌入媒体二进制下载到本地或上传飞书，避免扩大用户数据处理范围；链接保留足以防止剪藏时静默丢失上下文。
- 结构化元素仍沿用原有 Markdown 生成和飞书文档创建流水线，未新增保存通道或远程服务。

### 验证结果

- `git diff --check`：通过。
- 已静态检查三个入口均导入并调用 `extractCurrentPageSnapshot`，且模块不依赖注入页面外的闭包。
- 已静态检查 `HtmlElementInfo` 的 `media` 分支在 Markdown 与飞书文档渲染中均有处理。
- 按 `AGENTS.md` 未运行 npm 构建、测试或预览命令。
- 浏览器安全策略禁止本轮直接读取目标公众号 URL，无法在当前环境对该文章的实时 DOM 做最终断言；需要重新加载扩展后在真实文章页面验证。

### 用户验证步骤

1. 打开 `chrome://extensions/`。
2. 找到 Save to Feishu，点击“重新加载”。
3. 打开目标公众号文章并等待正文、图片和嵌入内容加载完成。
4. 分别通过侧栏、扩展弹窗和网页悬浮窗剪藏，确认内容预览不再在约 3,000 或 5,000 字处结束。
5. 导出 Markdown，检查文章尾部、懒加载图片和嵌入视频/音频/小程序链接均被保留。
6. 如保存到飞书，检查生成文档中的尾部正文、图片和媒体链接。

### 复测失败后的运行时取证

- 用户提供的实际导出证明主体段落没有进入 Markdown，仅保留少数标题、图片和尾部推广内容；问题不是正文截断提示本身。
- 已读取 `dist/sidepanel/index.js`，确认其仍含旧逻辑：`slice(0,5e3)`、旧的 `#js_content` 文本提取和旧 HTML 树遍历；并未包含 `extractCurrentPageSnapshot`。
- 已确认 `public/manifest.json` 与 `dist/manifest.json` 均指向 `dist/sidepanel/index.html`、`dist/background/index.js` 等构建产物。Chrome 的“重新加载”只会重新读取 `dist/`，不会把 `src/` 自动编译进去。
- 因此本轮用户实际验证的仍是旧产物。根据 `AGENTS.md`，不得在用户未明确授权时运行 npm 构建；当前需要取得构建授权后才能把已完成的源码修复交付到可加载的扩展目录。

### 已授权构建与产物验证

- 用户已明确授权继续，已执行 `npm run build`。
- 构建通过：TypeScript 检查、主 Vite 产物、background 产物、content-script 产物均成功生成。
- 已确认 manifest 指向的文件均存在且为本次构建时间：`dist/sidepanel/index.html`、`dist/options/index.html`、`dist/background/index.js`、`dist/content-script/index.js`。
- 已确认 `dist/sidepanel/index.html` 加载 `/sidepanel/index.js`；该文件及 `dist/content-script/index.js` 已包含新提取器的 `data-actualsrc`、`mp-common-mpaudio`、`mp-miniprogram` 标记。
- `git diff --check`：通过。
- 目标公众号域名仍受浏览器安全策略限制，无法在本环境自动完成“打开文章→点击保存→检查导出文件”的最终交互验证；现可由用户在真实 Chrome 扩展环境中验证。
