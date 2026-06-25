import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  CheckCircle,
  ChevronRight,
  Clock,
  Database,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { ExtensionUpdateNotice, SavedContentRecord } from '@/types';
import { getSourceHostname } from '@/utils/knowledgeMetadata';
import {
  getDueReviewRecords,
  getLocalDateKey,
  getRecentSavedContentRecords,
  getRelativeLocalDateKey,
  isSavedContentReviewDue,
} from '@/utils/savedContent';

type LibraryView = 'due' | 'recent';

export function PanelStateMessage({
  state,
  message,
  onRetry,
}: {
  state: 'loading' | 'error';
  message?: string;
  onRetry?: () => void;
}) {
  if (state === 'loading') {
    return (
      <main className="sp-empty">
        <Loader2 className="sp-spin" size={28} />
        <span>{message || '正在读取当前网页...'}</span>
      </main>
    );
  }

  return (
    <main className="sp-empty">
      <AlertCircle size={28} />
      <strong>无法读取当前网页</strong>
      <p>{message}</p>
      {onRetry && <button className="sp-secondary-btn" onClick={onRetry}>重试</button>}
    </main>
  );
}

function formatReviewAt(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
}

export function SavedContentLibrary({
  records,
  onBack,
  onOpenOriginal,
  onOpenTarget,
  onReviewAtChange,
  formatSavedAt,
}: {
  records: SavedContentRecord[];
  onBack: () => void;
  onOpenOriginal: (record: SavedContentRecord) => void;
  onOpenTarget: (record: SavedContentRecord) => void;
  onReviewAtChange: (record: SavedContentRecord, reviewAt?: string) => void;
  formatSavedAt: (value: string) => string;
}) {
  const [view, setView] = useState<LibraryView>('due');
  const dueRecords = useMemo(() => getDueReviewRecords(records), [records]);
  const recentRecords = useMemo(() => getRecentSavedContentRecords(records), [records]);
  const visibleRecords = view === 'due' ? dueRecords : recentRecords;

  return (
    <main className="sp-main">
      <section className="sp-section sp-library-section">
        <div className="sp-library-heading">
          <div>
            <div className="sp-section-title">
              <History size={16} />
              <span>知识回访中心</span>
            </div>
            <p>重新打开最近保存的资料，或处理已经到期的回顾任务。</p>
          </div>
          <button className="sp-mini-text-btn" onClick={onBack} type="button">
            返回剪藏
          </button>
        </div>

        <div className="sp-library-tabs" role="tablist" aria-label="保存记录视角">
          <button
            className={view === 'due' ? 'is-active' : ''}
            onClick={() => setView('due')}
            role="tab"
            aria-selected={view === 'due'}
            type="button"
          >
            <CalendarDays size={14} />
            <span>待回顾</span>
            <strong>{dueRecords.length}</strong>
          </button>
          <button
            className={view === 'recent' ? 'is-active' : ''}
            onClick={() => setView('recent')}
            role="tab"
            aria-selected={view === 'recent'}
            type="button"
          >
            <History size={14} />
            <span>最近保存</span>
            <strong>{recentRecords.length}</strong>
          </button>
        </div>

        {visibleRecords.length > 0 ? (
          <div className="sp-library-list">
            {visibleRecords.map(record => (
              <article className="sp-library-item" key={record.key}>
                <button
                  className="sp-library-main"
                  onClick={() => onOpenOriginal(record)}
                  type="button"
                  title="打开原网页"
                >
                  <span className="sp-library-icon">
                    {record.reviewAt ? <CalendarDays size={15} /> : <FileText size={15} />}
                  </span>
                  <span className="sp-library-copy">
                    <strong>{record.title}</strong>
                    <small>
                      {record.reviewAt
                        ? `${formatReviewAt(record.reviewAt)}回顾 · ${record.targetName}`
                        : `${formatSavedAt(record.savedAt)} · ${record.targetName}`}
                    </small>
                    <span>
                      {record.status && <em>{record.status}</em>}
                      <em>{getSourceHostname(record.url)}</em>
                    </span>
                  </span>
                </button>
                <div className="sp-library-actions">
                  {(record.documentUrl || record.tableUrl) && (
                    <button
                      className="sp-library-target"
                      onClick={() => onOpenTarget(record)}
                      title={record.documentUrl ? '打开飞书文档' : '打开飞书资料库'}
                      aria-label={record.documentUrl ? '打开飞书文档' : '打开飞书资料库'}
                      type="button"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  {view === 'due' ? (
                    <button
                      className="sp-library-review-action is-remove"
                      onClick={() => onReviewAtChange(record, undefined)}
                      title="移出待回顾，不删除最近保存记录"
                      aria-label={`将 ${record.title} 移出待回顾`}
                      type="button"
                    >
                      <Trash2 size={14} />
                      <span>移出</span>
                    </button>
                  ) : !isSavedContentReviewDue(record) ? (
                    <button
                      className="sp-library-review-action"
                      onClick={() => onReviewAtChange(record, getLocalDateKey())}
                      title="加入待回顾"
                      aria-label={`将 ${record.title} 加入待回顾`}
                      type="button"
                    >
                      <CalendarPlus size={14} />
                      <span>待回顾</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="sp-library-empty">
            <CalendarDays size={24} />
            <strong>{view === 'due' ? '暂时没有待回顾内容' : '还没有保存记录'}</strong>
            <p>
              {view === 'due'
                ? '保存网页时设置“下次回顾”，到期后会出现在这里。'
                : '成功保存到飞书或 Markdown 后，最近记录会出现在这里。'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export function ReviewScheduleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="sp-review-schedule">
      <div className="sp-review-schedule-heading">
        <CalendarDays size={16} />
        <span>
          <strong>下次回顾</strong>
          <small>到期后会出现在“待回顾”中。</small>
        </span>
      </div>
      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label="下次回顾日期"
      />
      <div className="sp-review-quick-actions" aria-label="快捷设置回顾日期">
        <button onClick={() => onChange(getLocalDateKey())} type="button">今天</button>
        <button onClick={() => onChange(getRelativeLocalDateKey(1))} type="button">明天</button>
        <button onClick={() => onChange(getRelativeLocalDateKey(7))} type="button">7 天后</button>
        {value && <button className="is-clear" onClick={() => onChange('')} type="button">清除</button>}
      </div>
    </div>
  );
}

export function RatingInvitationCard({
  visible,
  successfulSaveCount,
  onRate,
  onDismiss,
}: {
  visible: boolean;
  successfulSaveCount: number;
  onRate: () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  return (
    <section className="sp-rating-card" aria-label="评价插件">
      <span className="sp-rating-icon" aria-hidden="true">
        <Star size={18} />
      </span>
      <span className="sp-rating-copy">
        <strong>已经成功保存 {successfulSaveCount} 次</strong>
        <small>如果插件对你有帮助，欢迎去 Chrome 商店留下评价。</small>
      </span>
      <div className="sp-rating-actions">
        <button className="sp-rating-primary" onClick={onRate} type="button">
          去评分
        </button>
        <button className="sp-rating-secondary" onClick={onDismiss} type="button">
          暂不评价
        </button>
      </div>
    </section>
  );
}

export function ExtensionUpdateCard({
  notice,
  onDismissNotice,
  onOpenLibrary,
  onOpenTemplates,
}: {
  notice: ExtensionUpdateNotice | null;
  onDismissNotice: () => void;
  onOpenLibrary: () => void;
  onOpenTemplates: () => void;
}) {
  if (notice) {
    return (
      <section className="sp-update-section sp-version-update" aria-label="插件更新提醒">
        <div className="sp-update-head">
          <span className="sp-update-badge">v{notice.version}</span>
          <span className="sp-update-title">
            <strong>{notice.title}</strong>
            <small>
              {notice.previousVersion
                ? `从 v${notice.previousVersion} 更新`
                : '已安装最新版本'}
            </small>
          </span>
          <button
            className="sp-update-close"
            onClick={onDismissNotice}
            type="button"
            title="知道了"
            aria-label="关闭更新提醒"
          >
            <X size={14} />
          </button>
        </div>
        <div className="sp-update-items">
          {notice.highlights.slice(0, 2).map((highlight, index) => (
            <div className="sp-update-item is-release" key={highlight}>
              <span className="sp-update-icon">
                {index === 0 ? <CheckCircle size={15} /> : <Clock size={15} />}
              </span>
              <span className="sp-update-copy">
                <strong>{highlight}</strong>
                <small>{index === 0 ? '两个入口同时展示，可按当前需要选择' : '无需连接飞书，也可直接下载 .md 文件'}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="sp-update-section" aria-label="本次更新">
      <div className="sp-update-head">
        <span className="sp-update-badge">NEW</span>
        <span className="sp-update-title">
          <strong>0.5.8 高质量摘录</strong>
          <small>选中文本后右键保存到飞书或 Markdown</small>
        </span>
      </div>
      <div className="sp-update-items">
        <button className="sp-update-item is-action" onClick={onOpenLibrary} type="button">
          <span className="sp-update-icon">
            <History size={15} />
          </span>
          <span className="sp-update-copy">
            <strong>右键保存摘录</strong>
            <small>阅读时直接保存观点、案例、数据和金句</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <button className="sp-update-item is-action" onClick={onOpenTemplates} type="button">
          <span className="sp-update-icon">
            <Database size={15} />
          </span>
          <span className="sp-update-copy">
            <strong>摘录字段可映射</strong>
            <small>将摘录类型和正文写入飞书资料库</small>
          </span>
          <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}
