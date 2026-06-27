import test from 'node:test';
import assert from 'node:assert/strict';

import { isMineruCacheManifest } from '../src/features/reader/documentReaderManifest.ts';

test('isMineruCacheManifest accepts values with required manifest fields', () => {
  assert.equal(
    isMineruCacheManifest({
      version: 1,
      documentKey: 'paper-1',
      title: 'Paper',
      pdfPath: 'D:/papers/paper.pdf',
      savedAt: new Date(0).toISOString(),
      sourceKind: 'manual-json',
    }),
    true,
  );
});

test('isMineruCacheManifest rejects incomplete or non-object values', () => {
  assert.equal(isMineruCacheManifest(null), false);
  assert.equal(isMineruCacheManifest({ documentKey: 'paper-1' }), false);
  assert.equal(isMineruCacheManifest({ pdfPath: 'D:/papers/paper.pdf' }), false);
  assert.equal(isMineruCacheManifest({ documentKey: 1, pdfPath: 'D:/papers/paper.pdf' }), false);
});
