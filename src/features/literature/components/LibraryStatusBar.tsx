import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ScanSearch, Trash2, X } from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import { batchDeletePapers, findDuplicatePapers } from '../../../services/library';
import type { LiteraturePaper } from '../../../types/library';
import type { LiteraturePaperListStatus } from './LiteraturePaperList';

interface LibraryStatusBarProps {
  papers: LiteraturePaper[];
  pdfExistsMap?: Record<string, boolean>;
  paperStatuses?: Record<string, LiteraturePaperListStatus>;
  onFilterByStatus?: (filter: null | 'no-pdf' | 'no-mineru' | 'no-overview' | 'duplicates') => void;
  onRefresh?: () => void;
}

export default function LibraryStatusBar({ papers, pdfExistsMap, paperStatuses, onFilterByStatus, onRefresh }: LibraryStatusBarProps) {
  const l = useLocaleText();
  const [expanded, setExpanded] = useState(false);
  const [dupInfo, setDupInfo] = useState<{ totalDuplicates: number; groups: { type: string; value?: string; entries: { id: string; title: string; norm?: string; authors: string; year: string; doi: string }[] }[] } | null>(null);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const pdfOkCount = useMemo(() => {
    if (pdfExistsMap) return papers.filter((p) => pdfExistsMap[p.id]).length;
    return papers.filter((p) => p.attachments.some((a) => a.kind === 'pdf')).length;
  }, [papers, pdfExistsMap]);

  const mineruParsedCount = useMemo(() => {
    if (!paperStatuses) return 0;
    return papers.filter((p) => paperStatuses[p.id]?.mineruParsed).length;
  }, [papers, paperStatuses]);

  const overviewGeneratedCount = useMemo(() => {
    return papers.filter((p) => p.aiSummary?.trim()).length;
  }, [papers]);

  useEffect(() => {
    findDuplicatePapers().then(setDupInfo).catch(() => {});
  }, [papers]);

  const dupCount = dupInfo?.totalDuplicates ?? 0;

  return (
    <div className="border-b border-[var(--pq-border)]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-1)]"
      >
        {expanded ? <ChevronDown className="h-3 w-3" strokeWidth={2} /> : <ChevronRight className="h-3 w-3" strokeWidth={2} />}
        {l('文献概览', 'Library Overview')}
        {dupCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[var(--pq-danger)]">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} />
            {l(`${dupCount} 篇可能重复`, `${dupCount} possible duplicates`)}
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
          <FilterBadge label={l('PDF', 'PDF')} count={pdfOkCount} total={papers.length} color="border-emerald-300/55 bg-emerald-50 text-emerald-700" />
          <FilterBadge label={l('缺 PDF', 'No PDF')} count={papers.length - pdfOkCount} total={papers.length} color="border-amber-300/55 bg-amber-50 text-amber-700" onClick={() => onFilterByStatus?.('no-pdf')} />
          <FilterBadge label={l('已解析', 'Parsed')} count={mineruParsedCount} total={papers.length} color="border-emerald-300/55 bg-emerald-50 text-emerald-700" />
          <FilterBadge label={l('未解析', 'Not Parsed')} count={papers.length - mineruParsedCount} total={papers.length} color="border-amber-300/55 bg-amber-50 text-amber-700" onClick={() => onFilterByStatus?.('no-mineru')} />
          <FilterBadge label={l('有AI概览', 'Has AI Overview')} count={overviewGeneratedCount} total={papers.length} color="border-emerald-300/55 bg-emerald-50 text-emerald-700" />
          <FilterBadge label={l('无AI概览', 'No AI Overview')} count={papers.length - overviewGeneratedCount} total={papers.length} color="border-amber-300/55 bg-amber-50 text-amber-700" onClick={() => onFilterByStatus?.('no-overview')} />
          <button
            type="button"
            onClick={() => setDupDialogOpen(true)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80 ${
              dupCount > 0 ? 'border-rose-300/55 bg-rose-50 text-rose-700' : 'border-emerald-300/55 bg-emerald-50 text-emerald-700'
            }`}
          >
            <ScanSearch className="h-3 w-3" strokeWidth={2} />
            {dupCount > 0 ? l(`重复 ${dupCount}`, `${dupCount} dupes`) : l('无重复', 'No dupes')}
          </button>
          <button type="button" onClick={() => onFilterByStatus?.(null)} className="text-xs text-[var(--pq-text-faint)] hover:underline">
            {l('清除筛选', 'Clear filter')}
          </button>
        </div>
      )}

      {dupDialogOpen && dupInfo && (
        <DuplicateDialog
          groups={dupInfo.groups}
          onClose={() => setDupDialogOpen(false)}
          onRefresh={onRefresh}
          l={l}
        />
      )}
    </div>
  );
}

function FilterBadge({ label, count, total, color, onClick }: { label: string; count: number; total: number; color: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80 ${color}`}>
        {label} <span className="font-semibold">{count}/{total}</span>
      </button>
    );
  }
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium opacity-70 ${color}`}>
      {label} <span className="font-semibold">{count}/{total}</span>
    </span>
  );
}

function DuplicateDialog({
  groups,
  onClose,
  onRefresh,
  l,
}: {
  groups: { type: string; value?: string; entries: { id: string; title: string; norm?: string; authors: string; year: string; doi: string }[] }[];
  onClose: () => void;
  onRefresh?: () => void;
  l: (zh: string, en: string) => string;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteGroup = async (entries: { id: string; title: string }[]) => {
    if (entries.length < 2) return;
    const toDelete = entries.slice(1);
    const kept = entries[0];
    if (!window.confirm(l(`保留第一篇，删除其余 ${toDelete.length} 篇？\n保留：${kept.title}`, `Keep the first, delete ${toDelete.length} duplicates?\nKeep: ${kept.title}`))) return;
    setDeleting(true);
    try {
      await batchDeletePapers(toDelete.map((e) => e.id), true);
      if (onRefresh) onRefresh();
      onClose();
    } catch {
      alert(l('删除失败', 'Delete failed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm dark:bg-black/56" onClick={onClose}>
      <div className="flex max-h-[min(640px,calc(100vh-32px))] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--pq-radius-lg)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)] text-[var(--pq-text)] shadow-[var(--pq-shadow-dialog)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--pq-border)] px-5 py-4">
          <h2 className="text-base font-semibold">{l('可能重复的文献', 'Possible Duplicates')}</h2>
          <button type="button" onClick={onClose} className="pq-icon-button h-7 w-7">
            <X className="h-3.5 w-3.5" strokeWidth={1.9} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          {groups.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--pq-text-faint)]">{l('未发现重复', 'No duplicates found')}</p>
          ) : (
            <div className="space-y-3">
              {groups.map((g, i) => (
                <div key={i} className="rounded-lg border border-[var(--pq-border)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--pq-text-faint)]">
                      {g.type === 'doi' ? l('DOI 匹配', 'DOI Match') : g.type === 'title' ? l('标题匹配', 'Title Match') : l('文件哈希匹配', 'Hash Match')}
                      {g.value && <span className="ml-2 font-mono text-[10px] opacity-60">{g.value}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteGroup(g.entries)}
                      disabled={deleting}
                      className="pq-button px-2 py-1 text-[11px] text-[var(--pq-danger)] disabled:opacity-60"
                    >
                      {l('保留第1篇删除其余', 'Dedup')}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {g.entries.map((entry, j) => (
                      <div key={entry.id} className="rounded bg-[var(--pq-surface-2)] px-2.5 py-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--pq-text)]">
                            {entry.title || '(无标题)'}
                          </span>
                          <span className="shrink-0 text-xs text-[var(--pq-text-faint)]">#{j + 1}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--pq-text-muted)]">
                          {entry.authors && <span>{entry.authors}</span>}
                          {entry.year && <span>{entry.year}</span>}
                          {entry.doi && <span className="font-mono text-[10px]">{entry.doi}</span>}
                          {entry.norm && <span className="font-mono text-[9px] text-[var(--pq-text-faint)]">归一化: {entry.norm}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
