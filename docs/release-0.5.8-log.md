# 0.5.8 版本同步日志

## 2026-06-25

### 初始化

- 已阅读 `AGENTS.md`、`docs/product-optimization-plan.md`、`docs/product-optimization-log.md` 和历史 0.5.7 发布计划/日志。
- 本次版本目标：`0.5.8`。
- 本次用户可见主能力：右键保存高质量摘录。

### 当前进度

- [x] 版本号同步
- [x] 更新提示同步
- [x] 帮助文档和首页介绍文案同步
- [x] 首页宣传图片资产生成
- [x] 当前版本测试数据同步
- [x] 本地构建验证

### 已完成改动

- `package.json`、`package-lock.json`、`public/manifest.json` 已更新为 `0.5.8`。
- `storageService` 的 `CONFIG_VERSION` 和 `validator` 的修复默认版本已更新为 `0.5.8`。
- 设置页底部版本文案已更新为 `Save to Feishu v0.5.8`。
- 更新提示 highlights 已改为右键保存摘录和摘录保存到飞书/Markdown。
- 侧栏默认更新卡已改为“0.5.8 高质量摘录”。
- Chrome Web Store 商品列表文案已加入右键摘录卖点、使用场景、配置步骤、截图建议和关键词。
- 当前版本相关测试数据已更新为 `0.5.8`；升级来源保留为 `0.5.7`。

### 首页宣传图片资产

- 已基于生图能力生成“选中即摘录，右键保存到飞书或 Markdown”的宣传视觉方向。
- 已在 `release/chrome-store-assets-0.5.8/` 落地可编辑 SVG 源文件：
  - `promo-marquee-1400x560.svg`
  - `promo-small-440x280.svg`
- 已从生图结果裁切并导出 Chrome Web Store 可用 PNG：
  - `promo-marquee-1400x560.png`，尺寸 `1400x560`
  - `promo-small-440x280.png`，尺寸 `440x280`
- 生成过程中 Quick Look 曾产生 `*.svg.png` 正方形缩略图，不作为最终商店资产使用。

### 验证结果

- `git diff --check`：针对本轮触达文件通过。
- `npm run build`：通过。
- `dist/manifest.json` 已验证为 `0.5.8`。
- 已用 `sips` 验证最终宣传 PNG 尺寸：
  - `promo-marquee-1400x560.png`：`1400x560`
  - `promo-small-440x280.png`：`440x280`
- 按浏览器插件规则未运行 `npm test`、`npm run preview`，也未启动 localhost 预览。
