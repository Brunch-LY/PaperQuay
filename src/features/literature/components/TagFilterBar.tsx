import { ArrowDown, ArrowUp, ChevronDown, FolderSearch, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import type { LiteratureTag } from '../../../types/library';

interface TagFilterBarProps {
  tags: (LiteratureTag & { paperCount?: number })[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onOpenManager: () => void;
  onBatchModeToggle?: () => void;
  onScanPapers?: () => void;
  sortBy: string;
  sortBy2: string;
  sortDir: string;
  sortDir2: string;
  onSortChange: (sortBy: string) => void;
  onSort2Change: (sortBy2: string) => void;
  onSortDirChange: () => void;
  onSortDir2Change: () => void;
}

export default function TagFilterBar({
  tags, selectedTagId, onSelectTag, onOpenManager, onBatchModeToggle, onScanPapers,
  sortBy, sortBy2, sortDir, sortDir2, onSortChange, onSort2Change, onSortDirChange, onSortDir2Change,
}: TagFilterBarProps) {
  const l = useLocaleText();
  const [tagMenuOpen, setTagMenuOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--pq-border)] px-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pq-text-faint)]">
        {l('标签', 'Tags')}
      </span>

      <button type="button" onClick={() => onSelectTag(null)}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
          selectedTagId === null ? 'bg-[var(--pq-accent)] text-white' : 'bg-[var(--pq-surface-2)] text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-3)]'
        }`}>
        {l('全部', 'All')}
      </button>

      {tags.slice(0, 5).map((tag) => (
        <button key={tag.id} type="button" onClick={() => onSelectTag(tag.id)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
            selectedTagId === tag.id ? 'bg-[var(--pq-accent)] text-white' : 'bg-[var(--pq-surface-2)] text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-3)]'
          }`}>
          {tag.name}
          {tag.paperCount != null && <span className="ml-1 opacity-60">{tag.paperCount}</span>}
        </button>
      ))}

      {tags.length > 5 && (
        <div className="relative">
          <button type="button" onClick={() => setTagMenuOpen(!tagMenuOpen)}
            className="rounded-full bg-[var(--pq-surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-3)] flex items-center gap-0.5">
            +{tags.length - 5}
            <ChevronDown className="h-3 w-3" strokeWidth={2} />
          </button>
          {tagMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-40 overflow-y-auto rounded-xl border border-[var(--pq-border)] bg-[var(--pq-surface-1)] p-1.5 shadow-lg">
              <div className="fixed inset-0 z-[-1]" onClick={() => setTagMenuOpen(false)} />
              {tags.slice(5).map((tag) => (
                <button key={tag.id} type="button" onClick={() => { onSelectTag(tag.id); setTagMenuOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition ${
                    selectedTagId === tag.id ? 'bg-[var(--pq-accent-soft)] text-[var(--pq-accent)]' : 'text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-2)]'
                  }`}>
                  <span>{tag.name}</span>
                  {tag.paperCount != null && <span className="ml-2 opacity-50">{tag.paperCount}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={onOpenManager} className="pq-icon-button h-6 w-6" title={l('管理标签', 'Manage Tags')}>
        <Settings2 className="h-3.5 w-3.5" strokeWidth={1.9} />
      </button>

      <span className="mx-1 h-4 w-px bg-[var(--pq-border)]" />

      <span className="text-xs font-medium text-[var(--pq-text-faint)]">{l('排序', 'Sort')}</span>
      <select value={sortBy} onChange={(e) => { onSortChange(e.target.value); if (e.target.value === 'manual') onSort2Change('title'); }}
        className="pq-input h-6 w-20 px-1.5 text-xs">
        <option value="manual">{l('手动', 'M.')}</option>
        <option value="title">{l('标题', 'Title')}</option>
        <option value="year">{l('年份', 'Year')}</option>
        <option value="author">{l('作者', 'Auth')}</option>
        <option value="importedAt">{l('导入', 'Imp.')}</option>
      </select>
      <button type="button" onClick={onSortDirChange} className="pq-icon-button h-5 w-5"
        title={sortDir === 'asc' ? l('升序', 'Asc') : l('降序', 'Desc')}>
        {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" strokeWidth={2} /> : <ArrowDown className="h-3 w-3" strokeWidth={2} />}
      </button>

      {sortBy !== 'manual' && (<>
        <span className="text-[10px] text-[var(--pq-text-faint)]">{l('再按', '/')}</span>
        <select value={sortBy2} onChange={(e) => onSort2Change(e.target.value)}
          className="pq-input h-6 w-20 px-1.5 text-xs">
          <option value="title">{l('标题', 'Tit.')}</option>
          <option value="year">{l('年份', 'Yr.')}</option>
          <option value="author">{l('作者', 'Au.')}</option>
          <option value="importedAt">{l('导入', 'Im.')}</option>
        </select>
        <button type="button" onClick={onSortDir2Change} className="pq-icon-button h-5 w-5"
          title={sortDir2 === 'asc' ? l('升序', 'Asc') : l('降序', 'Desc')}>
          {sortDir2 === 'asc' ? <ArrowUp className="h-3 w-3" strokeWidth={2} /> : <ArrowDown className="h-3 w-3" strokeWidth={2} />}
        </button>
      </>)}

      <span className="flex-1" />

      {onScanPapers && (
        <button type="button" onClick={onScanPapers}
          className="pq-button flex items-center gap-1 px-2 py-1 text-xs text-[var(--pq-text-muted)]">
          <FolderSearch className="h-3.5 w-3.5" strokeWidth={1.9} />
          {l('扫描', 'Scan')}
        </button>
      )}

      {onBatchModeToggle && (
        <button type="button" onClick={onBatchModeToggle}
          className="pq-button flex items-center gap-1 px-2 py-1 text-xs text-[var(--pq-text-muted)]">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
          {l('批量处理', 'Batch')}
        </button>
      )}
    </div>
  );
}
