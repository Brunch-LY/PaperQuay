import { useCallback, useMemo, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';

export interface CheckableTreeItem {
  id: string;
  label: string;
  parentId: string | null;
  count?: number;
}

interface CheckableListDialogProps {
  open: boolean;
  title: string;
  description?: string;
  items: CheckableTreeItem[];
  selectedIds: Set<string>;
  mode: 'tree' | 'flat';
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function buildTree(items: CheckableTreeItem[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const childrenMap = new Map<string | null, CheckableTreeItem[]>();

  for (const item of items) {
    const parentKey = item.parentId ?? '__root__';
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(item);
  }

  const allDescendantIds = (rootId: string): string[] => {
    const ids: string[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      ids.push(current);
      const children = childrenMap.get(current) ?? [];
      for (const child of children) {
        queue.push(child.id);
      }
    }
    return ids;
  };

  return { itemMap, childrenMap, allDescendantIds };
}

function TreeItem({
  id,
  label,
  count,
  depth,
  selectedIds,
  expandedIds,
  childrenMap,
  allDescendantIds,
  onToggle,
  onToggleExpand,
}: {
  id: string;
  label: string;
  count?: number;
  depth: number;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  childrenMap: Map<string | null, CheckableTreeItem[]>;
  allDescendantIds: (rootId: string) => string[];
  onToggle: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const children = childrenMap.get(id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(id);
  const isChecked = selectedIds.has(id);

  const descendantIds = useMemo(() => allDescendantIds(id), [id]);
  const someChildrenChecked = hasChildren && descendantIds.some((did) => selectedIds.has(did));

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--pq-surface-2)]"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(id); }}
            className="flex h-4 w-4 items-center justify-center"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 text-[var(--pq-text-faint)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              strokeWidth={2}
            />
          </button>
        ) : (
          <div className="w-4" />
        )}

        <div
          className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition ${
            isChecked
              ? 'border-[var(--pq-accent)] bg-[var(--pq-accent)]'
              : someChildrenChecked
                ? 'border-[var(--pq-accent)] bg-[var(--pq-accent)]/20'
                : 'border-[var(--pq-border)]'
          }`}
        >
          {(isChecked || someChildrenChecked) && (
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          )}
        </div>

        <span className="flex-1 truncate text-[var(--pq-text)]">{label}</span>

        {count != null && (
          <span className="text-xs text-[var(--pq-text-faint)]">{count}</span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child.id}
              id={child.id}
              label={child.label}
              count={child.count}
              depth={depth + 1}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              childrenMap={childrenMap}
              allDescendantIds={allDescendantIds}
              onToggle={onToggle}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheckableListDialog({
  open,
  title,
  description,
  items,
  selectedIds,
  mode,
  confirmLabel,
  cancelLabel,
  busy = false,
  onToggle,
  onClose,
  onConfirm,
}: CheckableListDialogProps) {
  const l = useLocaleText();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { childrenMap, allDescendantIds } = useMemo(() => buildTree(items), [items]);

  if (!open) return null;

  const rootItems = childrenMap.get('__root__') ?? [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm dark:bg-black/56">
      <div className="flex max-h-[min(640px,calc(100vh-32px))] w-[min(480px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--pq-radius-lg)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)] text-[var(--pq-text)] shadow-[var(--pq-shadow-dialog)]">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pq-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--pq-text)]">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-5 text-[var(--pq-text-muted)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="pq-icon-button h-8 w-8 shrink-0 disabled:opacity-60"
          >
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
          {mode === 'tree' ? (
            rootItems.map((item) => (
              <TreeItem
                key={item.id}
                id={item.id}
                label={item.label}
                count={item.count}
                depth={0}
                selectedIds={selectedIds}
                expandedIds={expandedIds}
                childrenMap={childrenMap}
                allDescendantIds={allDescendantIds}
                onToggle={onToggle}
                onToggleExpand={handleToggleExpand}
              />
            ))
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--pq-surface-2)]"
                >
                  <div
                    className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition ${
                      selectedIds.has(item.id)
                        ? 'border-[var(--pq-accent)] bg-[var(--pq-accent)]'
                        : 'border-[var(--pq-border)]'
                    }`}
                  >
                    {selectedIds.has(item.id) && (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span className="flex-1 truncate text-[var(--pq-text)]">{item.label}</span>
                  {item.count != null && (
                    <span className="text-xs text-[var(--pq-text-faint)]">{item.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--pq-border)] px-5 py-3">
          <span className="text-xs text-[var(--pq-text-faint)]">
            {l(
              `已选 ${selectedIds.size} 项`,
              `${selectedIds.size} selected`,
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="pq-button px-4 py-2 text-sm disabled:opacity-60"
            >
              {cancelLabel ?? l('取消', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || selectedIds.size === 0}
              className="pq-button-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {confirmLabel ?? l('确认', 'Confirm')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
