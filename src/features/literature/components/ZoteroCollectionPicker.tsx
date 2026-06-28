import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, X } from 'lucide-react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import type { ZoteroCollection } from '../../../types/reader';

interface ZoteroCollectionPickerProps {
  open: boolean;
  collections: ZoteroCollection[];
  selectedKeys: Set<string>;
  busy?: boolean;
  importWithFolders: boolean;
  onToggle: (collectionKey: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onImportModeChange: (withFolders: boolean) => void;
}

interface TreeItem {
  id: string;
  label: string;
  parentId: string | null;
  count?: number;
}

function buildTree(items: TreeItem[]) {
  const childrenMap = new Map<string | null, TreeItem[]>();
  for (const item of items) {
    const parentKey = item.parentId ?? '__root__';
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(item);
  }
  return childrenMap;
}

function Branch({
  id, label, count, depth, selectedKeys, childrenMap, onToggle,
}: {
  id: string; label: string; count?: number; depth: number;
  selectedKeys: Set<string>;
  childrenMap: Map<string | null, TreeItem[]>;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childrenMap.get(id) ?? [];
  const hasChildren = children.length > 0;
  const checked = selectedKeys.has(id);
  const allDescendantIds = (rootId: string): string[] => {
    const ids: string[] = [];
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      ids.push(cur);
      for (const c of childrenMap.get(cur) ?? []) queue.push(c.id);
    }
    return ids;
  };
  const someChecked = hasChildren && allDescendantIds(id).some((did) => selectedKeys.has(did));

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
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex h-4 w-4 items-center justify-center"
          >
            <ChevronRight className={`h-3.5 w-3.5 text-[var(--pq-text-faint)] transition-transform ${expanded ? 'rotate-90' : ''}`} strokeWidth={2} />
          </button>
        ) : <div className="w-4" />}
        <div className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition ${checked ? 'border-[var(--pq-accent)] bg-[var(--pq-accent)]' : someChecked ? 'border-[var(--pq-accent)] bg-[var(--pq-accent)]/20' : 'border-[var(--pq-border)]'}`}>
          {(checked || someChecked) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </div>
        <span className="flex-1 truncate text-[var(--pq-text)]">{label}</span>
        {count != null && <span className="text-xs text-[var(--pq-text-faint)]">{count}</span>}
      </button>
      {hasChildren && expanded && children.map((child) => (
        <Branch key={child.id} id={child.id} label={child.label} count={child.count} depth={depth + 1} selectedKeys={selectedKeys} childrenMap={childrenMap} onToggle={onToggle} />
      ))}
    </div>
  );
}

export default function ZoteroCollectionPicker({
  open, collections, selectedKeys, busy = false, importWithFolders,
  onToggle, onClose, onConfirm, onImportModeChange,
}: ZoteroCollectionPickerProps) {
  const l = useLocaleText();

  const treeItems: TreeItem[] = useMemo(() => {
    if (collections.length === 0) return [];
    const allItem: TreeItem = { id: '__all__', label: l('全部', 'All Collections'), parentId: null, count: collections.reduce((sum, c) => sum + c.itemCount, 0) };
    return [allItem, ...collections.map((c) => ({ id: c.collectionKey, label: c.name, parentId: c.parentCollectionKey ?? '__all__', count: c.itemCount }))];
  }, [collections, l]);

  const childrenMap = useMemo(() => buildTree(treeItems), [treeItems]);
  const rootItems = childrenMap.get('__root__') ?? [];
  const totalSelected = collections.filter((c) => selectedKeys.has(c.collectionKey)).length;
  const totalItems = collections.reduce((sum, c) => sum + (selectedKeys.has(c.collectionKey) ? c.itemCount : 0), 0);

  const getAllDescendantIds = useCallback((rootId: string): string[] => {
    const ids: string[] = [];
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const c of collections) {
        const parent = c.parentCollectionKey ?? '__all__';
        if (parent === cur && !ids.includes(c.collectionKey)) {
          ids.push(c.collectionKey);
          queue.push(c.collectionKey);
        }
      }
    }
    return ids;
  }, [collections]);

  const handleToggle = (id: string) => {
    if (id === '__all__') {
      const allSelected = selectedKeys.size >= collections.length;
      for (const c of collections) {
        if (allSelected && selectedKeys.has(c.collectionKey)) onToggle(c.collectionKey);
        else if (!allSelected && !selectedKeys.has(c.collectionKey)) onToggle(c.collectionKey);
      }
      return;
    }

    const isCurrentlySelected = selectedKeys.has(id);
    if (isCurrentlySelected) {
      const descendants = getAllDescendantIds(id);
      onToggle(id);
      for (const did of descendants) {
        if (selectedKeys.has(did)) onToggle(did);
      }
    } else {
      onToggle(id);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm dark:bg-black/56">
      <div className="flex max-h-[min(640px,calc(100vh-32px))] w-[min(480px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--pq-radius-lg)] border border-[var(--pq-border)] bg-[var(--pq-surface-1)] text-[var(--pq-text)] shadow-[var(--pq-shadow-dialog)]">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pq-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{l('选择要导入的 Zotero 分类', 'Select Zotero Collections')}</h2>
            <p className="mt-1 text-sm text-[var(--pq-text-muted)]">{l(`共 ${collections.length} 个分类，已选 ${totalSelected} 个（${totalItems} 篇）`, `${collections.length} collections, ${totalSelected} selected (${totalItems} papers)`)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="pq-icon-button h-8 w-8 shrink-0 disabled:opacity-60">
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
          {rootItems.map((item) => (
            <Branch key={item.id} id={item.id} label={item.label} count={item.count} depth={0} selectedKeys={selectedKeys} childrenMap={childrenMap} onToggle={handleToggle} />
          ))}
        </div>

        <footer className="flex flex-col gap-3 border-t border-[var(--pq-border)] px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={importWithFolders}
              onChange={(e) => onImportModeChange(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--pq-border)] text-[var(--pq-accent)]"
            />
            <span className="text-[var(--pq-text)]">{l('导入到对应分类', 'Import into matching categories')}</span>
            <span className="text-xs text-[var(--pq-text-faint)]">{l('（取消勾选则所有 PDF 导入到当前分类）', '(uncheck to import all PDFs into the current category)')}</span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="pq-button px-4 py-2 text-sm disabled:opacity-60">
              {l('取消', 'Cancel')}
            </button>
            <button type="button" onClick={onConfirm} disabled={busy || selectedKeys.size === 0} className="pq-button-primary px-4 py-2 text-sm disabled:opacity-60">
              {l('开始导入', 'Start Import')}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
