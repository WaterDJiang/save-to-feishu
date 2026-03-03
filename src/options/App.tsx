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
} from 'lucide-react';
import type { FeishuCredentials, TableConfig, FeishuField, TableFieldMapping } from '@/types';
import {
  getFeishuCredentials,
  saveFeishuCredentials,
  getTableConfigs,
  saveTableConfig,
  deleteTableConfig,
  exportConfig,
  importConfig,
} from '@/services/storageService';
import {
  testFeishuConnection,
  getTableFields,
} from '@/services/feishuService';
import { HelpModal } from '@/components/HelpModal';
import { FieldHelp } from '@/components/FieldHelp';

type ViewType = 'feishu' | 'tables' | 'importExport';

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
}: {
  creds: FeishuCredentials;
  setCreds: (c: FeishuCredentials) => void;
  onSave: () => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: { success: boolean; message: string } | null;
}) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="config-section">
      <div className="config-header">
        <div className="config-icon">
          <Settings size={24} />
        </div>
        <div className="config-title-group">
          <h2 className="config-title">飞书应用凭证</h2>
          <p className="config-subtitle">配置飞书开放平台的企业自建应用凭证</p>
        </div>
      </div>

      <div className="config-card">
        <div className="form-group">
          <label className="form-label form-label-with-help">
            <ExternalLink size={14} />
            App ID
            <FieldHelp fieldKey="appId" />
          </label>
          <input
            type="text"
            value={creds.appId}
            onChange={(e) => setCreds({ ...creds, appId: e.target.value })}
            className="form-input"
            placeholder="cli_xxxxxxxxxxxxxxxx"
          />
          <p className="form-hint">飞书开放平台应用的 App ID（格式：cli_xxxxxxxxxxxxxxxx）</p>
        </div>

        <div className="form-group">
          <label className="form-label form-label-with-help">
            <Shield size={14} />
            App Secret
            <FieldHelp fieldKey="appSecret" />
          </label>
          <div className="input-with-action">
            <input
              type={showSecret ? 'text' : 'password'}
              value={creds.appSecret}
              onChange={(e) => setCreds({ ...creds, appSecret: e.target.value })}
              className="form-input"
              placeholder="请输入 App Secret"
            />
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="input-action-btn"
              title={showSecret ? '隐藏' : '显示'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="form-hint">应用的 App Secret，用于生成访问令牌，请勿泄露</p>
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
            测试连接
          </button>
          <button
            onClick={onSave}
            disabled={!creds.appId}
            className="btn btn-primary"
          >
            <Save size={16} />
            保存配置
          </button>
        </div>
      </div>

      <div className="info-card info">
        <h3 className="info-title">
          <Sparkles size={16} />
          如何获取应用凭证？
        </h3>
        <ol className="info-list">
          <li>访问 <a href="https://open.feishu.cn" target="_blank" rel="noopener noreferrer" className="info-link">飞书开放平台</a></li>
          <li>创建「企业自建应用」</li>
          <li>进入应用 →「凭证与基础信息」获取 App ID 和 App Secret</li>
          <li>进入「权限管理」，开通「多维表格」相关权限</li>
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

  const sourceTypeOptions = [
    { value: '', label: '-- 不保存此字段 --' },
    { value: 'url', label: '🔗 页面网址', desc: '网页链接地址' },
    { value: 'title', label: '📝 文章标题', desc: '网页标题' },
    { value: 'content', label: '📄 正文内容', desc: '网页正文摘要' },
    { value: 'image', label: '🖼️ 封面图片', desc: '网页首图URL' },
    { value: 'saveTime', label: '🕐 保存时间', desc: '自动记录当前时间' },
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
            {isNewTable ? '添加多维表格' : '表格配置'}
          </h2>
          <p className="config-subtitle">
            {isNewTable ? '配置要保存数据的目标表格' : `当前表格：${existingTable.name}`}
          </p>
        </div>
      </div>

      <div className="config-card">
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">表格名称</label>
            <input
              type="text"
              value={editingTable.name}
              onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
              className="form-input"
              placeholder="例如：我的收藏、待读文章"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label form-label-with-help">
              多维表格链接
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
                placeholder="粘贴飞书多维表格链接，如：https://xxx.feishu.cn/base/xxx?table=xxx"
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
              <span className="form-hint form-hint-error">链接格式不正确，请检查链接是否完整</span>
            )}
            {editingTable.appToken && editingTable.tableId && (
              <span className="form-hint form-hint-success">✓ 已自动识别 Token 和表 ID</span>
            )}
          </div>
        </div>

        <div className="form-row two-col">
          <div className="form-group">
            <label className="form-label form-label-with-help">
              表格链接 Token
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
              数据表 ID
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
          获取表格字段
        </button>

        {availableFields.length > 0 && (
          <div className="field-mapping-section">
            <h3 className="section-title">
              <GripVertical size={16} />
              字段对应关系
              <FieldHelp fieldKey="fieldMapping" />
            </h3>
            <p className="section-desc">选择网页内容保存到哪个表格字段（如：标题→标题列，网址→链接列）</p>

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
                          placeholder="输入要保存的固定内容"
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
          重要提醒：表格权限设置
        </h3>
        <ol className="info-list">
          <li>在飞书多维表格中，点击右上角「···」→「设置」</li>
          <li>进入「权限」设置，添加你的应用为协作者</li>
          <li>权限级别必须设置为「可编辑」，否则无法保存数据</li>
          <li>如果表格在企业空间，可能需要管理员审批权限申请</li>
        </ol>
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
        message: success ? '配置导入成功！' : '导入失败，请检查文件格式',
      });
    } catch {
      setImportStatus({
        success: false,
        message: '导入过程中发生错误',
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
          <h2 className="config-title">导入/导出配置</h2>
          <p className="config-subtitle">备份或迁移您的插件配置</p>
        </div>
      </div>

      <div className="config-grid two-col">
        <div className="config-card">
          <div className="card-header">
            <Download size={20} />
            <h3>导出配置</h3>
          </div>
          <div className="card-body">
            <p className="card-desc">将当前所有配置导出为 JSON 文件，便于备份或迁移。</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeSecret}
                onChange={(e) => setIncludeSecret(e.target.checked)}
              />
              <span>包含敏感信息 (App Secret)</span>
            </label>
            <button onClick={handleExport} className="btn btn-primary full-width">
              <Download size={16} />
              导出配置
            </button>
          </div>
        </div>

        <div className="config-card">
          <div className="card-header">
            <Upload size={20} />
            <h3>导入配置</h3>
          </div>
          <div className="card-body">
            <p className="card-desc">从 JSON 文件导入配置，将覆盖现有配置。</p>
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
          导出的配置文件可能包含敏感信息，请妥善保管。建议仅在可信设备之间传输配置文件。
        </p>
      </div>
    </div>
  );
}

/**
 * 主应用组件
 */
export default function OptionsApp() {
  const [activeView, setActiveView] = useState<ViewType>('feishu');
  const [feishuCreds, setFeishuCreds] = useState<FeishuCredentials>({ appId: '', appSecret: '' });
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const loadData = useCallback(async () => {
    const creds = await getFeishuCredentials();
    setFeishuCreds(creds);
    const tableConfigs = await getTableConfigs();
    setTables(tableConfigs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveFeishu = async () => {
    await saveFeishuCredentials(feishuCreds);
    setTestResult({ success: true, message: '配置已保存' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const success = await testFeishuConnection(feishuCreds);
      setTestResult({
        success,
        message: success ? '连接成功！' : '连接失败，请检查 App ID 和 Secret 是否正确',
      });
    } catch {
      setTestResult({
        success: false,
        message: '测试过程中发生错误',
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
            <span className="nav-section-title">基础配置</span>
            <SidebarItem
              icon={Settings}
              label="飞书应用"
              isActive={activeView === 'feishu'}
              onClick={() => setActiveView('feishu')}
            />
          </div>

          <div className="nav-section">
            <span className="nav-section-title">
              表格配置
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
                <span className="sidebar-label">添加表格</span>
              </button>
            </div>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">数据管理</span>
            <SidebarItem
              icon={FileJson}
              label="导入/导出"
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
          <p>Save to Feishu v0.1.1</p>
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

        {activeView === 'importExport' && <ImportExportView />}
      </main>

      {/* 帮助弹窗 */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
