import { useCallback, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import type { LiteratureTag } from '../../../types/library';

interface TagPickerDialogProps {
  open: boolean;
  paperTitle: string;
  paperTags: LiteratureTag[];
  allTags: LiteratureTag[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (tagNames: string[]) => void;
}

export default function TagPickerDialog({
  open,
  paperTitle,
  paperTags,
  allTags,
  busy = false,
  onClose,
  onSubmit,
}: TagPickerDialogProps) {
  const l = useLocaleText();
  const [newTagName, setNewTagName] = useState('');

  const existingTagIds = useMemo(
    () => new Set(paperTags.map((t) => t.id)),
    [paperTags],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const availableTags = useMemo(
    () => allTags.filter((t) => !existingTagIds.has(t.id)),
    [allTags, existingTagIds],
  );

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const names: string[] = [];
    for (const id of selectedIds) {
      const tag = allTags.find((t) => t.id === id);
      if (tag) names.push(tag.name);
    }
    const typedName = newTagName.trim();
    if (typedName) {
      const existingMatch = allTags.find((t) => t.name.trim() === typedName);
      if (existingMatch) {
        names.push(existingMatch.name);
      } else {
        names.push(typedName);
      }
    }
    if (names.length > 0) {
      onSubmit(names);
      setSelectedIds(new Set());
      setNewTagName('');
    }
  }, [selectedIds, newTagName, allTags, onSubmit]);

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    setNewTagName('');
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm dark:bg-black/56">
      <div className="flex max-h-[min(520px,calc(100vh-32px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--pq-radius-lg)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)] text-[var(--pq-text)] shadow-[var(--pq-shadow-dialog)]">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pq-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{l('添加标签', 'Add Tags')}</h2>
            <p className="mt-1 truncate text-sm text-[var(--pq-text-muted)]">{paperTitle}</p>
          </div>
          <button type="button" onClick={handleClose} disabled={busy} className="pq-icon-button h-8 w-8 shrink-0 disabled:opacity-60">
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTagName.trim()) handleSubmit(); }}
              placeholder={l('新建标签...', 'New tag...')}
              className="pq-input h-9 flex-1 px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (newTagName.trim()) handleSubmit();
              }}
              disabled={!newTagName.trim() || busy}
              className="pq-icon-button h-9 w-9 shrink-0 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>

          {availableTags.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--pq-text-faint)]">
                {l('已有标签', 'Existing Tags')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const isSelected = selectedIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggle(tag.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isSelected
                          ? 'border-[var(--pq-accent)] bg-[var(--pq-accent-soft)] text-[var(--pq-accent)]'
                          : 'border-[var(--pq-border)] bg-[var(--pq-surface-2)] text-[var(--pq-text-muted)] hover:border-[var(--pq-border-strong)]'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableTags.length === 0 && !newTagName.trim() && (
            <p className="py-4 text-center text-sm text-[var(--pq-text-faint)]">
              {l('所有标签已添加到此文献', 'All tags are already added to this paper')}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--pq-border)] px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="pq-button px-4 py-2 text-sm disabled:opacity-60"
          >
            {l('取消', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || (selectedIds.size === 0 && !newTagName.trim())}
            className="pq-button-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {l('添加', 'Add')}
          </button>
        </footer>
      </div>
    </div>
  );
}
