import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterZoteroItemsOutsideCollections,
  uniqueZoteroItems,
  zoteroItemImportIdentity,
} from '../src/features/literature/zoteroImport.ts';
import type { ZoteroLibraryItem } from '../src/types/reader.ts';

function zoteroItem(overrides: Partial<ZoteroLibraryItem>): ZoteroLibraryItem {
  return {
    itemKey: 'ITEM',
    title: 'Untitled',
    creators: '',
    year: '',
    itemType: 'journalArticle',
    ...overrides,
  };
}

test('zotero import identity prefers attachment keys over parent item keys', () => {
  const item = zoteroItem({
    itemKey: 'PARENT',
    attachmentKey: 'ATTACHMENT',
    localPdfPath: 'D:/papers/a.pdf',
  });

  assert.equal(zoteroItemImportIdentity(item), 'ATTACHMENT');
});

test('uniqueZoteroItems keeps separate PDF attachments under the same Zotero item', () => {
  const items = [
    zoteroItem({ itemKey: 'PARENT', attachmentKey: 'PDF_A' }),
    zoteroItem({ itemKey: 'PARENT', attachmentKey: 'PDF_B' }),
    zoteroItem({ itemKey: 'PARENT', attachmentKey: 'PDF_A' }),
  ];

  assert.deepEqual(
    uniqueZoteroItems(items).map((item) => item.attachmentKey),
    ['PDF_A', 'PDF_B'],
  );
});

test('filterZoteroItemsOutsideCollections returns only PDFs not present in any collection', () => {
  const allItems = [
    zoteroItem({ itemKey: 'A', attachmentKey: 'PDF_A' }),
    zoteroItem({ itemKey: 'B', attachmentKey: 'PDF_B' }),
    zoteroItem({ itemKey: 'C', attachmentKey: 'PDF_C' }),
  ];
  const collectionItems = [
    zoteroItem({ itemKey: 'A', attachmentKey: 'PDF_A' }),
    zoteroItem({ itemKey: 'C', attachmentKey: 'PDF_C' }),
  ];

  assert.deepEqual(
    filterZoteroItemsOutsideCollections(allItems, collectionItems).map((item) => item.attachmentKey),
    ['PDF_B'],
  );
});
