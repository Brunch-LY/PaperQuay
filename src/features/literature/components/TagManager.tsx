import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Edit3,
  Merge,
  Palette,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import { batchDeleteTags, batchRenameTag, listAllTags } from '../../../services/library';
import type { LiteratureTag } from '../../../types/library';

const TAG_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#6b7280',
  '#f43f5e',
  '#14b8a6',
  '#eab308',
  '#6366f1',
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);

  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setAllTags(tags);
      setSelectedIds(new Set());
      setMergeTargetId(null);
      setColorPickerId(null);
      void listAllTags().then(setAllTags).catch(() => {});
    }
  }, [open, tags]);

  const tagNameMap = useMemo(() => new Map(allTags.map((t) => [t.id, t.name])), [allTags]);

  const handleCreateTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name) return;

    const usedColors = new Set(allTags.map((t) => t.color).filter(Boolean));
    const nextColor = TAG_COLORS.find((c) => !usedColors.has(c)) ?? TAG_COLORS[0];

    setAllTags((prev) => [...prev, { id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, color: nextColor }]);
    setNewTagName('');
    onTagsChange();
  }, [newTagName, allTags, onTagsChange]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      await batchDeleteTags(Array.from(selectedIds));
      setAllTags((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      onTagsChange();
    } finally {
      setBusy(false);
    }
  }, [selectedIds, onTagsChange]);

  const handleMergeTag = useCallback(async () => {
    if (!mergeTargetId || selectedIds.size === 0) return;
    setBusy(true);
    try {
      const targetName = tagNameMap.get(mergeTargetId) || '';
      for (const id of selectedIds) {
        if (id === mergeTargetId) {
          await batchRenameTag(id, targetName);
        } else {
          const sourceName = tagNameMap.get(id) || '';
          const newName = `${sourceName} → ${targetName}`;
          await batchRenameTag(id, newName);
        }
      }
      setAllTags((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      setMergeTargetId(null);
      onTagsChange();
    } finally {
      setBusy(false);
    }
  }, [mergeTargetId, selectedIds, tagNameMap, onTagsChange]);

  const handleSaveEdit = useCallback(async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await batchRenameTag(id, name);
      setAllTags((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
      setEditingId(null);
      onTagsChange();
    } finally {
      setBusy(false);
    }
  }, [editingName, onTagsChange]);

  const handleColorChange = useCallback((id: string, color: string) => {
    setAllTags((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)));
    void batchRenameTag(id, tagNameMap.get(id) || '', color);
    onTagsChange();
  }, [tagNameMap, onTagsChange]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm dark:bg-black/56">
      <div className="flex max-h-[min(640px,calc(100vh-32px))] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--pq-radius-lg)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)] text-[var(--pq-text)] shadow-[var(--pq-shadow-dialog)]">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pq-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{l('标签管理', 'Tag Manager')}</h2>
            <p className="mt-1 text-sm text-[var(--pq-text-muted)]">
              {l(`共 ${allTags.length} 个标签`, `${allTags.length} tags total`)}{selectedIds.size > 0 && l(`，已选 ${selectedIds.size} 个`, `, ${selectedIds.size} selected`)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="pq-icon-button h-8 w-8 shrink-0">
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </header>

        {hasSelection && (
          <div className="flex items-center gap-2 border-b border-[var(--pq-border)] px-4 py-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={busy}
              className="pq-button flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--pq-danger)] disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
              {l(`删除 ${selectedIds.size} 个`, `Delete ${selectedIds.size}`)}
            </button>

            {mergeTargetId ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--pq-text-muted)]">{l('合并到:', 'Merge into:')}</span>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="pq-input h-7 max-w-[180px] px-2 text-xs"
                >
                  {allTags.filter((t) => selectedIds.has(t.id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleMergeTag}
                  disabled={busy}
                  className="pq-button flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  <Merge className="h-3.5 w-3.5" strokeWidth={1.9} />
                  {l('合并', 'Merge')}
                </button>
                <button type="button" onClick={() => setMergeTargetId(null)} className="text-[var(--pq-text-faint)] hover:text-[var(--pq-text)]">
                  <X className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { const first = Array.from(selectedIds)[0]; setMergeTargetId(first); }}
                disabled={selectedIds.size < 2}
                className="pq-button flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60"
              >
                <Merge className="h-3.5 w-3.5" strokeWidth={1.9} />
                {l('合并选中标签', 'Merge selected')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-[var(--pq-text-faint)] hover:text-[var(--pq-text)]"
            >
              {l('取消选择', 'Clear selection')}
            </button>
          </div>
        )}

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
              disabled={!newTagName.trim() || busy}
              className="pq-icon-button h-9 w-9 shrink-0 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>

          <div className="space-y-1">
            {allTags.map((tag) => {
              const isSelected = selectedIds.has(tag.id);
              return (
                <div
                  key={tag.id}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                    isSelected ? 'bg-[var(--pq-accent-soft)]' : 'hover:bg-[var(--pq-surface-2)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(tag.id)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
                      isSelected ? 'border-[var(--pq-accent)] bg-[var(--pq-accent)]' : 'border-[var(--pq-border)]'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </button>

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setColorPickerId(colorPickerId === tag.id ? null : tag.id)}
                      className="h-4 w-4 rounded-full border border-[var(--pq-border)]"
                      style={{ backgroundColor: tag.color ?? '#6b7280' }}
                    />
                    {colorPickerId === tag.id && (
                      <div
                        ref={colorPickerRef}
                        className="absolute left-0 top-5 z-50 flex gap-1 rounded-lg border border-[var(--pq-border)] bg-[var(--pq-surface-1)] p-1.5 shadow-lg"
                      >
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { handleColorChange(tag.id, c); setColorPickerId(null); }}
                            className={`h-4 w-4 rounded-full border-2 transition hover:scale-110 ${
                              tag.color === c ? 'border-[var(--pq-accent)]' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
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
                      onDoubleClick={() => { setEditingId(tag.id); setEditingName(tag.name); }}
                      title={l('双击编辑', 'Double-click to edit')}
                    >
                      {tag.name}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }}
                    className="pq-icon-button h-7 w-7 opacity-0 group-hover:opacity-100"
                    title={l('重命名', 'Rename')}
                  >
                    <Edit3 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedIds(new Set([tag.id])); handleDeleteSelected(); }}
                    className="pq-icon-button h-7 w-7 text-[var(--pq-text-faint)] hover:text-[var(--pq-danger)]"
                    title={l('删除', 'Delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
