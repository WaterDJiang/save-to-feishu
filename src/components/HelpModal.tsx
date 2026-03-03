import React from 'react';
import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 帮助文档弹窗组件
 * 提供使用指南和配置说明
 */
export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal-content" onClick={e => e.stopPropagation()}>
        <div className="help-modal-header">
          <h2>📖 使用帮助</h2>
          <button className="help-modal-close" onClick={onClose} aria-label="关闭帮助">×</button>
        </div>
        
        <div className="help-modal-body">
          {/* 快速开始 */}
          <section className="help-section">
            <h3>🚀 快速开始（5 步完成配置）</h3>
            <div className="help-quickstart">
              <div className="help-step-card">
                <span className="help-step-num">1</span>
                <h4>创建应用</h4>
                <p>在飞书开放平台创建「企业自建应用」</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">2</span>
                <h4>获取凭证</h4>
                <p>复制应用的 App ID 和 App Secret</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">3</span>
                <h4>开通权限</h4>
                <p>为应用添加「多维表格」权限并发布</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">4</span>
                <h4>添加表格</h4>
                <p>复制多维表格链接，提取 Token 和 Table ID</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">5</span>
                <h4>配置映射</h4>
                <p>设置网页内容保存到表格的对应列</p>
              </div>
            </div>
          </section>

          {/* 获取应用凭证 */}
          <section className="help-section">
            <h3>🔑 如何获取应用凭证</h3>
            
            <div className="help-step">
              <h4>📱 步骤 1：创建飞书应用</h4>
              <ol>
                <li>访问 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer">飞书开放平台</a></li>
                <li>点击「创建应用」→「企业自建应用」</li>
                <li>填写应用名称（如：网页收藏助手），点击「创建」</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>📝 步骤 2：获取 App ID 和 App Secret</h4>
              <ol>
                <li>进入应用详情页，点击左侧「凭证与基础信息」</li>
                <li>复制 <strong>App ID</strong>（格式：cli_xxxxxxxxxxxxxxxx）</li>
                <li>点击 App Secret 旁边的「查看」，复制密钥</li>
                <li>将这两个值粘贴到插件的「飞书应用凭证」页面</li>
              </ol>
              <div className="help-tip">
                <strong>💡 提示：</strong>App Secret 只会显示一次，请妥善保存！
              </div>
            </div>
            
            <div className="help-step">
              <h4>🔐 步骤 3：开通权限并发布</h4>
              <ol>
                <li>点击左侧「权限管理」→「添加权限」</li>
                <li>搜索并添加以下权限：
                  <ul className="help-permission-list">
                    <li><code>bitable:app</code> - 用于读写表格数据</li>
                    <li><code>bitable:app:readonly</code> - 用于获取表格结构</li>
                  </ul>
                </li>
                <li>点击「发布版本」→ 创建版本并发布（<strong>必须发布才能使用</strong>）</li>
              </ol>
              <div className="help-warning">
                <strong>⚠️ 重要：</strong>应用必须发布后才能正常使用，未发布的应用无法获取访问令牌！
              </div>
            </div>
          </section>

          {/* 获取表格信息 */}
          <section className="help-section">
            <h3>📋 如何获取表格信息</h3>
            
            <div className="help-step">
              <h4>🔗 步骤 1：复制表格链接</h4>
              <ol>
                <li>在飞书桌面端或网页版打开目标多维表格</li>
                <li>点击右上角的「···」（更多）按钮</li>
                <li>选择「复制链接」</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>🔍 步骤 2：从链接中提取信息</h4>
              <p>复制的链接格式如下：</p>
              <code className="help-code-block">
                https://your-domain.feishu.cn/base/<strong>Bascnxxxxx</strong>?table=<strong>tblxxxxx</strong>&view=<strong>vewxxxxx</strong>
              </code>
              <div className="help-params">
                <div className="help-param">
                  <span className="help-param-name">表格链接 Token</span>
                  <span className="help-param-desc">base/ 后面的字符串（如 Bascnxxxxx）</span>
                </div>
                <div className="help-param">
                  <span className="help-param-name">数据表 ID</span>
                  <span className="help-param-desc">table= 后面的字符串（如 tblxxxxx）</span>
                </div>
              </div>
            </div>
            
            <div className="help-step">
              <h4>✅ 步骤 3：在插件中填写</h4>
              <ol>
                <li>进入插件「设置」→「多维表格」页面</li>
                <li>点击「添加多维表格」</li>
                <li>填写表格名称（用于识别，如"文章收藏"）</li>
                <li>将 <strong>表格链接 Token</strong> 粘贴到对应字段</li>
                <li>将 <strong>数据表 ID</strong> 粘贴到对应字段</li>
                <li>点击「获取表格字段」按钮，验证连接是否成功</li>
              </ol>
            </div>
          </section>

          {/* 字段对应关系 */}
          <section className="help-section">
            <h3>📊 字段对应关系说明</h3>
            <p className="help-section-desc">配置网页内容应该保存到表格的哪一列：</p>

            <div className="help-table-wrapper">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>网页内容</th>
                    <th>说明</th>
                    <th>建议表格字段类型</th>
                    <th>示例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>文章标题</strong></td>
                    <td>网页的标题（浏览器标签页显示的标题）</td>
                    <td><span className="help-badge">文本</span></td>
                    <td>"如何学习编程"</td>
                  </tr>
                  <tr>
                    <td><strong>正文内容</strong></td>
                    <td>网页正文摘要（自动提取主要内容，最多 3000 字）</td>
                    <td><span className="help-badge">文本</span></td>
                    <td>"本文介绍了编程的基础知识..."</td>
                  </tr>
                  <tr>
                    <td><strong>页面网址</strong></td>
                    <td>当前网页的完整链接地址</td>
                    <td><span className="help-badge help-badge-link">超链接</span></td>
                    <td>https://example.com/article</td>
                  </tr>
                  <tr>
                    <td><strong>封面图片</strong></td>
                    <td>网页的主图或首图 URL</td>
                    <td><span className="help-badge">文本</span></td>
                    <td>https://example.com/image.jpg</td>
                  </tr>
                  <tr>
                    <td><strong>保存时间</strong></td>
                    <td>点击保存按钮时的日期时间</td>
                    <td><span className="help-badge help-badge-date">日期</span></td>
                    <td>2024-01-15 14:30:00</td>
                  </tr>
                  <tr>
                    <td><strong>固定值</strong></td>
                    <td>你自定义的固定文本内容</td>
                    <td><span className="help-badge">任意</span></td>
                    <td>"待阅读"、"重要"</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 使用技巧 */}
          <section className="help-section">
            <h3>💡 使用技巧</h3>
            <div className="help-tips-grid">
              <div className="help-tip-card">
                <h4>🎯 快速保存</h4>
                <p>点击浏览器工具栏的插件图标，即可快速打开保存浮窗</p>
              </div>
              <div className="help-tip-card">
                <h4>📑 多表格管理</h4>
                <p>可以配置多个表格，按类别保存（如"技术文章"、"设计灵感"）</p>
              </div>
              <div className="help-tip-card">
                <h4>🏷️ 自动分类</h4>
                <p>使用「固定值」功能，保存时自动添加标签或分类</p>
              </div>
              <div className="help-tip-card">
                <h4>🔄 拖拽排序</h4>
                <p>在保存浮窗中，可以拖拽调整表格的显示顺序</p>
              </div>
            </div>
          </section>

          {/* 重要提醒 */}
          <section className="help-section help-section-warning">
            <h3>⚠️ 重要提醒</h3>
            <ul className="help-warning-list">
              <li>
                <strong>图片字段：</strong>请将表格中的图片列设为「文本」类型，插件会保存图片的 URL 链接
              </li>
              <li>
                <strong>网址字段：</strong>建议设为「超链接」类型，保存后可直接点击访问
              </li>
              <li>
                <strong>应用必须发布：</strong>飞书应用创建后必须「发布版本」才能正常使用
              </li>
              <li>
                <strong>权限检查：</strong>如果保存失败，请检查应用是否已添加「多维表格」权限
              </li>
              <li>
                <strong>Token 自动刷新：</strong>访问令牌有效期 2 小时，插件会自动刷新，无需手动处理
              </li>
              <li>
                <strong>数据安全：</strong>您的应用凭证和表格信息会加密存储在浏览器本地
              </li>
            </ul>
          </section>

          {/* 常见问题 */}
          <section className="help-section">
            <h3>🔧 常见问题解决</h3>
            <div className="help-faq">
              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">保存失败 "Missing access token"（缺少访问令牌）</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>应用凭证错误或应用未发布</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>检查 App ID 和 App Secret 是否复制正确</li>
                    <li>确认飞书应用已「发布版本」</li>
                    <li>确认应用已添加「多维表格」权限</li>
                    <li>点击「测试连接」按钮验证凭证</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">保存失败 "FieldNameNotFound"（字段不存在）</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>表格字段发生变化，或字段 ID 不正确</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>在插件设置中点击「获取表格字段」刷新字段列表</li>
                    <li>重新配置字段对应关系</li>
                    <li>保存配置后重试</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">保存失败 "URLFieldConvFail"（网址字段格式错误）</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>表格中的网址列类型不匹配</p>
                  <p><strong>解决方法：</strong>在飞书表格中，将对应列的类型改为「超链接」</p>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">保存失败 "AttachFieldConvFail"（附件字段错误）</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>图片保存到了「附件」类型字段</p>
                  <p><strong>解决方法：</strong>在飞书表格中，将图片列改为「文本」类型，插件会保存图片 URL</p>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❓</span>
                  <span className="help-faq-title">提取的内容不完整或不准确</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>某些网站使用特殊技术（如动态加载、Shadow DOM）阻止内容提取</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>可以手动复制内容，使用「固定值」方式保存</li>
                    <li>或者只保存标题和链接，手动添加内容</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❓</span>
                  <span className="help-faq-title">如何备份或迁移配置？</span>
                </summary>
                <div className="help-faq-content">
                  <p>在「设置」→「导入/导出」页面，可以：</p>
                  <ol>
                    <li><strong>导出配置：</strong>将所有配置导出为 JSON 文件备份</li>
                    <li><strong>导入配置：</strong>从 JSON 文件恢复配置</li>
                  </ol>
                  <div className="help-tip">
                    <strong>💡 提示：</strong>导出时可以选择是否包含敏感信息（App Secret）
                  </div>
                </div>
              </details>
            </div>
          </section>

          {/* 联系支持 */}
          <section className="help-section help-section-contact">
            <h3>📞 需要帮助？</h3>
            <p>如果您遇到其他问题，可以：</p>
            <ul>
              <li>查看飞书开放平台文档：<a href="https://open.feishu.cn/document" target="_blank" rel="noopener noreferrer">https://open.feishu.cn/document</a></li>
              <li>检查浏览器控制台（F12）查看详细错误信息</li>
              <li>尝试重新安装插件或清除浏览器缓存</li>
            </ul>
          </section>
        </div>
        
        <div className="help-modal-footer">
          <button className="help-btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
};
