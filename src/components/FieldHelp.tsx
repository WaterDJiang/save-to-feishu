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
    description: '飞书给插件的第 1 串钥匙',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 这一项的作用</h5>
          <p>App ID 是飞书给这个插件的第 1 串钥匙。填好后，飞书才知道是谁在请求保存资料。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🎯 如何获取</h5>
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
              <span>复制 <strong>App ID</strong>（通常以 cli_ 开头）</span>
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
          <strong>💡 提示：</strong>App ID 通常不是最敏感的那串，但也建议只填在自己的插件里。
        </div>
      </>
    ),
  },
  appSecret: {
    title: 'App Secret',
    icon: '🔐',
    description: '飞书给插件的第 2 串钥匙',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 这一项的作用</h5>
          <p>App Secret 是飞书给插件的第 2 串钥匙，作用类似密码。插件靠它证明自己有资格把资料保存到你的飞书表格。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🎯 如何获取</h5>
          <ol className="field-help-steps">
            <li>
              <span className="field-help-step-num">1</span>
              <span>在应用详情页，点击左侧「凭证与基础信息」</span>
            </li>
            <li>
              <span className="field-help-step-num">2</span>
              <span>找到 <strong>App Secret</strong> 这一项</span>
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
          <strong>⚠️ 安全提醒：</strong>App Secret 像密码一样，请不要发给别人。插件会加密保存在本地。
        </div>

        <div className="field-help-alert field-help-info">
          <strong>🔄 如果不小心泄露：</strong>可以回到飞书开放平台重新生成 App Secret。
        </div>
      </>
    ),
  },
  tableUrl: {
    title: '飞书表格链接',
    icon: '🔗',
    description: '直接粘贴要保存到的飞书表格网址',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 如何使用？</h5>
          <p>把飞书表格的网址粘贴到这里就行。插件会自动识别这是哪张表、哪张子表。</p>
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
              <span>红色部分是插件自动识别的表格信息</span>
            </div>
          </div>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>你只需要粘贴完整链接，下方两个编号会自动填好。
        </div>
      </>
    ),
  },
  appToken: {
    title: '自动识别的表格编号',
    icon: '📊',
    description: '从飞书表格链接里自动识别',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">🤖 自动提取</h5>
          <p>这个编号会从上方粘贴的飞书表格链接里自动识别，一般不用手动改。</p>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>只需在「飞书表格链接」输入框中粘贴完整链接即可。
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🔧 什么时候需要手动改？</h5>
          <p>只有在自动识别失败时才需要手动改。它通常是链接中 <code>base/</code> 后面的那段字符：</p>
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
              <span>红色部分就是表格编号</span>
            </div>
          </div>
        </div>
      </>
    ),
  },
  tableId: {
    title: '自动识别的子表编号',
    icon: '📋',
    description: '从飞书表格链接里自动识别',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">🤖 自动提取</h5>
          <p>这个编号会从上方粘贴的飞书表格链接里自动识别，一般不用手动改。</p>
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>只需在「飞书表格链接」输入框中粘贴完整链接即可。
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">🔧 什么时候需要手动改？</h5>
          <p>只有在自动识别失败时才需要手动改。它通常是链接中 <code>table=</code> 后面的那段字符：</p>
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
              <span>红色部分就是子表编号</span>
            </div>
          </div>
        </div>

        <div className="field-help-alert field-help-info">
          <strong>🔄 切换子表：</strong>在飞书表格里切换不同子表后，请重新复制链接再粘贴。
        </div>
      </>
    ),
  },
  fieldMapping: {
    title: '每一列保存什么',
    icon: '🔄',
    description: '告诉插件网页内容要放进哪一列',
    content: (
      <>
        <div className="field-help-section">
          <h5 className="field-help-section-title">📋 这一项的作用</h5>
          <p>这一步是在告诉插件：网页标题放到哪一列，网页链接放到哪一列，备注和标签放到哪一列。</p>
        </div>

        <div className="field-help-section">
          <h5 className="field-help-section-title">📊 可以保存哪些内容？</h5>
          <div className="field-help-mapping-grid">
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">📰</span>
              <div className="field-help-mapping-info">
                <strong>文章标题</strong>
                <span>当前网页的标题</span>
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
                <span>当前网页的网址</span>
              </div>
            </div>
            <div className="field-help-mapping-item">
              <span className="field-help-mapping-icon">🖼️</span>
              <div className="field-help-mapping-info">
                <strong>封面图片</strong>
                <span>网页主图的网址</span>
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
                <strong>固定内容</strong>
                <span>每次保存都写入同一段文字</span>
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
              <span>表格列名</span>
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
          <strong>⚠️ 重要：</strong>图片建议用「文本」列保存图片网址，不要用「附件」列。
        </div>

        <div className="field-help-alert field-help-tip">
          <strong>💡 提示：</strong>如果某一列每次都要写同样内容，可以选择「固定值」。例如：状态列固定写"待阅读"，来源列固定写"插件保存"。
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
