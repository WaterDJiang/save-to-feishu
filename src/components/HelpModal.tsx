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
            <h3>🚀 快速开始（跟着做 5 步）</h3>
            <div className="help-quickstart">
              <div className="help-step-card">
                <span className="help-step-num">1</span>
                <h4>创建应用</h4>
                <p>在飞书开放平台创建「企业自建应用」</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">2</span>
                <h4>复制钥匙</h4>
                <p>复制飞书给插件的两串钥匙</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">3</span>
                <h4>允许保存</h4>
                <p>让这个应用可以读写你的飞书表格</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">4</span>
                <h4>添加表格</h4>
                <p>直接粘贴飞书表格链接，插件会自动识别</p>
              </div>
              <div className="help-step-card">
                <span className="help-step-num">5</span>
                <h4>开始剪藏</h4>
                <p>点击插件图标，在侧栏里确认后保存</p>
              </div>
            </div>
          </section>

          {/* 获取应用凭证 */}
          <section className="help-section">
            <h3>🔑 如何让插件连接飞书</h3>
            
            <div className="help-step">
              <h4>📱 步骤 1：创建飞书应用</h4>
              <ol>
                <li>访问 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer">飞书开放平台</a></li>
                <li>点击「创建应用」→「企业自建应用」</li>
                <li>填写应用名称（如：网页收藏助手），点击「创建」</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>📝 步骤 2：复制飞书给插件的两串钥匙</h4>
              <ol>
                <li>进入应用详情页，点击左侧「凭证与基础信息」</li>
                <li>复制 <strong>App ID</strong>（第 1 串钥匙，通常以 cli_ 开头）</li>
                <li>点击 App Secret 旁边的「查看」，复制 <strong>App Secret</strong>（第 2 串钥匙）</li>
                <li>将这两个值粘贴到插件的「连接飞书」页面</li>
              </ol>
              <div className="help-tip">
                <strong>💡 提示：</strong>App Secret 像密码一样，请不要发给别人。
              </div>
            </div>
            
            <div className="help-step">
              <h4>🔐 步骤 3：允许插件保存到表格</h4>
              <ol>
                <li>点击左侧「权限管理」→「添加权限」</li>
                <li>搜索并添加以下权限：
                  <ul className="help-permission-list">
                    <li>读写多维表格：用于把网页内容保存到表格</li>
                    <li>查看多维表格结构：用于读取表格里有哪些列</li>
                  </ul>
                </li>
                <li>点击「发布版本」→ 创建版本并发布（<strong>必须发布才能使用</strong>）</li>
              </ol>
              <div className="help-warning">
                <strong>⚠️ 重要：</strong>应用必须发布后才能使用。没有发布，插件就连不上飞书。
              </div>
            </div>
          </section>

          {/* 获取表格信息 */}
          <section className="help-section">
            <h3>📋 如何添加一个飞书资料库</h3>
            
            <div className="help-step">
              <h4>🔗 步骤 1：复制表格链接</h4>
              <ol>
                <li>在飞书桌面端或网页版打开目标多维表格</li>
                <li>点击右上角的「···」（更多）按钮</li>
                <li>选择「复制链接」</li>
              </ol>
            </div>
            
            <div className="help-step">
              <h4>🔍 步骤 2：把链接粘贴给插件</h4>
              <p>你不用手动拆链接。插件会从类似下面的网址里自动识别表格信息：</p>
              <code className="help-code-block">
                https://your-domain.feishu.cn/base/<strong>Bascnxxxxx</strong>?table=<strong>tblxxxxx</strong>&view=<strong>vewxxxxx</strong>
              </code>
              <div className="help-params">
                <div className="help-param">
                  <span className="help-param-name">表格编号</span>
                  <span className="help-param-desc">插件会自动识别，不需要手动填写</span>
                </div>
                <div className="help-param">
                  <span className="help-param-name">子表编号</span>
                  <span className="help-param-desc">插件会自动识别当前打开的是哪张子表</span>
                </div>
              </div>
            </div>
            
            <div className="help-step">
              <h4>✅ 步骤 3：在插件中填写</h4>
              <ol>
                <li>进入插件「设置」→「飞书资料库」页面</li>
                <li>点击「添加资料库」</li>
                <li>填写表格名称（用于识别，如"文章收藏"）</li>
                <li>把完整的飞书表格链接粘贴进去</li>
                <li>点击「读取表格列名」，确认插件能看到这张表</li>
              </ol>
            </div>
          </section>

          {/* 字段对应关系 */}
          <section className="help-section">
            <h3>📊 每一列应该保存什么</h3>
            <p className="help-section-desc">这一步是在告诉插件：网页里的内容应该放进表格的哪一列。</p>

            <div className="help-table-wrapper">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>网页里的内容</th>
                    <th>说明</th>
                    <th>建议列类型</th>
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
                    <td><strong>资料类型</strong></td>
                    <td>阅读资料、行业研究、内容素材等分类</td>
                    <td><span className="help-badge">单选/文本</span></td>
                    <td>行业研究</td>
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

          {/* AI 整理 */}
          <section className="help-section">
            <h3>✨ 浏览器本地整理建议</h3>
            <p className="help-section-desc">在支持 Chrome 内置 AI 的浏览器中，侧栏会自动给出摘要、标签和资料类型。它只是保存前的建议，你可以直接修改。</p>
            <div className="help-step">
              <h4>使用方式</h4>
              <ol>
                <li>打开要保存的网页，点击插件图标打开侧栏</li>
                <li>等待「整理建议」生成摘要、标签和资料类型</li>
                <li>检查内容是否合适，需要时手动修改</li>
                <li>点击「保存到飞书」或「下载 Markdown」</li>
              </ol>
              <div className="help-tip">
                <strong>说明：</strong>这个能力使用浏览器本地能力，不需要填写 OpenAI、豆包或其他云端 API key。当前 Chrome 暂不支持时，仍然可以手动填写并保存。
              </div>
            </div>
          </section>

          {/* Notion 同步 */}
          <section className="help-section">
            <h3>🔄 Notion 与飞书同步</h3>
            <p className="help-section-desc">除了把网页保存到飞书，你也可以在 Notion 数据库和飞书表格之间同步资料。</p>

            <div className="help-step">
              <h4>🧩 步骤 1：在 Notion 创建一个连接</h4>
              <ol>
                <li>在插件设置页点击「打开 Notion 获取连接码」，或访问 <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer">Notion Integrations</a></li>
                <li>创建一个内部连接，复制 Notion 生成的 <strong>连接码</strong>（通常以 secret_ 开头）</li>
                <li>打开要同步的 Notion 数据库页面，点击右上角「···」→「Connections」，把刚创建的连接添加进去</li>
              </ol>
              <div className="help-tip">
                <strong>💡 提示：</strong>如果没有把这个连接添加到数据库，插件虽然能连上 Notion，但看不到那张数据库。
              </div>
            </div>

            <div className="help-step">
              <h4>⚙️ 步骤 2：在插件中保存 Notion 连接码</h4>
              <ol>
                <li>进入插件「设置」→「Notion 与飞书同步」页面</li>
                <li>粘贴 Notion 连接码</li>
                <li>点击「检查连接」</li>
                <li>连接成功后，插件会列出它能看到的 Notion 数据库，方便你选择</li>
              </ol>
            </div>

            <div className="help-step">
              <h4>🧭 步骤 3：创建一条同步规则</h4>
              <ol>
                <li>填写规则名称，例如「Notion 选题库同步到飞书」</li>
                <li>选择同步方向：<strong>Notion → 飞书</strong> 或 <strong>飞书 → Notion</strong></li>
                <li>选择或粘贴 Notion 数据库页面链接</li>
                <li>从已经连接的飞书资料库中选择目标表格</li>
                <li>设置这次最多同步多少条，建议第一次先用 10-20 条测试</li>
              </ol>
            </div>

            <div className="help-step">
              <h4>🔗 步骤 4：告诉插件每一列怎么对应</h4>
              <ol>
                <li>点击「读取两边列名」，让插件读取 Notion 和飞书各有哪些列</li>
                <li>如果两边列名相同，可以点击「自动匹配同名列」</li>
                <li>检查每一行：左边是要同步的列，右边是同步后放入哪一列</li>
                <li>点击「保存规则」，以后可以复用这组设置</li>
                <li>点击「开始同步」，插件会按当前方向同步资料</li>
              </ol>
              <div className="help-warning">
                <strong>⚠️ 注意：</strong>当前需要手动点击「开始同步」，插件不会自动监听 Notion 或飞书的变化。建议优先同步文本、数字、日期、单选、多选、网址、邮箱、复选框这些普通列。
              </div>
            </div>
          </section>

          {/* 使用技巧 */}
          <section className="help-section">
            <h3>💡 使用技巧</h3>
            <div className="help-tips-grid">
              <div className="help-tip-card">
                <h4>🎯 快速保存</h4>
                <p>点击浏览器工具栏的插件图标，即可打开网页剪藏侧栏</p>
              </div>
              <div className="help-tip-card">
                <h4>📑 多表格管理</h4>
                <p>可以准备多个资料库，按类别保存（如"行业资料"、"设计灵感"）</p>
              </div>
              <div className="help-tip-card">
                <h4>🏷️ 标签与类型</h4>
                <p>保存前可以补充标签、资料类型和个人备注，方便以后筛选</p>
              </div>
              <div className="help-tip-card">
                <h4>✨ 本地整理建议</h4>
                <p>Chrome 支持时会自动给出摘要和标签，不支持也不影响手动保存</p>
              </div>
              <div className="help-tip-card">
                <h4>🔁 Notion 与飞书同步</h4>
                <p>在侧栏中点击「Notion 与飞书同步」，可直接进入同步规则设置页</p>
              </div>
            </div>
          </section>

          {/* 重要提醒 */}
          <section className="help-section help-section-warning">
            <h3>⚠️ 重要提醒</h3>
            <ul className="help-warning-list">
              <li>
                <strong>图片列：</strong>请将表格中的图片列设为「文本」类型，插件会保存图片网址
              </li>
              <li>
                <strong>网址列：</strong>建议设为「超链接」类型，保存后可直接点击访问
              </li>
              <li>
                <strong>应用必须发布：</strong>飞书应用创建后必须「发布版本」才能正常使用
              </li>
              <li>
                <strong>权限检查：</strong>如果保存失败，请检查飞书是否允许这个应用编辑表格
              </li>
              <li>
                <strong>自动连接：</strong>飞书连接会自动续上，无需你手动处理
              </li>
              <li>
                <strong>数据安全：</strong>你的连接信息和表格设置会加密存储在浏览器本地
              </li>
              <li>
                <strong>Notion 连接码：</strong>Notion 连接码同样只保存在本地，导出设置时默认不会包含
              </li>
              <li>
                <strong>本地 AI：</strong>整理建议只在浏览器支持时运行，不需要额外 API key，也不会把内容发给插件开发者服务器
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
                  <span className="help-faq-title">保存失败，提示连接飞书失败</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>飞书的两串钥匙复制错了，或飞书应用还没有发布</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>检查 App ID 和 App Secret 是否复制完整</li>
                    <li>确认飞书应用已「发布版本」</li>
                    <li>确认飞书允许这个应用读写表格</li>
                    <li>点击「检查连接」按钮验证</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">保存失败，提示找不到某一列</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>飞书表格里的列名改过，插件还记着旧设置</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>在插件设置中点击「读取表格列名」</li>
                    <li>重新确认每一列要保存什么</li>
                    <li>保存后再试一次</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">链接没有保存成功</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>飞书里接收链接的那一列类型不合适</p>
                  <p><strong>解决方法：</strong>在飞书表格中，将对应列的类型改为「超链接」或「文本」</p>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❌</span>
                  <span className="help-faq-title">图片没有保存成功</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>图片列设置成了「附件」，但插件保存的是图片链接</p>
                  <p><strong>解决方法：</strong>在飞书表格中，将图片列改为「文本」类型，插件会保存图片网址</p>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❓</span>
                  <span className="help-faq-title">Notion 能连接，但看不到我的数据库</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>你还没有把 Notion 连接添加到目标数据库</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>打开 Notion Database 页面</li>
                    <li>点击右上角「···」→「Connections」</li>
                    <li>添加你创建的 Notion 连接</li>
                    <li>回到插件「Notion 与飞书同步」页面重新连接或读取列名</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❓</span>
                  <span className="help-faq-title">同步后有些列是空的</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>两边的列类型不太一样，或选到了人员、附件等复杂列</p>
                  <p><strong>解决方法：</strong></p>
                  <ol>
                    <li>优先使用文本、数字、日期、单选、多选、网址、邮箱、复选框这些普通列</li>
                    <li>重新点击「读取两边列名」，确认列没有被删除或改名</li>
                    <li>首次同步建议把上限设为 10-20 条，确认格式后再扩大数量</li>
                  </ol>
                </div>
              </details>

              <details className="help-faq-item">
                <summary>
                  <span className="help-faq-icon">❓</span>
                  <span className="help-faq-title">提取的内容不完整或不准确</span>
                </summary>
                <div className="help-faq-content">
                  <p><strong>原因：</strong>有些网页内容是边加载边出现的，插件可能没抓全</p>
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
                  <p>在「设置」→「备份与恢复」页面，可以：</p>
                  <ol>
                    <li><strong>备份当前设置：</strong>下载一个备份文件</li>
                    <li><strong>恢复以前的设置：</strong>从备份文件恢复资料库和同步规则</li>
                  </ol>
                  <div className="help-tip">
                    <strong>💡 提示：</strong>如果勾选了连接密钥，请把备份文件只保存在自己的设备上。
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
