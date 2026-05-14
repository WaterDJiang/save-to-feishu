import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Database,
  Download,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Shield,
  FileJson,
  Upload,
  AlertTriangle,
  RefreshCw,
  GripVertical,
  Eye,
  EyeOff,
  HelpCircle,
  ArrowLeftRight,
  KeyRound,
} from 'lucide-react';
import type {
  FeishuCredentials,
  InteropConfig,
  InteropDirection,
  InteropFieldMapping,
  InteropFieldSchema,
  NotionCredentials,
  TableConfig,
  FeishuField,
  TableFieldMapping,
  SaveMode,
} from '@/types';
import {
  getFeishuCredentials,
  saveFeishuCredentials,
  getNotionCredentials,
  saveNotionCredentials,
  getSaveMode,
  saveSaveMode,
  getTableConfigs,
  saveTableConfig,
  deleteTableConfig,
  getInteropConfigs,
  saveInteropConfig,
  deleteInteropConfig,
  exportConfig,
  importConfig,
} from '@/services/storageService';
import {
  testFeishuConnection,
  getTableFields,
} from '@/services/feishuService';
import { getFeishuInteropSchema, syncInteropConfig } from '@/services/interopService';
import { getNotionDatabaseSchema, listNotionDatabases, testNotionConnection } from '@/services/notionService';
import { HelpModal } from '@/components/HelpModal';
import { FieldHelp } from '@/components/FieldHelp';
import { KNOWLEDGE_TEMPLATES } from '@/utils/knowledgeTemplates';

type ViewType = 'feishu' | 'tables' | 'interop' | 'importExport';

/**
 * 侧边栏导航项组件
 */
function SidebarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`sidebar-item ${isActive ? 'active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={badge !== undefined && badge > 0 ? `${label}，${badge} 个项目` : label}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="sidebar-label">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="sidebar-badge" aria-label={`${badge} 个项目`}>{badge}</span>
      )}
    </button>
  );
}

/**
 * 飞书配置视图
 */
function FeishuConfigView({
  creds,
  setCreds,
  onSave,
  onTest,
  isTesting,
  testResult,
  saveMode,
  setSaveMode,
}: {
  creds: FeishuCredentials;
  setCreds: (c: FeishuCredentials) => void;
  onSave: () => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: { success: boolean; message: string } | null;
  saveMode: SaveMode;
  setSaveMode: (mode: SaveMode) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="config-section">
      <div className="config-header">
        <div className="config-icon">
          <Settings size={24} />
        </div>
        <div className="config-title-group">
          <h2 className="config-title">连接飞书</h2>
          <p className="config-subtitle">把飞书给插件的两串钥匙填进来，插件才能把网页保存到你的飞书表格。</p>
        </div>
      </div>

      <div className="config-card">
        <div className="card-header">
          <Download size={20} />
          <h3>默认保存方式</h3>
        </div>
        <div className="save-mode-grid">
          {[
            { value: 'both', title: '飞书 + 电脑各存一份', desc: '既保存到飞书，也下载一份 Markdown 文件。' },
            { value: 'feishu', title: '只保存到飞书', desc: '适合团队一起整理和筛选资料。' },
            { value: 'markdown', title: '只保存到电脑', desc: '不连接飞书也能先保存成 Markdown 笔记。' },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`save-mode-card ${saveMode === mode.value ? 'active' : ''}`}
              onClick={() => setSaveMode(mode.value as SaveMode)}
            >
              <span className="save-mode-title">{mode.title}</span>
              <span className="save-mode-desc">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="config-card">
        <div className="form-group">
          <label className="form-label form-label-with-help">
            <ExternalLink size={14} />
            第 1 串钥匙（App ID）
            <FieldHelp fieldKey="appId" />
          </label>
          <input
            type="text"
            value={creds.appId}
            onChange={(e) => setCreds({ ...creds, appId: e.target.value })}
            className="form-input"
            placeholder="cli_xxxxxxxxxxxxxxxx"
          />
          <p className="form-hint">这是飞书给插件的第 1 串钥匙，通常以 cli_ 开头。</p>
        </div>

        <div className="form-group">
          <label className="form-label form-label-with-help">
            <Shield size={14} />
            第 2 串钥匙（App Secret）
            <FieldHelp fieldKey="appSecret" />
          </label>
          <div className="input-with-action">
            <input
              type={showSecret ? 'text' : 'password'}
              value={creds.appSecret}
              onChange={(e) => setCreds({ ...creds, appSecret: e.target.value })}
              className="form-input"
              placeholder="粘贴 App Secret"
            />
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="input-action-btn"
              title={showSecret ? '隐藏' : '显示'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="form-hint">这是飞书给插件的第 2 串钥匙，请不要发给别人。</p>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="form-actions">
          <button
            onClick={onTest}
            disabled={isTesting || !creds.appId || !creds.appSecret}
            className="btn btn-secondary"
          >
            {isTesting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            检查连接
          </button>
          <button
            onClick={onSave}
            disabled={!creds.appId}
            className="btn btn-primary"
          >
            <Save size={16} />
            保存
          </button>
        </div>
      </div>

      <div className="info-card info">
        <h3 className="info-title">
          <Sparkles size={16} />
          不知道填什么？
        </h3>
        <ol className="info-list">
          <li>访问 <a href="https://open.feishu.cn" target="_blank" rel="noopener noreferrer" className="info-link">飞书开放平台</a></li>
          <li>创建「企业自建应用」</li>
          <li>进入应用 →「凭证与基础信息」，复制 App ID 和 App Secret 两串钥匙</li>
          <li>进入「权限管理」，给应用开通读写多维表格的权限</li>
          <li>发布应用版本（必须发布后才能正常使用）</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * 表格配置视图
 */
function TableConfigView({
  tables,
  selectedTableId,
  setSelectedTableId,
  onRefresh,
}: {
  tables: TableConfig[];
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  onRefresh: () => void;
}) {
  const [editingTable, setEditingTable] = useState<Partial<TableConfig>>({
    name: '',
    appToken: '',
    tableId: '',
    tableUrl: '',
    fieldMappings: [],
  });
  const [availableFields, setAvailableFields] = useState<FeishuField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const existingTable = selectedTableId ? tables.find((t) => t.id === selectedTableId) : null;
  const isNewTable = !existingTable;

  useEffect(() => {
    if (existingTable) {
      setEditingTable(existingTable);
    } else {
      setEditingTable({
        name: '',
        appToken: '',
        tableId: '',
        tableUrl: '',
        fieldMappings: [],
      });
    }
    setAvailableFields([]);
  }, [existingTable]);

  /**
   * 从飞书多维表格链接中解析 appToken 和 tableId
   * @param url - 飞书多维表格完整链接
   * @returns 解析结果，包含 appToken 和 tableId
   */
  const parseTableUrl = (url: string): { appToken: string; tableId: string } | null => {
    try {
      const urlObj = new URL(url);
      // 匹配 /base/xxxx 格式
      const baseMatch = urlObj.pathname.match(/\/base\/([a-zA-Z0-9]+)/);
      if (!baseMatch) return null;

      const appToken = baseMatch[1];
      // 从查询参数获取 tableId
      const tableId = urlObj.searchParams.get('table');
      if (!tableId) return null;

      return { appToken, tableId };
    } catch {
      return null;
    }
  };

  const loadFields = async () => {
    if (!editingTable.appToken || !editingTable.tableId) return;
    setIsLoading(true);
    try {
      const fields = await getTableFields(editingTable.appToken, editingTable.tableId);
      setAvailableFields(fields);
    } catch (error) {
      console.error('Failed to load fields:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingTable.name || !editingTable.appToken || !editingTable.tableId) return;

    setIsSaving(true);
    try {
      const table: TableConfig = {
        id: existingTable?.id || crypto.randomUUID(),
        name: editingTable.name,
        appToken: editingTable.appToken,
        tableId: editingTable.tableId,
        tableUrl: editingTable.tableUrl || '',
        templateId: editingTable.templateId,
        fieldMappings: editingTable.fieldMappings || [],
        createdAt: existingTable?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await saveTableConfig(table);
      await onRefresh();
      setSelectedTableId(table.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingTable) return;
    if (!confirm('确定要删除这个表格配置吗？此操作不可恢复。')) return;

    await deleteTableConfig(existingTable.id);
    await onRefresh();
    setSelectedTableId(null);
  };

  const updateMapping = (fieldId: string, sourceType: TableFieldMapping['sourceType'], staticValue?: string) => {
    const field = availableFields.find((f) => f.id === fieldId);
    if (!field) return;

    const existingMappings = editingTable.fieldMappings || [];
    const index = existingMappings.findIndex((m) => m.feishuFieldId === fieldId);

    const newMapping: TableFieldMapping = {
      feishuFieldId: fieldId,
      feishuFieldName: field.name,
      sourceType,
      staticValue,
    };

    let newMappings: TableFieldMapping[];
    if (index >= 0) {
      newMappings = [...existingMappings];
      newMappings[index] = newMapping;
    } else {
      newMappings = [...existingMappings, newMapping];
    }

    setEditingTable({ ...editingTable, fieldMappings: newMappings });
  };

  const normalizeFieldName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

  const applyTemplate = (templateId: TableConfig['templateId']) => {
    const template = KNOWLEDGE_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;

    const newMappings = [...(editingTable.fieldMappings || [])];
    for (const templateField of template.fields) {
      const matchedField = availableFields.find((field) => {
        const fieldName = normalizeFieldName(field.name);
        return templateField.aliases.some((alias) => {
          const normalizedAlias = normalizeFieldName(alias);
          return fieldName === normalizedAlias || fieldName.includes(normalizedAlias);
        });
      });
      if (!matchedField) continue;

      const nextMapping: TableFieldMapping = {
        feishuFieldId: matchedField.id,
        feishuFieldName: matchedField.name,
        sourceType: templateField.sourceType,
      };
      const index = newMappings.findIndex((mapping) => mapping.feishuFieldId === matchedField.id);
      if (index >= 0) {
        newMappings[index] = nextMapping;
      } else {
        newMappings.push(nextMapping);
      }
    }

    setEditingTable({
      ...editingTable,
      templateId,
      name: editingTable.name || template.name,
      fieldMappings: newMappings,
    });
  };

  const sourceTypeOptions = [
    { value: '', label: '-- 这一列先不保存 --' },
    { value: 'url', label: '🔗 页面网址', desc: '网页链接地址' },
    { value: 'title', label: '📝 标题', desc: '网页标题' },
    { value: 'docUrl', label: '📄 飞书文档链接', desc: '创建飞书文档并保存链接，适合长文章和图片较多的页面' },
    { value: 'description', label: '🪪 页面摘要', desc: '网页自带的简短介绍' },
    { value: 'contentText', label: '🧾 正文内容', desc: '插件从页面中提取的正文文本' },
    { value: 'tags', label: '🏷️ 标签', desc: '剪藏时填写的标签' },
    { value: 'source', label: '🌐 来源站点', desc: '网页域名或来源名称' },
    { value: 'status', label: '📥 整理状态', desc: '未处理、待读、精读等状态' },
    { value: 'contentType', label: '🗂️ 资料类型', desc: '阅读资料、行业研究、内容素材等类型' },
    { value: 'excerpt', label: '✂️ 摘录', desc: '选中文本或摘要' },
    { value: 'note', label: '💬 个人备注', desc: '剪藏时填写的备注' },
    { value: 'reviewAt', label: '📅 下次回顾', desc: '剪藏时选择的回顾日期' },
    { value: 'saveTime', label: '⏱️ 保存时间', desc: '剪藏时间' },
    { value: 'static', label: '⚡ 固定值', desc: '自定义固定内容' },
  ];

  return (
    <div className="config-section">
      <div className="config-header">
        <div className="config-icon">
          <Database size={24} />
        </div>
        <div className="config-title-group">
          <h2 className="config-title">
            {isNewTable ? '添加飞书资料库' : '资料库设置'}
          </h2>
          <p className="config-subtitle">
            {isNewTable ? '粘贴一个飞书表格链接，告诉插件以后保存到哪里。' : `当前资料库：${existingTable.name}`}
          </p>
        </div>
      </div>

      <div className="config-card">
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">给这个资料库起个名字</label>
            <input
              type="text"
              value={editingTable.name}
              onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
              className="form-input"
              placeholder="例如：我的收藏、待读文章、选题库"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label form-label-with-help">
              飞书表格链接
              <FieldHelp fieldKey="tableUrl" />
            </label>
            <div className="input-with-action">
              <input
                type="text"
                value={editingTable.tableUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  const parsed = parseTableUrl(url);
                  if (parsed) {
                    setEditingTable({
                      ...editingTable,
                      tableUrl: url,
                      appToken: parsed.appToken,
                      tableId: parsed.tableId,
                    });
                  } else {
                    setEditingTable({ ...editingTable, tableUrl: url });
                  }
                }}
                className="form-input"
                placeholder="直接粘贴飞书表格的网址，插件会自动识别"
              />
              {editingTable.tableUrl && parseTableUrl(editingTable.tableUrl) && (
                <button
                  type="button"
                  onClick={() => window.open(editingTable.tableUrl, '_blank')}
                  className="input-action-btn"
                  title="在浏览器中打开表格"
                >
                  <ExternalLink size={16} />
                </button>
              )}
            </div>
            {editingTable.tableUrl && !parseTableUrl(editingTable.tableUrl) && (
              <span className="form-hint form-hint-error">没有识别到表格信息，请确认粘贴的是完整的飞书表格链接。</span>
            )}
            {editingTable.appToken && editingTable.tableId && (
              <span className="form-hint form-hint-success">✓ 已识别到表格，下一步可以读取列名。</span>
            )}
          </div>
        </div>

        <div className="form-row two-col">
          <div className="form-group">
            <label className="form-label form-label-with-help">
              自动识别的表格编号
              <FieldHelp fieldKey="appToken" />
            </label>
            <input
              type="text"
              value={editingTable.appToken}
              onChange={(e) => setEditingTable({ ...editingTable, appToken: e.target.value })}
              className="form-input"
              placeholder="从表格链接复制，如：Bascnxxxxxxxxxx"
              readOnly
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label-with-help">
              自动识别的子表编号
              <FieldHelp fieldKey="tableId" />
            </label>
            <input
              type="text"
              value={editingTable.tableId}
              onChange={(e) => setEditingTable({ ...editingTable, tableId: e.target.value })}
              className="form-input"
              placeholder="从表格链接复制，如：tblxxxxxxxxxx"
              readOnly
            />
          </div>
        </div>

        <button
          onClick={loadFields}
          disabled={isLoading || !editingTable.appToken || !editingTable.tableId}
          className="btn btn-secondary"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          读取表格列名
        </button>

        <div className="template-section">
          <h3 className="section-title">
            <Sparkles size={16} />
            一键套用资料库模板
          </h3>
          <p className="section-desc">
            先在飞书表格里建好对应的列，再选择一个模板。插件会尽量把标题、链接、标签、备注等内容自动对应到合适的列。
          </p>
          <div className="template-grid">
            {KNOWLEDGE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`template-card ${editingTable.templateId === template.id ? 'active' : ''}`}
                onClick={() => applyTemplate(template.id)}
                disabled={availableFields.length === 0}
              >
                <span className="template-title">{template.name}</span>
                <span className="template-desc">{template.description}</span>
                <span className="template-fields">
                  {template.fields.map((field) => field.label).join('、')}
                </span>
              </button>
            ))}
          </div>
          {availableFields.length === 0 && (
            <p className="form-hint">请先读取表格列名，模板才能帮你自动对应。</p>
          )}
        </div>

        {availableFields.length > 0 && (
          <div className="field-mapping-section">
            <h3 className="section-title">
              <GripVertical size={16} />
              保存内容对应到哪一列
              <FieldHelp fieldKey="fieldMapping" />
            </h3>
            <p className="section-desc">告诉插件：网页里的标题、链接、备注等内容，分别放进表格的哪一列。</p>

            <div className="field-mapping-list">
              {availableFields.map((field) => {
                const mapping = editingTable.fieldMappings?.find(
                  (m) => m.feishuFieldId === field.id
                );
                return (
                  <div key={field.id} className="field-mapping-item">
                    <div className="field-info">
                      <span className="field-name">{field.name}</span>
                      <span className="field-type">{field.type}</span>
                    </div>
                    <div className="field-actions">
                      <select
                        value={mapping?.sourceType || ''}
                        onChange={(e) =>
                          updateMapping(
                            field.id,
                            e.target.value as any,
                            mapping?.staticValue
                          )
                        }
                        className="form-select"
                      >
                        {sourceTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {mapping?.sourceType === 'static' && (
                        <input
                          type="text"
                          value={mapping?.staticValue || ''}
                          onChange={(e) =>
                            updateMapping(field.id, 'static', e.target.value)
                          }
                          className="form-input static-value"
                          placeholder="固定写入这列，例如：待阅读、行业研究、来自插件"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="form-actions">
          {existingTable && (
            <button
              onClick={handleDelete}
              className="btn btn-danger"
            >
              <Trash2 size={16} />
              删除
            </button>
          )}
          <div className="form-actions-spacer" />
          <button
            onClick={handleSave}
            disabled={isSaving || !editingTable.name || !editingTable.appToken || !editingTable.tableId}
            className="btn btn-primary"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存表格
          </button>
        </div>
      </div>

      {/* 重要提示 */}
      <div className="info-card warning">
        <h3 className="info-title">
          <AlertTriangle size={16} />
          保存失败时，优先检查这里
        </h3>
        <ol className="info-list">
          <li>在飞书表格中，点击右上角「···」→「设置」</li>
          <li>进入「权限」设置，把刚才创建的飞书应用加进来</li>
          <li>权限要给「可编辑」，否则插件只能看，不能帮你保存</li>
          <li>如果表格在企业空间，可能需要管理员审批权限申请</li>
        </ol>
      </div>
    </div>
  );
}

function NotionInteropView({
  tables,
}: {
  tables: TableConfig[];
}) {
  const openNotionIntegrations = () => {
    window.open('https://www.notion.so/my-integrations', '_blank', 'noopener,noreferrer');
  };

  const [notionCreds, setNotionCreds] = useState<NotionCredentials>({ integrationToken: '' });
  const [configs, setConfigs] = useState<InteropConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<InteropConfig>>({
    name: '',
    direction: 'notion-to-feishu',
    notionDatabaseId: '',
    feishuAppToken: '',
    feishuTableId: '',
    feishuTableUrl: '',
    mappings: [],
    limit: 20,
  });
  const [notionDatabases, setNotionDatabases] = useState<Array<{ id: string; title: string; url?: string }>>([]);
  const [notionFields, setNotionFields] = useState<InteropFieldSchema[]>([]);
  const [feishuFields, setFeishuFields] = useState<InteropFieldSchema[]>([]);
  const [isTestingNotion, setIsTestingNotion] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);

  const selectedConfig = selectedConfigId ? configs.find(item => item.id === selectedConfigId) : null;
  const direction = editingConfig.direction || 'notion-to-feishu';
  const sourceFields = direction === 'notion-to-feishu' ? notionFields : feishuFields;
  const targetFields = direction === 'notion-to-feishu' ? feishuFields : notionFields;
  const emptyInteropConfig: Partial<InteropConfig> = {
    name: '',
    direction: 'notion-to-feishu',
    notionDatabaseId: '',
    feishuAppToken: '',
    feishuTableId: '',
    feishuTableUrl: '',
    mappings: [],
    limit: 20,
  };

  const loadInteropData = useCallback(async () => {
    setNotionCreds(await getNotionCredentials());
    setConfigs(await getInteropConfigs());
  }, []);

  useEffect(() => {
    loadInteropData();
  }, [loadInteropData]);

  useEffect(() => {
    if (selectedConfig) {
      setEditingConfig(selectedConfig);
    }
  }, [selectedConfig]);

  const parseNotionDatabaseId = (value: string): string => {
    const trimmed = value.trim();
    const uuid = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuid) return uuid[0];
    const compact = trimmed.match(/[0-9a-f]{32}/i);
    if (!compact) return trimmed;
    const id = compact[0];
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  };

  const handleSaveNotion = async () => {
    await saveNotionCredentials(notionCreds);
    setStatus({ success: true, message: 'Notion 连接码已保存。' });
  };

  const handleTestNotion = async () => {
    setIsTestingNotion(true);
    setStatus(null);
    try {
      const success = await testNotionConnection(notionCreds);
      setStatus({
        success,
        message: success ? 'Notion 连接成功，已读取可访问的数据库。' : 'Notion 连接失败，请检查连接码是否复制完整，并确认数据库已添加这个连接。',
      });
      if (success) {
        await saveNotionCredentials(notionCreds);
        setNotionDatabases(await listNotionDatabases());
      }
    } finally {
      setIsTestingNotion(false);
    }
  };

  const handleUseTable = (tableId: string) => {
    const table = tables.find(item => item.id === tableId);
    if (!table) return;
    setEditingConfig({
      ...editingConfig,
      feishuAppToken: table.appToken,
      feishuTableId: table.tableId,
      feishuTableUrl: table.tableUrl,
      name: editingConfig.name || `${table.name} 同步规则`,
    });
  };

  const loadFields = async () => {
    if (!editingConfig.notionDatabaseId || !editingConfig.feishuAppToken || !editingConfig.feishuTableId) return;
    setIsLoadingFields(true);
    setStatus(null);
    try {
      const [nextNotionFields, nextFeishuFields] = await Promise.all([
        getNotionDatabaseSchema(editingConfig.notionDatabaseId),
        getFeishuInteropSchema(editingConfig.feishuAppToken, editingConfig.feishuTableId),
      ]);
      setNotionFields(nextNotionFields);
      setFeishuFields(nextFeishuFields);
      setStatus({
        success: nextNotionFields.length > 0 && nextFeishuFields.length > 0,
        message: `已读到 Notion ${nextNotionFields.length} 列、飞书 ${nextFeishuFields.length} 列。`,
      });
    } finally {
      setIsLoadingFields(false);
    }
  };

  const normalizeFieldName = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, '');

  const handleAutoMap = () => {
    const nextMappings: InteropFieldMapping[] = [];
    for (const sourceField of sourceFields) {
      const targetField = targetFields.find(field => normalizeFieldName(field.name) === normalizeFieldName(sourceField.name));
      if (!targetField) continue;
      nextMappings.push({
        sourceFieldId: sourceField.id,
        sourceFieldName: sourceField.name,
        targetFieldId: targetField.id,
        targetFieldName: targetField.name,
      });
    }
    setEditingConfig({ ...editingConfig, mappings: nextMappings });
  };

  const updateMapping = (index: number, side: 'source' | 'target', fieldId: string) => {
    const field = (side === 'source' ? sourceFields : targetFields).find(item => item.id === fieldId);
    const mappings = [...(editingConfig.mappings || [])];
    const current = mappings[index] || {
      sourceFieldId: '',
      sourceFieldName: '',
      targetFieldId: '',
      targetFieldName: '',
    };
    mappings[index] = side === 'source'
      ? { ...current, sourceFieldId: field?.id || '', sourceFieldName: field?.name || '' }
      : { ...current, targetFieldId: field?.id || '', targetFieldName: field?.name || '' };
    setEditingConfig({ ...editingConfig, mappings });
  };

  const addMapping = () => {
    setEditingConfig({
      ...editingConfig,
      mappings: [
        ...(editingConfig.mappings || []),
        { sourceFieldId: '', sourceFieldName: '', targetFieldId: '', targetFieldName: '' },
      ],
    });
  };

  const removeMapping = (index: number) => {
    setEditingConfig({
      ...editingConfig,
      mappings: (editingConfig.mappings || []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const buildConfig = (): InteropConfig | null => {
    if (!editingConfig.name || !editingConfig.notionDatabaseId || !editingConfig.feishuAppToken || !editingConfig.feishuTableId) return null;
    return {
      id: editingConfig.id || crypto.randomUUID(),
      name: editingConfig.name,
      direction,
      notionDatabaseId: editingConfig.notionDatabaseId,
      feishuAppToken: editingConfig.feishuAppToken,
      feishuTableId: editingConfig.feishuTableId,
      feishuTableUrl: editingConfig.feishuTableUrl || '',
      mappings: (editingConfig.mappings || []).filter(item => item.sourceFieldId && item.targetFieldId),
      limit: Math.max(1, Number(editingConfig.limit) || 20),
      lastSyncAt: editingConfig.lastSyncAt,
      createdAt: editingConfig.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
  };

  const handleSaveConfig = async () => {
    const config = buildConfig();
    if (!config) return;
    await saveInteropConfig(config);
    await loadInteropData();
    setSelectedConfigId(config.id);
    setStatus({ success: true, message: '同步规则已保存。' });
  };

  const handleDeleteConfig = async () => {
    if (!selectedConfig) return;
    if (!confirm('确定要删除这条同步规则吗？')) return;
    await deleteInteropConfig(selectedConfig.id);
    await loadInteropData();
    setSelectedConfigId(null);
    setEditingConfig({
      name: '',
      direction: 'notion-to-feishu',
      notionDatabaseId: '',
      feishuAppToken: '',
      feishuTableId: '',
      feishuTableUrl: '',
      mappings: [],
      limit: 20,
    });
  };

  const handleSync = async () => {
    const config = buildConfig();
    if (!config) return;
    setIsSyncing(true);
    setStatus(null);
    try {
      await saveInteropConfig(config);
      const result = await syncInteropConfig(config);
      await loadInteropData();
      setStatus({
        success: result.success,
        message: `读取 ${result.read} 条，成功同步 ${result.written} 条，失败 ${result.failed} 条${result.errors.length ? `：${result.errors[0]}` : ''}`,
      });
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : '本次同步未完成，请检查 Notion 和飞书是否都已连接。',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="config-section">
      <div className="config-header">
        <div className="config-icon">
          <ArrowLeftRight size={24} />
        </div>
        <div className="config-title-group">
          <h2 className="config-title">Notion 与飞书同步</h2>
          <p className="config-subtitle">在不增加后端服务的情况下，手动连接 Notion 后即可在 Notion 和飞书之间同步资料。</p>
        </div>
      </div>

      {status && (
        <div className={`alert ${status.success ? 'success' : 'error'}`}>
          {status.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="config-card">
        <div className="card-header">
          <KeyRound size={20} />
          <h3>Notion 连接</h3>
        </div>
        <div className="form-group">
          <label className="form-label">Notion 连接码</label>
          <input
            type="password"
            value={notionCreds.integrationToken}
            onChange={(event) => setNotionCreds({ integrationToken: event.target.value })}
            className="form-input"
            placeholder="粘贴 Notion 生成的连接码，例如：secret_xxxxxxxxxxxxxxxxx"
          />
          <p className="form-hint">点击下方按钮会打开 Notion 的连接管理页面。创建内部连接后，复制 secret_ 开头的连接码，并把这个连接添加到目标数据库。</p>
        </div>
        <div className="form-actions">
          <button onClick={openNotionIntegrations} className="btn btn-secondary" type="button">
            <ExternalLink size={16} />
            打开 Notion 获取连接码
          </button>
          <button onClick={handleTestNotion} disabled={isTestingNotion || !notionCreds.integrationToken} className="btn btn-secondary">
            {isTestingNotion ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            检查连接
          </button>
          <button onClick={handleSaveNotion} disabled={!notionCreds.integrationToken} className="btn btn-primary">
            <Save size={16} />
            保存连接码
          </button>
        </div>
      </div>

      <div className="config-card">
        <div className="card-header">
          <ArrowLeftRight size={20} />
          <h3>同步规则</h3>
        </div>

        {configs.length > 0 && (
          <div className="form-group">
            <label className="form-label">已保存规则</label>
            <select
              className="form-select"
              value={selectedConfigId || ''}
              onChange={(event) => {
                const nextId = event.target.value || null;
                setSelectedConfigId(nextId);
                if (!nextId) setEditingConfig(emptyInteropConfig);
              }}
            >
              <option value="">新建同步规则</option>
              {configs.map(config => (
                <option key={config.id} value={config.id}>{config.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-row two-col">
          <div className="form-group">
            <label className="form-label">规则名称</label>
            <input
              className="form-input"
              value={editingConfig.name || ''}
              onChange={(event) => setEditingConfig({ ...editingConfig, name: event.target.value })}
              placeholder="例如：Notion 选题库同步到飞书"
            />
          </div>
          <div className="form-group">
            <label className="form-label">单次同步上限</label>
            <input
              type="number"
              min={1}
              className="form-input"
              value={editingConfig.limit || 20}
              onChange={(event) => setEditingConfig({ ...editingConfig, limit: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="save-mode-grid interop-direction-grid">
          {[
            { value: 'notion-to-feishu', title: 'Notion → 飞书', desc: '将 Notion 数据库中的资料同步到飞书表格。' },
            { value: 'feishu-to-notion', title: '飞书 → Notion', desc: '将飞书表格中的资料同步到 Notion 数据库。' },
          ].map(item => (
            <button
              key={item.value}
              type="button"
              className={`save-mode-card ${direction === item.value ? 'active' : ''}`}
              onClick={() => setEditingConfig({ ...editingConfig, direction: item.value as InteropDirection, mappings: [] })}
            >
              <span className="save-mode-title">{item.title}</span>
              <span className="save-mode-desc">{item.desc}</span>
            </button>
          ))}
        </div>

        <div className="form-row two-col interop-targets">
          <div className="form-group">
            <label className="form-label">Notion 数据库</label>
            <input
              className="form-input"
              value={editingConfig.notionDatabaseId || ''}
              onChange={(event) => setEditingConfig({ ...editingConfig, notionDatabaseId: parseNotionDatabaseId(event.target.value) })}
              placeholder="粘贴 Notion 数据库链接，例如：https://www.notion.so/xxx?v=xxx"
            />
            {notionDatabases.length > 0 && (
              <select
                className="form-select"
                value=""
                onChange={(event) => {
                  const database = notionDatabases.find(item => item.id === event.target.value);
                  if (database) {
                    setEditingConfig({
                      ...editingConfig,
                      notionDatabaseId: database.id,
                      name: editingConfig.name || `${database.title} 同步规则`,
                    });
                  }
                }}
              >
                <option value="">从可访问的 Notion 数据库中选择</option>
                {notionDatabases.map(database => (
                  <option key={database.id} value={database.id}>{database.title}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">飞书表格</label>
            {tables.length > 0 && (
              <select className="form-select" value="" onChange={(event) => handleUseTable(event.target.value)}>
                <option value="">从已连接的飞书资料库中选择</option>
                {tables.map(table => (
                  <option key={table.id} value={table.id}>{table.name}</option>
                ))}
              </select>
            )}
            <input
              className="form-input"
              value={editingConfig.feishuAppToken || ''}
              onChange={(event) => setEditingConfig({ ...editingConfig, feishuAppToken: event.target.value })}
              placeholder="选择飞书资料库后自动填写，例如：Bascn..."
            />
            <input
              className="form-input"
              value={editingConfig.feishuTableId || ''}
              onChange={(event) => setEditingConfig({ ...editingConfig, feishuTableId: event.target.value })}
              placeholder="选择飞书资料库后自动填写，例如：tbl..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={loadFields}
            disabled={isLoadingFields || !editingConfig.notionDatabaseId || !editingConfig.feishuAppToken || !editingConfig.feishuTableId}
            className="btn btn-secondary"
          >
            {isLoadingFields ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            读取两边列名
          </button>
          <button onClick={handleAutoMap} disabled={sourceFields.length === 0 || targetFields.length === 0} className="btn btn-secondary">
            <Sparkles size={16} />
            自动匹配同名列
          </button>
        </div>

        {(sourceFields.length > 0 || targetFields.length > 0) && (
          <div className="field-mapping-section">
            <h3 className="section-title">
              <GripVertical size={16} />
              列对应关系
            </h3>
            <p className="section-desc">
              左侧选择要同步的列，右侧选择同步后放入哪一列。首次建议先同步 10-20 条确认效果。
            </p>
            <div className="interop-mapping-list">
              {(editingConfig.mappings || []).map((mapping, index) => (
                <div key={index} className="interop-mapping-row">
                  <select
                    className="form-select"
                    value={mapping.sourceFieldId}
                    onChange={(event) => updateMapping(index, 'source', event.target.value)}
                  >
                    <option value="">选择来源列</option>
                    {sourceFields.map(field => (
                      <option key={field.id} value={field.id}>{field.name}</option>
                    ))}
                  </select>
                  <ArrowLeftRight size={16} className="interop-row-icon" />
                  <select
                    className="form-select"
                    value={mapping.targetFieldId}
                    onChange={(event) => updateMapping(index, 'target', event.target.value)}
                  >
                    <option value="">选择目标列</option>
                    {targetFields.map(field => (
                      <option key={field.id} value={field.id}>{field.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary interop-remove-btn" onClick={() => removeMapping(index)} title="删除映射">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addMapping} className="btn btn-secondary full-width interop-add-btn">
              <Plus size={16} />
              添加对应关系
            </button>
          </div>
        )}

        <div className="form-actions">
          {selectedConfig && (
            <button onClick={handleDeleteConfig} className="btn btn-danger">
              <Trash2 size={16} />
              删除规则
            </button>
          )}
          <div className="form-actions-spacer" />
          <button onClick={handleSaveConfig} disabled={!buildConfig()} className="btn btn-secondary">
            <Save size={16} />
            保存规则
          </button>
          <button onClick={handleSync} disabled={isSyncing || !buildConfig()} className="btn btn-primary">
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
            开始同步
          </button>
        </div>
      </div>

      <div className="info-card info">
        <h3 className="info-title">
          <Sparkles size={16} />
          使用说明
        </h3>
        <p className="info-text">
          当前版本采用插件本地直连方式，不需要单独部署后端。每次同步都需要手动点击「开始同步」，插件不会自动监听 Notion 或飞书的变化。建议首次同步 10-20 条，确认列对应正确后再增加数量。
        </p>
      </div>
    </div>
  );
}

/**
 * 导入导出视图
 */
function ImportExportView() {
  const [includeSecret, setIncludeSecret] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleExport = async () => {
    const json = await exportConfig(includeSecret);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `save-to-feishu-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = await importConfig(text);
      setImportStatus({
        success,
        message: success ? '导入成功！' : '导入失败，请确认选择的是之前导出的配置文件。',
      });
    } catch {
      setImportStatus({
        success: false,
        message: '导入时出了点问题，请重新选择文件试试。',
      });
    }
    event.target.value = '';
  };

  return (
    <div className="config-section">
      <div className="config-header">
        <div className="config-icon">
          <FileJson size={24} />
        </div>
        <div className="config-title-group">
          <h2 className="config-title">备份与恢复</h2>
          <p className="config-subtitle">换电脑或重装插件前，可以先把当前设置备份出来。</p>
        </div>
      </div>

      <div className="config-grid two-col">
        <div className="config-card">
          <div className="card-header">
            <Download size={20} />
            <h3>备份当前设置</h3>
          </div>
          <div className="card-body">
            <p className="card-desc">把飞书资料库、Notion 同步规则等设置保存成一个文件。</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeSecret}
                onChange={(e) => setIncludeSecret(e.target.checked)}
              />
              <span>把飞书和 Notion 的连接密钥也一起备份</span>
            </label>
            <button onClick={handleExport} className="btn btn-primary full-width">
              <Download size={16} />
              下载备份文件
            </button>
          </div>
        </div>

        <div className="config-card">
          <div className="card-header">
            <Upload size={20} />
            <h3>恢复以前的设置</h3>
          </div>
          <div className="card-body">
            <p className="card-desc">选择之前下载的备份文件，恢复里面保存的设置。</p>
            <div className="file-input-wrapper">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                id="config-import"
                className="file-input"
              />
              <label htmlFor="config-import" className="btn btn-secondary full-width">
                <Upload size={16} />
                选择文件
              </label>
            </div>
          </div>
        </div>
      </div>

      {importStatus && (
        <div className={`alert ${importStatus.success ? 'success' : 'error'}`}>
          {importStatus.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{importStatus.message}</span>
        </div>
      )}

      <div className="info-card warning">
        <h3 className="info-title">
          <AlertTriangle size={16} />
          安全提示
        </h3>
        <p className="info-text">
          如果备份时勾选了连接密钥，这个文件就能访问你的飞书或 Notion。请只保存在自己的设备上。
        </p>
      </div>
    </div>
  );
}

/**
 * 主应用组件
 */
export default function OptionsApp() {
  const getInitialView = (): ViewType => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'interop' ? 'interop' : 'feishu';
  };
  const [activeView, setActiveView] = useState<ViewType>(getInitialView);
  const [feishuCreds, setFeishuCreds] = useState<FeishuCredentials>({ appId: '', appSecret: '' });
  const [saveMode, setSaveModeState] = useState<SaveMode>('feishu');
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const loadData = useCallback(async () => {
    const creds = await getFeishuCredentials();
    setFeishuCreds(creds);
    const mode = await getSaveMode();
    setSaveModeState(mode);
    const tableConfigs = await getTableConfigs();
    setTables(tableConfigs);
  }, []);

  const handleSetSaveMode = async (mode: SaveMode) => {
    setSaveModeState(mode);
    await saveSaveMode(mode);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const nextHash = activeView === 'interop' ? '#interop' : '';
    if (window.location.hash !== nextHash) {
      history.replaceState(null, '', `${window.location.pathname}${nextHash}`);
    }
  }, [activeView]);

  const handleSaveFeishu = async () => {
    await saveFeishuCredentials(feishuCreds);
    setTestResult({ success: true, message: '已保存。' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const success = await testFeishuConnection(feishuCreds);
      setTestResult({
        success,
        message: success ? '飞书可以连接。' : '飞书连接失败，请检查两串钥匙是否复制完整。',
      });
    } catch {
      setTestResult({
        success: false,
        message: '连接测试时出了点问题，请稍后重试。',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="options-container">
      {/* 侧边栏 */}
      <aside className="options-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img
              src="/icons/icon-48.png"
              alt="Save to Feishu"
              className="brand-logo"
              width="32"
              height="32"
            />
            <h1 className="brand-title">Save to Feishu</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">开始使用</span>
            <SidebarItem
              icon={Settings}
              label="连接飞书"
              isActive={activeView === 'feishu'}
              onClick={() => setActiveView('feishu')}
            />
          </div>

          <div className="nav-section">
            <span className="nav-section-title">
              飞书资料库
              <span className="nav-count">{tables.length}</span>
            </span>
            <div className="nav-items">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => {
                    setActiveView('tables');
                    setSelectedTableId(table.id);
                  }}
                  className={`sidebar-item sub-item ${
                    activeView === 'tables' && selectedTableId === table.id ? 'active' : ''
                  }`}
                >
                  <Database size={16} />
                  <span className="sidebar-label truncate">{table.name}</span>
                  <ChevronRight size={14} className="nav-arrow" />
                </button>
              ))}
              <button
                onClick={() => {
                  setActiveView('tables');
                  setSelectedTableId(null);
                }}
                className={`sidebar-item sub-item add-new ${
                  activeView === 'tables' && !selectedTableId ? 'active' : ''
                }`}
              >
                <Plus size={16} />
                <span className="sidebar-label">添加资料库</span>
              </button>
            </div>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">更多工具</span>
            <SidebarItem
              icon={ArrowLeftRight}
              label="Notion 与飞书同步"
              isActive={activeView === 'interop'}
              onClick={() => setActiveView('interop')}
            />
            <SidebarItem
              icon={FileJson}
              label="备份与恢复"
              isActive={activeView === 'importExport'}
              onClick={() => setActiveView('importExport')}
            />
          </div>
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="sidebar-help-btn"
            title="查看帮助文档"
          >
            <HelpCircle size={16} />
            <span>使用帮助</span>
          </button>
          <p>Save to Feishu v0.5.0</p>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="options-main">
        {activeView === 'feishu' && (
          <FeishuConfigView
            creds={feishuCreds}
            setCreds={setFeishuCreds}
            onSave={handleSaveFeishu}
            onTest={handleTestConnection}
            isTesting={isTesting}
            testResult={testResult}
            saveMode={saveMode}
            setSaveMode={handleSetSaveMode}
          />
        )}

        {activeView === 'tables' && (
          <TableConfigView
            tables={tables}
            selectedTableId={selectedTableId}
            setSelectedTableId={setSelectedTableId}
            onRefresh={loadData}
          />
        )}

        {activeView === 'interop' && <NotionInteropView tables={tables} />}

        {activeView === 'importExport' && <ImportExportView />}
      </main>

      {/* 帮助弹窗 */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
