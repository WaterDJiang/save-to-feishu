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
          <h2>使用帮助</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="help-modal-body">
          <section className="help-section">
            <h3>📋 快速开始（5 步完成配置）</h3>
            <ol>
              <li><strong>创建应用</strong>：在飞书开放平台创建「企业自建应用」</li>
              <li><strong>获取凭证</strong>：复制应用的 App ID 和 App Secret</li>
              <li><strong>开通权限</strong>：为应用添加「多维表格」权限并发布</li>
              <li><strong>添加表格</strong>：复制多维表格链接，提取 Token 和 Table ID</li>
              <li><strong>配置对应关系</strong>：设置网页内容保存到表格的哪一列</li>
            </ol>
          </section>

          <section className="help-section">
            <h3>🔑 如何获取应用凭证</h3>
            <div className="help-step">
              <h4>步骤 1：创建飞书应用</h4>
              <ol>
                <li>访问 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer">飞书开放平台</a></li>
                <li>点击「创建应用」→「企业自建应用」</li>
                <li>填写应用名称（如：网页收藏助手），点击「创建」</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>步骤 2：获取 App ID 和 App Secret</h4>
              <ol>
                <li>进入应用详情页，点击左侧「凭证与基础信息」</li>
                <li>复制 <strong>App ID</strong>（格式：cli_xxxxxxxxxxxxxxxx）</li>
                <li>点击 App Secret 旁边的「查看」，复制密钥</li>
                <li>将这两个值粘贴到插件的「飞书应用凭证」页面</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>步骤 3：开通权限并发布</h4>
              <ol>
                <li>点击左侧「权限管理」→「添加权限」</li>
                <li>搜索并添加以下权限：
                  <ul>
                    <li>多维表格（bitable:app）- 用于读写表格数据</li>
                    <li>查看多维表格（bitable:app:readonly）- 用于获取表格结构</li>
                  </ul>
                </li>
                <li>点击「发布版本」→ 创建版本并发布（必须发布才能使用）</li>
              </ol>
            </div>
          </section>

          <section className="help-section">
            <h3>📋 如何获取表格信息</h3>
            <div className="help-step">
              <h4>步骤 1：复制表格链接</h4>
              <ol>
                <li>在飞书桌面端或网页版打开目标多维表格</li>
                <li>点击右上角的「···」（更多）按钮</li>
                <li>选择「复制链接」</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>步骤 2：从链接中提取信息</h4>
              <p>复制的链接格式如下：</p>
              <code className="help-code">
                https://your-domain.feishu.cn/base/<strong>Bascnxxxxx</strong>?table=<strong>tblxxxxx</strong>
              </code>
              <ul>
                <li><strong>表格链接 Token</strong>：base/ 后面的字符串（如 Bascnxxxxx）</li>
                <li><strong>数据表 ID</strong>：table= 后面的字符串（如 tblxxxxx）</li>
              </ul>
            </div>
            
            <div className="help-step">
              <h4>步骤 3：在插件中填写</h4>
              <ol>
                <li>进入插件「设置」→「多维表格」页面</li>
                <li>点击「添加多维表格」</li>
                <li>将 <strong>表格链接 Token</strong> 粘贴到对应字段</li>
                <li>将 <strong>数据表 ID</strong> 粘贴到对应字段</li>
                <li>点击「获取表格字段」按钮，验证连接是否成功</li>
              </ol>
            </div>
          </section>

          <section className="help-section">
            <h3>📊 字段对应关系说明</h3>
            <p>配置网页内容应该保存到表格的哪一列：</p>

            <table className="help-table">
              <thead>
                <tr>
                  <th>网页内容</th>
                  <th>说明</th>
                  <th>建议表格字段类型</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>文章标题</strong></td>
                  <td>网页的标题（浏览器标签页显示的标题）</td>
                  <td>文本</td>
                </tr>
                <tr>
                  <td><strong>正文内容</strong></td>
                  <td>网页正文摘要（自动提取主要内容）</td>
                  <td>文本</td>
                </tr>
                <tr>
                  <td><strong>页面网址</strong></td>
                  <td>当前网页的完整链接地址</td>
                  <td>超链接</td>
                </tr>
                <tr>
                  <td><strong>封面图片</strong></td>
                  <td>网页的主图或首图 URL</td>
                  <td>文本（保存图片链接）</td>
                </tr>
                <tr>
                  <td><strong>保存时间</strong></td>
                  <td>点击保存按钮时的日期时间</td>
                  <td>日期</td>
                </tr>
                <tr>
                  <td><strong>固定值</strong></td>
                  <td>你自定义的固定文本内容</td>
                  <td>任意</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="help-section">
            <h3>⚠️ 重要提醒</h3>
            <ul>
              <li><strong>图片字段</strong>：请将表格中的图片列设为「文本」类型，插件会保存图片的 URL 链接</li>
              <li><strong>网址字段</strong>：建议设为「超链接」类型，保存后可直接点击访问</li>
              <li><strong>应用必须发布</strong>：飞书应用创建后必须「发布版本」才能正常使用</li>
              <li><strong>权限检查</strong>：如果保存失败，请检查应用是否已添加「多维表格」权限</li>
              <li><strong>Token 自动刷新</strong>：访问令牌有效期 2 小时，插件会自动刷新，无需手动处理</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>🔧 常见问题解决</h3>
            <div className="help-faq">
              <details>
                <summary>❌ 保存失败 "Missing access token"（缺少访问令牌）</summary>
                <p><strong>原因：</strong>应用凭证错误或应用未发布</p>
                <p><strong>解决：</strong></p>
                <ol>
                  <li>检查 App ID 和 App Secret 是否复制正确</li>
                  <li>确认飞书应用已「发布版本」</li>
                  <li>确认应用已添加「多维表格」权限</li>
                </ol>
              </details>
              <details>
                <summary>❌ 保存失败 "FieldNameNotFound"（字段不存在）</summary>
                <p><strong>原因：</strong>表格字段发生变化，或字段 ID 不正确</p>
                <p><strong>解决：</strong></p>
                <ol>
                  <li>在插件设置中点击「获取表格字段」刷新字段列表</li>
                  <li>重新配置字段对应关系</li>
                  <li>保存配置后重试</li>
                </ol>
              </details>
              <details>
                <summary>❌ 保存失败 "URLFieldConvFail"（网址字段格式错误）</summary>
                <p><strong>原因：</strong>表格中的网址列类型不匹配</p>
                <p><strong>解决：</strong>在飞书表格中，将对应列的类型改为「超链接」</p>
              </details>
              <details>
                <summary>❌ 保存失败 "AttachFieldConvFail"（附件字段错误）</summary>
                <p><strong>原因：</strong>图片保存到了「附件」类型字段</p>
                <p><strong>解决：</strong>在飞书表格中，将图片列改为「文本」类型，插件会保存图片 URL</p>
              </details>
              <details>
                <summary>❓ 提取的内容不完整或不准确</summary>
                <p><strong>原因：</strong>某些网站使用特殊技术（如动态加载）阻止内容提取</p>
                <p><strong>解决：</strong>可以手动复制内容，使用「固定值」方式保存</p>
              </details>
            </div>
          </section>
        </div>
        
        <div className="help-modal-footer">
          <button className="help-btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
};
