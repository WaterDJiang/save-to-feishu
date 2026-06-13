import { CheckCircle, Copy, Share2, Upload, XCircle } from 'lucide-react';

interface TemplateShareStatus {
  success: boolean;
  message: string;
}

export function TemplateSharingPanel({
  code,
  status,
  onCodeChange,
  onCopy,
  onImport,
}: {
  code: string;
  status: TemplateShareStatus | null;
  onCodeChange: (value: string) => void;
  onCopy: () => void;
  onImport: () => void;
}) {
  return (
    <div className="template-share-section">
      <h3 className="section-title">
        <Share2 size={16} />
        分享资料库模板
      </h3>
      <p className="section-desc">
        只分享列名、映射方式和整理字段，不包含飞书表格地址、编号、App Secret、API Key 或已保存内容。
      </p>
      <textarea
        className="form-input template-share-code"
        value={code}
        onChange={event => onCodeChange(event.target.value)}
        placeholder="点击“复制当前模板”生成代码，或把同事发来的共享模板代码粘贴到这里。"
        rows={4}
      />
      {status && (
        <div className={`test-result ${status.success ? 'success' : 'error'}`}>
          {status.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{status.message}</span>
        </div>
      )}
      <div className="form-actions template-share-actions">
        <button className="btn btn-secondary" onClick={onCopy} type="button">
          <Copy size={16} />
          复制当前模板
        </button>
        <button className="btn btn-primary" onClick={onImport} disabled={!code.trim()} type="button">
          <Upload size={16} />
          导入共享模板
        </button>
      </div>
    </div>
  );
}
