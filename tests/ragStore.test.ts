import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createRagStore } = require('../electron/backend/ragStore.cjs');

function createStore() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'paperquay-rag-test-'));
  const store = createRagStore({
    ragDatabasePath: path.join(dataDir, 'paperquay-rag.sqlite'),
  });

  return { dataDir, store };
}

test('RAG store appends chunk batches and retrieves inside the requested document', () => {
  const { dataDir, store } = createStore();

  try {
    store.indexDocument({
      documentKey: 'doc-a',
      title: 'Document A',
      sourceType: 'pdf-text',
      sourceSignature: 'sig-a',
      embeddingModelKey: 'embedding-test',
      totalChunkCount: 2,
      chunks: [{
        chunkId: 'a-1',
        chunkIndex: 0,
        pageIndex: 0,
        blockId: null,
        text: 'distant document chunk',
        embedding: [0.1, 0.1, 0.1, 0.1],
      }],
    });

    assert.equal(
      store.getDocumentIndexStatus({ documentKey: 'doc-a', sourceType: 'pdf-text' }).status,
      'pending',
    );

    store.indexDocument({
      documentKey: 'doc-a',
      title: 'Document A',
      sourceType: 'pdf-text',
      sourceSignature: 'sig-a',
      embeddingModelKey: 'embedding-test',
      totalChunkCount: 2,
      chunks: [{
        chunkId: 'a-2',
        chunkIndex: 1,
        pageIndex: 1,
        blockId: 'block-a-2',
        text: 'nearest document chunk',
        embedding: [0.8, 0.8, 0.8, 0.8],
      }],
    });

    store.indexDocument({
      documentKey: 'doc-b',
      title: 'Document B',
      sourceType: 'pdf-text',
      sourceSignature: 'sig-b',
      embeddingModelKey: 'embedding-test',
      totalChunkCount: 1,
      chunks: [{
        chunkId: 'b-1',
        chunkIndex: 0,
        pageIndex: 0,
        text: 'wrong document chunk',
        embedding: [0.79, 0.79, 0.79, 0.79],
      }],
    });

    const status = store.getDocumentIndexStatus({ documentKey: 'doc-a', sourceType: 'pdf-text' });
    assert.equal(status.status, 'ready');
    assert.equal(status.indexedChunkCount, 2);

    const results = store.retrieveDocumentChunks({
      documentKey: 'doc-a',
      sourceType: 'pdf-text',
      queryEmbedding: [0.78, 0.78, 0.78, 0.78],
      topK: 3,
    });

    assert.equal(results.length, 2);
    assert.equal(results[0].chunkId, 'a-2');
    assert.equal(results[0].sourceType, 'pdf-text');
    assert.equal(results[0].blockId, 'block-a-2');
    assert.ok(results.every((result) => result.chunkId.startsWith('a-')));
  } finally {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('RAG failure status clears partial vectors for that source', () => {
  const { dataDir, store } = createStore();

  try {
    store.indexDocument({
      documentKey: 'doc-failed',
      title: 'Failed Document',
      sourceType: 'mineru-markdown',
      sourceSignature: 'sig-before',
      embeddingModelKey: 'embedding-test',
      totalChunkCount: 2,
      chunks: [{
        chunkId: 'partial',
        chunkIndex: 0,
        pageIndex: null,
        text: 'partial chunk',
        embedding: [0.2, 0.2, 0.2, 0.2],
      }],
    });

    store.reportFailure({
      documentKey: 'doc-failed',
      title: 'Failed Document',
      sourceType: 'mineru-markdown',
      sourceSignature: 'sig-before',
      embeddingModelKey: 'embedding-test',
      totalChunkCount: 2,
      errorMessage: 'embedding unavailable',
      retryAfterMs: 1000,
    });

    const status = store.getDocumentIndexStatus({
      documentKey: 'doc-failed',
      sourceType: 'mineru-markdown',
    });
    assert.equal(status.status, 'failed');
    assert.equal(status.indexedChunkCount, 0);
    assert.equal(status.lastError, 'embedding unavailable');

    assert.deepEqual(
      store.retrieveDocumentChunks({
        documentKey: 'doc-failed',
        sourceType: 'mineru-markdown',
        queryEmbedding: [0.2, 0.2, 0.2, 0.2],
        topK: 3,
      }),
      [],
    );
  } finally {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('RAG store snapshots and restores the embedding database', async () => {
  const source = createStore();
  const target = createStore();
  const snapshotPath = path.join(source.dataDir, 'snapshots', 'paperquay-rag.sqlite');

  try {
    source.store.indexDocument({
      documentKey: 'doc-snapshot',
      title: 'Snapshot Document',
      sourceType: 'pdf-text',
      sourceSignature: 'sig-snapshot',
      embeddingModelKey: 'embedding-test',
      totalChunkCount: 1,
      chunks: [{
        chunkId: 'snap-1',
        chunkIndex: 0,
        pageIndex: 3,
        blockId: 'block-snap',
        text: 'restored embedding chunk',
        embedding: [0.9, 0.1, 0.1, 0.1],
      }],
    });

    source.store.snapshotTo(snapshotPath);
    await target.store.replaceWithSnapshot(snapshotPath);

    const status = target.store.getDocumentIndexStatus({
      documentKey: 'doc-snapshot',
      sourceType: 'pdf-text',
    });
    assert.equal(status.status, 'ready');
    assert.equal(status.indexedChunkCount, 1);

    const results = target.store.retrieveDocumentChunks({
      documentKey: 'doc-snapshot',
      sourceType: 'pdf-text',
      queryEmbedding: [0.91, 0.1, 0.1, 0.1],
      topK: 1,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].chunkId, 'snap-1');
    assert.equal(results[0].text, 'restored embedding chunk');
  } finally {
    source.store.close();
    target.store.close();
    rmSync(source.dataDir, { recursive: true, force: true });
    rmSync(target.dataDir, { recursive: true, force: true });
  }
});
