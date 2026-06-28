import { Settings2, Trash2 } from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import type { LiteratureTag } from '../../../types/library';

interface TagFilterBarProps {
  tags: LiteratureTag[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onOpenManager: () => void;
  onBatchModeToggle?: () => void;
}

export default function TagFilterBar({
  tags,
  selectedTagId,
  onSelectTag,
  onOpenManager,
  onBatchModeToggle,
}: TagFilterBarProps) {
  const l = useLocaleText();

  return (
    <div className="flex items-center gap-1.5 px-4 py-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--pq-text-faint)]">
        {l('标签', 'Tags')}
      </span>

      <button
        type="button"
        onClick={() => onSelectTag(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          selectedTagId === null
            ? 'bg-[var(--pq-accent)] text-white'
            : 'bg-[var(--pq-surface-2)] text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-3)]'
        }`}
      >
        {l('全部', 'All')}
      </button>

      {tags.slice(0, 8).map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => onSelectTag(tag.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selectedTagId === tag.id
              ? 'bg-[var(--pq-accent)] text-white'
              : 'bg-[var(--pq-surface-2)] text-[var(--pq-text-muted)] hover:bg-[var(--pq-surface-3)]'
          }`}
        >
          {tag.name}
        </button>
      ))}

      {tags.length > 8 && (
        <span className="text-xs text-[var(--pq-text-faint)]">+{tags.length - 8}</span>
      )}

      <button
        type="button"
        onClick={onOpenManager}
        className="pq-icon-button h-7 w-7"
        title={l('管理标签', 'Manage Tags')}
      >
        <Settings2 className="h-3.5 w-3.5" strokeWidth={1.9} />
      </button>

      <span className="ml-auto" />

      {onBatchModeToggle && (
        <button
          type="button"
          onClick={onBatchModeToggle}
          className="pq-button flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--pq-text-muted)]"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
          {l('批量删除', 'Batch Delete')}
        </button>
      )}
    </div>
  );
}
