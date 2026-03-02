import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HelpCircle, X } from 'lucide-react';
import './FieldHelp.css';

/**
 * 字段帮助内容配置
 * 使用 as const 确保类型安全
 */
export const FIELD_HELP_CONTENT = {
  appId: {
    title: 'App ID',
    content: (
      <>
        <p>飞书开放平台应用的 App ID，用于识别你的应用身份。</p>
        <p><strong>获取方式：</strong></p>
        <ol>
          <li>访问 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer">飞书开放平台</a></li>
          <li>创建「企业自建应用」并进入应用详情</li>
          <li>点击左侧「凭证与基础信息」</li>
          <li>复制 App ID（格式：cli_xxxxxxxxxxxxxxxx）</li>
        </ol>
        <div className="field-help-alert field-help-tip">💡 App ID 以 cli_ 开头，共约 20 位字符</div>
      </>
    ),
  },
  appSecret: {
    title: 'App Secret',
    content: (
      <>
        <p>应用的 App Secret，用于生成访问飞书 API 的令牌。</p>
        <p><strong>获取方式：</strong></p>
        <ol>
          <li>在同一页面「凭证与基础信息」中</li>
          <li>点击 App Secret 旁边的「查看」按钮</li>
          <li>可能需要管理员扫码验证</li>
          <li>复制显示的密钥</li>
        </ol>
        <div className="field-help-alert field-help-warning">⚠️ App Secret 相当于应用密码，请勿泄露给他人</div>
      </>
    ),
  },
  appToken: {
    title: '表格链接 Token',
    content: (
      <>
        <p>飞书多维表格的唯一标识符，用于定位你的表格文档。</p>
        <p><strong>获取方式：</strong></p>
        <ol>
          <li>在飞书桌面端或网页版打开目标多维表格</li>
          <li>点击右上角「···」→「复制链接」</li>
          <li>从链接中提取 <code>base/</code> 后面的字符串</li>
        </ol>
        <p>链接格式示例：</p>
        <code className="field-help-code">
          https://xxx.feishu.cn/base/<strong>Bascnxxxxx</strong>?table=tblxxxxx
        </code>
        <div className="field-help-alert field-help-tip">💡 只需复制 <strong>Bascnxxxxx</strong> 这部分即可</div>
      </>
    ),
  },
  tableId: {
    title: '数据表 ID',
    content: (
      <>
        <p>多维表格中具体数据表（子表）的唯一标识符。</p>
        <p><strong>获取方式：</strong></p>
        <ol>
          <li>同样在刚才复制的表格链接中</li>
          <li>提取 <code>table=</code> 后面的字符串</li>
        </ol>
        <p>链接格式示例：</p>
        <code className="field-help-code">
          https://xxx.feishu.cn/base/Bascnxxxxx?table=<strong>tblxxxxx</strong>
        </code>
        <div className="field-help-alert field-help-tip">💡 只需复制 <strong>tblxxxxx</strong> 这部分即可</div>
      </>
    ),
  },
  fieldMapping: {
    title: '字段对应关系',
    content: (
      <>
        <p>告诉插件：网页上的内容应该保存到表格的哪一列。</p>
        <p><strong>常见对应方式：</strong></p>
        <ul>
          <li><strong>文章标题</strong> → 保存到「标题」列</li>
          <li><strong>页面网址</strong> → 保存到「链接」列</li>
          <li><strong>正文内容</strong> → 保存到「内容」列</li>
          <li><strong>封面图片</strong> → 保存到「图片」列（文本类型）</li>
          <li><strong>保存时间</strong> → 保存到「时间」列（自动填充）</li>
        </ul>
        <div className="field-help-alert field-help-warning">⚠️ 图片请使用「文本」类型字段，插件会保存图片链接</div>
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
              <h4 id="field-help-title">{helpContent.title}</h4>
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
                <X size={16} aria-hidden="true" />
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
