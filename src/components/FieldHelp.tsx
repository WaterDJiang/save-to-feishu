import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HelpCircle, X, ExternalLink } from 'lucide-react';
import './FieldHelp.css';

/**
 * 字段帮助内容配置
 * 使用 as const 确保类型安全
 */
export const FIELD_HELP_CONTENT = {
  appId: {
    title: 'App ID',
    icon: '🔑',
    description: '飞书开放平台应用的唯一标识符',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 什么是 App ID？</h5>
          <p>App ID 是飞书开放平台为每个应用分配的唯一标识符，用于识别你的应用身份。插件通过 App ID 向飞书服务器请求访问权限。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🎯 获取步骤</h5>
          <ol className="field-help-steps">
            <li>
              <span className="field-help-step-num">1</span>
              <span>访问 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="field-help-link">飞书开放平台 <ExternalLink size={12} /></a></span>
            </li>
            <li>
              <span className="field-help-step-num">2</span>
              <span>点击「创建应用」→ 选择「企业自建应用」</span>
            </li>
            <li>
              <span className="field-help-step-num">3</span>
              <span>填写应用名称（如：网页收藏助手）</span>
            </li>
            <li>
              <span className="field-help-step-num">4</span>
              <span>进入应用详情页，点击左侧「凭证与基础信息」</span>
            </li>
            <li>
              <span className="field-help-step-num">5</span>
              <span>复制 <strong>App ID</strong>（格式：cli_xxxxxxxxxxxxxxxx）</span>
            </li>
          </ol>
        </div>

        <div className="field-help-example">
          <h5 className="field-help-example-title">📝 格式示例</h5>
          <div className="field-help-code-block">
            <code>cli_a0b1c2d3e4f5g6h7i8j9</code>
            <span className="field-help-code-hint">约 20 位字符，以 cli_ 开头</span>
          </div>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>App ID 是公开信息，可以安全地分享。每个应用只有一个固定的 App ID。
        </div>
      </>
    ),
  },
  appSecret: {
    title: 'App Secret',
    icon: '🔐',
    description: '应用的密钥，用于生成访问令牌',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 什么是 App Secret？</h5>
          <p>App Secret 是应用的密钥，相当于应用的"密码"。插件使用 App Secret 向飞书服务器证明身份，获取访问 API 的令牌。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🎯 获取步骤</h5>
          <ol className="field-help-steps">
            <li>
              <span className="field-help-step-num">1</span>
              <span>在应用详情页，点击左侧「凭证与基础信息」</span>
            </li>
            <li>
              <span className="field-help-step-num">2</span>
              <span>找到 <strong>App Secret</strong> 字段</span>
            </li>
            <li>
              <span className="field-help-step-num">3</span>
              <span>点击旁边的「查看」按钮</span>
            </li>
            <li>
              <span className="field-help-step-num">4</span>
              <span>可能需要管理员扫码验证身份</span>
            </li>
            <li>
              <span className="field-help-step-num">5</span>
              <span>复制显示的密钥（64 位字符）</span>
            </li>
          </ol>
        </div>

        <div className="field-help-example">
          <h5 className="field-help-example-title">📝 格式示例</h5>
          <div className="field-help-code-block">
            <code>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
            <span className="field-help-code-hint">64 位随机字符</span>
          </div>
        </div>

        <div className="field-help-alert field-help-warning">
          <strong>⚠️ 安全警告：</strong>App Secret 是敏感信息，请勿泄露给他人！插件会加密存储此密钥。
        </div>

        <div className="field-help-alert field-help-info">
          <strong>🔄 重置密钥：</strong>如果怀疑密钥泄露，可以在飞书开放平台重置 App Secret。
        </div>
      </>
    ),
  },
  tableUrl: {
    title: '多维表格链接',
    icon: '�',
    description: '飞书多维表格的分享链接',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 如何使用？</h5>
          <p>复制飞书多维表格的分享链接并粘贴到此处，系统会自动识别并提取<strong>表格链接 Token</strong> 和<strong>数据表 ID</strong>。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🎯 获取链接步骤</h5>
          <ol className="field-help-steps">
            <li>
              <span className="field-help-step-num">1</span>
              <span>在飞书桌面端或网页版打开目标多维表格</span>
            </li>
            <li>
              <span className="field-help-step-num">2</span>
              <span>点击右上角的「···」（更多）按钮</span>
            </li>
            <li>
              <span className="field-help-step-num">3</span>
              <span>选择「复制链接」</span>
            </li>
            <li>
              <span className="field-help-step-num">4</span>
              <span>将链接粘贴到此处</span>
            </li>
          </ol>
        </div>

        <div className="field-help-example">
          <h5 className="field-help-example-title">🔗 链接格式示例</h5>
          <div className="field-help-url-demo">
            <div className="field-help-url-line">
              <span className="field-help-url-part">https://xxx.feishu.cn/base/</span>
              <span className="field-help-url-highlight">Bascnxxxxxxxxxxxxxx</span>
              <span className="field-help-url-part">?table=</span>
              <span className="field-help-url-highlight">tblxxxxxxxxxxxxxx</span>
            </div>
          </div>
          <div className="field-help-url-legend">
            <div className="field-help-legend-item">
              <span className="field-help-legend-color field-help-legend-highlight"></span>
              <span>红色部分分别是 Token 和 数据表 ID</span>
            </div>
          </div>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>粘贴链接后，下方的「表格链接 Token」和「数据表 ID」会自动填充，无需手动填写。
        </div>
      </>
    ),
  },
  appToken: {
    title: '表格链接 Token',
    icon: '📊',
    description: '从链接中自动提取',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">🤖 自动提取</h5>
          <p>此字段会从上方粘贴的「多维表格链接」中自动提取，无需手动填写。</p>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>只需在「多维表格链接」输入框中粘贴完整的表格链接即可。
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🔧 手动修改</h5>
          <p>如果自动提取失败，可以手动修改。Token 是链接中 <code>base/</code> 后面的字符串：</p>
        </div>

        <div className="field-help-example">
          <h5 className="field-help-example-title">🔗 链接解析示例</h5>
          <div className="field-help-url-demo">
            <div className="field-help-url-line">
              <span className="field-help-url-part">https://xxx.feishu.cn/base/</span>
              <span className="field-help-url-highlight">Bascnxxxxxxxxxxxxxx</span>
              <span className="field-help-url-part">?table=tblxxxxx</span>
            </div>
          </div>
          <div className="field-help-url-legend">
            <div className="field-help-legend-item">
              <span className="field-help-legend-color field-help-legend-highlight"></span>
              <span>红色部分就是表格链接 Token</span>
            </div>
          </div>
        </div>
      </>
    ),
  },
  tableId: {
    title: '数据表 ID',
    icon: '📋',
    description: '从链接中自动提取',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">🤖 自动提取</h5>
          <p>此字段会从上方粘贴的「多维表格链接」中自动提取，无需手动填写。</p>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>只需在「多维表格链接」输入框中粘贴完整的表格链接即可。
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🔧 手动修改</h5>
          <p>如果自动提取失败，可以手动修改。数据表 ID 是链接中 <code>table=</code> 后面的字符串：</p>
        </div>

        <div className="field-help-example">
          <h5 className="field-help-example-title">🔗 链接解析示例</h5>
          <div className="field-help-url-demo">
            <div className="field-help-url-line">
              <span className="field-help-url-part">https://xxx.feishu.cn/base/Bascnxxxxx?table=</span>
              <span className="field-help-url-highlight">tblxxxxxxxxxxxxxx</span>
              <span className="field-help-url-part">&view=vewxxxxx</span>
            </div>
          </div>
          <div className="field-help-url-legend">
            <div className="field-help-legend-item">
              <span className="field-help-legend-color field-help-legend-highlight"></span>
              <span>红色部分就是数据表 ID</span>
            </div>
          </div>
        </div>

        <div className="field-help-alert field-help-info">
          <strong>🔄 切换数据表：</strong>在多维表格中切换不同的子表，链接中的 table 参数会相应变化。
        </div>
      </>
    ),
  },
  fieldMapping: {
    title: '字段对应关系',
    icon: '🔄',
    description: '配置网页内容保存到表格的对应列',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 什么是字段对应关系？</h5>
          <p>字段对应关系告诉插件：网页上的哪些内容应该保存到表格的哪一列。通过配置映射关系，你可以自定义数据的存储方式。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">📊 可映射的网页内容</h5>
          <div className="field-help-mapping-grid">
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">📰</span>
              <div className="field-help-mapping-info">
                <strong>文章标题</strong>
                <span>网页的 &lt;title&gt; 标签内容</span>
              </div>
            </div>
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">📝</span>
              <div className="field-help-mapping-info">
                <strong>正文内容</strong>
                <span>自动提取的网页正文（最多 3000 字）</span>
              </div>
            </div>
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">🔗</span>
              <div className="field-help-mapping-info">
                <strong>页面网址</strong>
                <span>当前页面的完整 URL</span>
              </div>
            </div>
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">🖼️</span>
              <div className="field-help-mapping-info">
                <strong>封面图片</strong>
                <span>网页的主图或首图 URL</span>
              </div>
            </div>
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">📅</span>
              <div className="field-help-mapping-info">
                <strong>保存时间</strong>
                <span>点击保存时的日期时间</span>
              </div>
            </div>
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">🏷️</span>
              <div className="field-help-mapping-info">
                <strong>固定值</strong>
                <span>你自定义的固定文本内容</span>
              </div>
            </div>
          </div>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🎯 配置示例</h5>
          <div className="field-help-example-table">
            <div className="field-help-example-row field-help-example-header">
              <span>网页内容</span>
              <span>→</span>
              <span>表格字段</span>
              <span>建议类型</span>
            </div>
            <div className="field-help-example-row">
              <span>文章标题</span>
              <span>→</span>
              <span>标题</span>
              <span className="field-help-badge">文本</span>
            </div>
            <div className="field-help-example-row">
              <span>页面网址</span>
              <span>→</span>
              <span>链接</span>
              <span className="field-help-badge field-help-badge-link">超链接</span>
            </div>
            <div className="field-help-example-row">
              <span>正文内容</span>
              <span>→</span>
              <span>内容</span>
              <span className="field-help-badge">文本</span>
            </div>
            <div className="field-help-example-row">
              <span>封面图片</span>
              <span>→</span>
              <span>图片</span>
              <span className="field-help-badge">文本</span>
            </div>
            <div className="field-help-example-row">
              <span>保存时间</span>
              <span>→</span>
              <span>时间</span>
              <span className="field-help-badge field-help-badge-date">日期</span>
            </div>
          </div>
        </div>

        <div className="field-help-alert field-help-warning">
          <strong>⚠️ 重要：</strong>图片请使用「文本」类型字段保存图片 URL，而不是「附件」类型。
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>使用「固定值」可以自动添加标签，如"待阅读"、"技术文章"等。
        </div>
      </>
    ),
  },
} as const;

/**
 * 字段帮助键名类型
 */
type FieldHelpKey = keyof typeof FIELD_HELP_CONTENT;

interface FieldHelpProps {
  fieldKey: FieldHelpKey;
}

/**
 * 字段级帮助组件
 * 显示在表单字段旁边的帮助角标
 * 
 * @param fieldKey - 帮助内容的键名
 */
export const FieldHelp: React.FC<FieldHelpProps> = ({ fieldKey }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  
  const helpContent = FIELD_HELP_CONTENT[fieldKey];

  /**
   * 打开帮助弹窗
   */
  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * 关闭帮助弹窗
   */
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * 处理键盘事件
   * ESC 键关闭弹窗
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  /**
   * 处理点击外部关闭
   */
  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // 只有直接点击遮罩层时才关闭
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  /**
   * 添加/移除键盘事件监听
   */
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 禁止背景滚动
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  /**
   * 弹窗打开时聚焦到弹窗
   */
  useEffect(() => {
    if (isOpen && popupRef.current) {
      popupRef.current.focus();
    }
  }, [isOpen]);

  if (!helpContent) {
    console.warn(`[FieldHelp] 未找到字段 "${fieldKey}" 的帮助内容`);
    return null;
  }

  return (
    <>
      {/* 帮助触发按钮 */}
      <button
        ref={triggerRef}
        type="button"
        className="field-help-trigger"
        onClick={handleOpen}
        title={`查看${helpContent.title}说明`}
        aria-label={`查看${helpContent.title}帮助`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <HelpCircle size={14} aria-hidden="true" />
      </button>

      {/* 帮助弹窗 */}
      {isOpen && (
        <div 
          className="field-help-overlay" 
          onClick={handleOverlayClick}
          role="presentation"
        >
          <div 
            ref={popupRef}
            className="field-help-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-help-title"
            tabIndex={-1}
          >
            {/* 弹窗头部 */}
            <div className="field-help-header">
              <div className="field-help-title-wrapper">
                <span className="field-help-icon">{helpContent.icon}</span>
                <div className="field-help-title-group">
                  <h4 id="field-help-title">{helpContent.title}</h4>
                  <span className="field-help-subtitle">{helpContent.description}</span>
                </div>
              </div>
              <button
                type="button"
                className="field-help-close"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleClose();
                }}
                title="关闭"
                aria-label="关闭帮助"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            
            {/* 弹窗内容 */}
            <div className="field-help-body">
              {helpContent.content}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FieldHelp;
