import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendUniqueChatAttachments,
  getChatAttachmentKey,
} from '../src/features/reader/documentReaderAttachments.ts';
import type { DocumentChatAttachment } from '../src/types/reader.ts';

function attachment(overrides: Partial<DocumentChatAttachment> = {}): DocumentChatAttachment {
  return {
    id: overrides.id ?? 'attachment-1',
    kind: overrides.kind ?? 'file',
    name: overrides.name ?? 'paper.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    size: overrides.size ?? 100,
    ...overrides,
  };
}

test('getChatAttachmentKey prefers file path and includes size', () => {
  assert.equal(
    getChatAttachmentKey(attachment({ name: 'a.pdf', filePath: 'D:/papers/a.pdf', size: 10 })),
    'D:/papers/a.pdf:10',
  );
  assert.equal(getChatAttachmentKey(attachment({ name: 'a.pdf', size: 20 })), 'a.pdf:20');
});

test('appendUniqueChatAttachments skips existing and same-batch duplicates', () => {
  const existing = attachment({ id: 'existing', filePath: 'D:/papers/a.pdf', size: 10 });
  const unique = attachment({ id: 'unique', filePath: 'D:/papers/b.pdf', size: 10 });
  const next = appendUniqueChatAttachments(
    [existing],
    [
      attachment({ id: 'duplicate-existing', filePath: 'D:/papers/a.pdf', size: 10 }),
      unique,
      attachment({ id: 'duplicate-next', filePath: 'D:/papers/b.pdf', size: 10 }),
    ],
  );

  assert.deepEqual(next.map((item) => item.id), ['existing', 'unique']);
});

test('appendUniqueChatAttachments preserves the original array when nothing is added', () => {
  const existing = [attachment({ id: 'existing', filePath: 'D:/papers/a.pdf', size: 10 })];
  const next = appendUniqueChatAttachments(
    existing,
    [attachment({ id: 'duplicate-existing', filePath: 'D:/papers/a.pdf', size: 10 })],
  );

  assert.equal(next, existing);
});
