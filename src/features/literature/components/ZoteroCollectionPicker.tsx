import { useMemo } from 'react';
import { useLocaleText } from '../../../i18n/uiLanguage';
import type { ZoteroCollection } from '../../../types/reader';
import CheckableListDialog, { type CheckableTreeItem } from './CheckableListDialog';

interface ZoteroCollectionPickerProps {
  open: boolean;
  collections: ZoteroCollection[];
  selectedKeys: Set<string>;
  busy?: boolean;
  onToggle: (collectionKey: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ZoteroCollectionPicker({
  open,
  collections,
  selectedKeys,
  busy = false,
  onToggle,
  onClose,
  onConfirm,
}: ZoteroCollectionPickerProps) {
  const l = useLocaleText();

  const treeItems: CheckableTreeItem[] = useMemo(() => {
    if (collections.length === 0) return [];

    const allItem: CheckableTreeItem = {
      id: '__all__',
      label: l('全部', 'All Collections'),
      parentId: null,
      count: collections.reduce((sum, c) => sum + c.itemCount, 0),
    };

    const collectionItems: CheckableTreeItem[] = collections.map((c) => ({
      id: c.collectionKey,
      label: c.name,
      parentId: c.parentCollectionKey ?? '__all__',
      count: c.itemCount,
    }));

    return [allItem, ...collectionItems];
  }, [collections, l]);

  const handleToggle = (id: string) => {
    if (id === '__all__') {
      const allSelected = selectedKeys.size >= collections.length;
      for (const c of collections) {
        if (allSelected && selectedKeys.has(c.collectionKey)) {
          onToggle(c.collectionKey);
        } else if (!allSelected && !selectedKeys.has(c.collectionKey)) {
          onToggle(c.collectionKey);
        }
      }
      return;
    }
    onToggle(id);
  };

  const totalSelected = collections.filter((c) => selectedKeys.has(c.collectionKey)).length;
  const totalItems = collections.reduce((sum, c) => sum + (selectedKeys.has(c.collectionKey) ? c.itemCount : 0), 0);

  return (
    <CheckableListDialog
      open={open}
      title={l('选择要导入的 Zotero 分类', 'Select Zotero Collections to Import')}
      description={l(
        `共 ${collections.length} 个分类，已选 ${totalSelected} 个（${totalItems} 篇文献）`,
        `${collections.length} collections, ${totalSelected} selected (${totalItems} papers)`,
      )}
      items={treeItems}
      selectedIds={selectedKeys}
      mode="tree"
      busy={busy}
      confirmLabel={l('开始导入', 'Start Import')}
      onToggle={handleToggle}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
