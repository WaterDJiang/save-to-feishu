# Save to Feishu

<p align="center">
  <img src="public/icons/icon-128.png" alt="Save to Feishu Logo" width="80" height="80">
</p>

<p align="center">
  <strong>一键保存网页内容到飞书多维表格</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装">安装</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#开发">开发</a> •
  <a href="#隐私政策">隐私政策</a>
</p>

---

## 功能特性

- **一键保存**：点击插件图标，选择目标表格，即可将当前网页保存到飞书
- **智能提取**：自动提取网页标题、正文内容、主图和链接
- **多表格支持**：支持配置多个飞书表格，灵活选择保存位置
- **字段映射**：自定义网页内容与表格字段的对应关系
- **实时预览**：保存前可预览提取的内容，确保信息完整
- **Apple 风格 UI**：简洁优雅的界面设计，符合 macOS 视觉风格

## 安装

### 从 Chrome Web Store 安装（推荐）

1. 访问 Chrome Web Store 页面（即将上线）
2. 点击"添加至 Chrome"
3. 在弹出的对话框中点击"添加扩展程序"

### 手动安装（开发者模式）

1. 下载本项目的最新 Release 或克隆仓库
2. 运行 `npm install` 安装依赖
3. 运行 `npm run build` 构建项目
4. 打开 Chrome 浏览器，进入 `chrome://extensions/`
5. 开启右上角的"开发者模式"
6. 点击"加载已解压的扩展程序"
7. 选择项目中的 `dist` 文件夹

## 快速开始

### 1. 获取飞书应用凭证

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 登录后点击"创建企业自建应用"
3. 填写应用名称，选择应用类型
4. 在"凭证与基础信息"中获取 **App ID** 和 **App Secret**
5. 在"权限管理"中添加以下权限：
   - `bitable:app` - 访问多维表格
   - `bitable:record` - 操作记录

### 2. 创建多维表格

1. 在飞书中创建一个新的多维表格
2. 添加需要的字段，例如：
   - 标题（文本）
   - 链接（文本/链接）
   - 正文（多行文本）
   - 图片（附件）
   - 保存时间（日期）
3. 点击表格右上角的"分享"按钮
4. 开启"允许应用编辑"权限
5. 复制表格链接，提取 **Table ID**

### 3. 配置扩展

1. 点击扩展图标，选择"设置"
2. 填入 App ID 和 App Secret
3. 点击"添加表格"，输入表格名称和 Table ID
4. 配置字段映射
5. 保存配置

### 4. 开始使用

1. 打开想要保存的网页
2. 点击扩展图标
3. 选择目标表格
4. 预览内容后点击"保存到飞书"

## 开发

### 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite 6
- **样式**：CSS Modules + 自定义 CSS
- **图标**：Lucide React
- **API**：飞书开放平台 API

### 项目结构

```
save-to-feishu/
├── public/                  # 静态资源
│   ├── icons/              # 扩展图标
│   ├── content-script/     # 内容脚本样式
│   └── manifest.json       # 扩展清单
├── src/
│   ├── background/         # Service Worker
│   ├── content-script/     # 内容脚本（浮窗逻辑）
│   ├── options/            # 设置页面
│   ├── popup/              # 弹窗页面
│   ├── components/         # 共享组件
│   ├── services/           # API 服务
│   └── types/              # TypeScript 类型
├── docs/                   # 文档
├── dist/                   # 构建输出
└── README.md
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建
npm run preview
```

### 构建说明

本项目使用多个 Vite 配置文件分别构建不同部分：

- `vite.config.ts` - 主配置（popup 和 options）
- `vite.background.config.ts` - Service Worker 构建
- `vite.content.config.ts` - 内容脚本构建

## 隐私政策

我们高度重视用户隐私：

- ✅ 所有数据仅存储在您的浏览器本地
- ✅ 保存的内容直接传输到您的飞书表格，不经过第三方服务器
- ✅ 不收集任何个人身份信息
- ✅ 不追踪用户行为

详细隐私政策请查看 [PRIVACY.md](./PRIVACY.md)

## 常见问题

**Q: 保存失败，提示"Forbidden"？**  
A: 请检查应用是否已申请必要权限，以及表格是否已分享给应用。

**Q: 提示"FieldNameNotFound"？**  
A: 字段名称不匹配，请重新获取表格字段，确保配置的字段名称与飞书表格中的字段完全一致。

**Q: 提取的内容不完整？**  
A: 某些网页使用动态加载或特殊结构，尝试刷新页面后再次保存。

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](./LICENSE) 文件了解详情

## 致谢

- [飞书开放平台](https://open.feishu.cn/) 提供 API 支持
- [Lucide](https://lucide.dev/) 提供图标

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/WaterDJiang">WaterDJiang</a>
</p>
