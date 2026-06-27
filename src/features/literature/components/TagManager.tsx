import { useCallback, useEffect, useState } from 'react';
import { Check, Edit3, Plus, Trash2, X } from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import { listAllTags } from '../../../services/library';
import type { LiteratureTag } from '../../../types/library';

const TAG_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6b7280', // gray
  '#f43f5e', // rose
  '#14b8a6', // teal
  '#eab308', // yellow
  '#6366f1', // indigo
];

interface TagManagerProps {
  open: boolean;
  tags: LiteratureTag[];
  onClose: () => void;
  onTagsChange: () => void;
}

export default function TagManager({ open, tags, onClose, onTagsChange }: TagManagerProps) {
  const l = useLocaleText();
  const [allTags, setAllTags] = useState<LiteratureTag[]>(tags);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    if (open) {
      setAllTags(tags);
      void listAllTags().then(setAllTags).catch(() => {});
    }
  }, [open, tags]);

  const handleCreateTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name) return;

    const usedColors = new Set(allTags.map((t) => t.color).filter(Boolean));
    const nextColor = TAG_COLORS.find((c) => !usedColors.has(c)) ?? TAG_COLORS[0];

    const newTag: LiteratureTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      color: nextColor,
    };

    setAllTags((prev) => [...prev, newTag]);
    setNewTagName('');
    onTagsChange();
  }, [newTagName, allTags, onTagsChange]);

  const handleDeleteTag = useCallback((id: string) => {
    setAllTags((prev) => prev.filter((t) => t.id !== id));
    onTagsChange();
  }, [onTagsChange]);

  const handleStartEdit = useCallback((tag: LiteratureTag) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    setAllTags((prev) => prev.map((t) => (t.id === id ? { ...t, name: editingName.trim() || t.name } : t)));
    setEditingId(null);
    onTagsChange();
  }, [editingName, onTagsChange]);

  const handleColorChange = useCallback((id: string, color: string) => {
    setAllTags((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)));
    onTagsChange();
  }, [onTagsChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm dark:bg-black/56">
      <div className="flex max-h-[min(640px,calc(100vh-32px))] w-[min(460px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--pq-radius-lg)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)] text-[var(--pq-text)] shadow-[var(--pq-shadow-dialog)]">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pq-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{l('标签管理', 'Tag Manager')}</h2>
            <p className="mt-1 text-sm text-[var(--pq-text-muted)]">
              {l(`共 ${allTags.length} 个标签`, `${allTags.length} tags total`)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="pq-icon-button h-8 w-8 shrink-0">
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
          <div className="mb-3 flex items-center gap-2 px-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); }}
              placeholder={l('新建标签...', 'New tag...')}
              className="pq-input h-9 flex-1 px-3 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="pq-icon-button h-9 w-9 shrink-0 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>

          <div className="space-y-1">
            {allTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[var(--pq-surface-2)]"
              >
                <div className="relative">
                  <div
                    className="h-4 w-4 rounded-full border border-[var(--pq-border)]"
                    style={{ backgroundColor: tag.color ?? '#6b7280' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="flex gap-0.5">
                      {TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleColorChange(tag.id, c)}
                          className="h-3 w-3 rounded-full border border-white"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {editingId === tag.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(tag.id); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={() => handleSaveEdit(tag.id)}
                    className="pq-input h-7 flex-1 px-2 text-sm"
                    autoFocus
                  />
                ) : (
                  <span
                    className="flex-1 cursor-pointer truncate text-sm"
                    onDoubleClick={() => handleStartEdit(tag)}
                    title={l('双击编辑', 'Double-click to edit')}
                  >
                    {tag.name}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleStartEdit(tag)}
                  className="pq-icon-button h-7 w-7 opacity-0 transition group-hover:opacity-100 hover:opacity-100"
                >
                  <Edit3 className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag.id)}
                  className="pq-icon-button h-7 w-7 text-[var(--pq-text-faint)] hover:text-[var(--pq-danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
