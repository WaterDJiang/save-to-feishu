import { AlertCircle, ArrowRight, CheckCircle, Database, Download, Loader2 } from 'lucide-react';
import type { SaveResult } from '@/types';
import './MarkdownFirstSaveCard.css';

interface MarkdownFirstSaveCardProps {
  surface: 'sidepanel' | 'popup';
  isSaving: boolean;
  result: SaveResult | null;
  onSave: () => void;
  onSaveToFeishu: () => void;
}

/**
 * 未连接资料库时的首次剪藏入口。
 * 侧栏和弹窗共用并列的飞书与 Markdown 入口，避免用户误以为只能选择其中一种。
 */
export function MarkdownFirstSaveCard({
  surface,
  isSaving,
  result,
  onSave,
  onSaveToFeishu,
}: MarkdownFirstSaveCardProps) {
  return (
    <section className={`markdown-first-save-card markdown-first-save-card--${surface}`} aria-label="选择保存方式">
      <div className="markdown-first-save-card__eyebrow">FIRST CLIP · 01</div>
      <div className="markdown-first-save-card__heading">
        <span className="markdown-first-save-card__icon" aria-hidden="true">
          <Download size={18} />
        </span>
        <div>
          <h2>选择这次怎么保存</h2>
          <p>飞书和 Markdown 都可以：连接飞书后团队可协作；也可立即下载本地笔记。</p>
        </div>
      </div>

      <div className="markdown-first-save-card__choices" aria-label="保存方式">
        <button className="markdown-first-save-card__choice" onClick={onSaveToFeishu} type="button">
          <span className="markdown-first-save-card__choice-icon markdown-first-save-card__choice-icon--feishu" aria-hidden="true">
            <Database size={17} />
          </span>
          <span className="markdown-first-save-card__choice-copy">
            <strong>保存到飞书</strong>
            <small>先完成连接与资料库设置</small>
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
        <button className="markdown-first-save-card__choice" onClick={onSave} disabled={isSaving} type="button">
          <span className="markdown-first-save-card__choice-icon markdown-first-save-card__choice-icon--markdown" aria-hidden="true">
            {isSaving ? <Loader2 className="markdown-first-save-card__spin" size={17} /> : <Download size={17} />}
          </span>
          <span className="markdown-first-save-card__choice-copy">
            <strong>{isSaving ? '正在保存 Markdown…' : '保存 Markdown 到电脑'}</strong>
            <small>无需配置，立即下载 .md 文件</small>
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>

      {result && (
        <div className={`markdown-first-save-card__result ${result.success ? 'is-success' : 'is-error'}`} role="status" aria-live="polite">
          {result.success ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{result.success ? 'Markdown 已下载。' : result.error || '保存失败，请重试。'}</span>
        </div>
      )}

    </section>
  );
}
