import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createLibraryStore } = require('../electron/backend/libraryStore.cjs');
const { createNoteStore } = require('../electron/backend/noteStore.cjs');
const { createRagStore } = require('../electron/backend/ragStore.cjs');
const { LATEST_MANIFEST_REMOTE_PATH, NOTES_DATABASE_REMOTE_PATH, runBackup, runRestore } = require('../electron/backend/webdavBackup.cjs');

const LIBRARY_DATABASE_REMOTE_PATH = 'latest/database/paperquay-library.sqlite';
const RAG_DATABASE_REMOTE_PATH = 'latest/database/paperquay-rag.sqlite';

class MemoryWebdav {
  objects = new Map<string, Buffer>();

  async getText(remotePath: string): Promise<string | null> {
    const bytes = this.objects.get(remotePath);
    return bytes ? bytes.toString('utf8') : null;
  }

  async getBytes(remotePath: string): Promise<Buffer | null> {
    const bytes = this.objects.get(remotePath);
    return bytes ? Buffer.from(bytes) : null;
  }

  async atomicUploadBytes(remotePath: string, _backupId: string, bytes: Buffer): Promise<void> {
    this.objects.set(remotePath, Buffer.from(bytes));
  }
}

function createAppPaths(prefix: string) {
  const dataDir = mkdtempSync(path.join(tmpdir(), prefix));

  return {
    dataDir,
    configPath: path.join(dataDir, '.settings', 'paperquay.config.json'),
    mineruCacheDir: path.join(dataDir, '.mineru-cache'),
    remotePdfDownloadDir: path.join(dataDir, '.downloads', 'pdfs'),
    libraryPath: path.join(dataDir, 'paperquay-library.json'),
    libraryDatabasePath: path.join(dataDir, 'paperquay-library.sqlite'),
    notesDatabasePath: path.join(dataDir, 'paperquay-notes.sqlite'),
    ragDatabasePath: path.join(dataDir, 'paperquay-rag.sqlite'),
    screenshotDir: path.join(dataDir, '.screenshots'),
  };
}

function createContext(prefix: string) {
  const appPaths = createAppPaths(prefix);
  const store = createLibraryStore(appPaths);
  const noteStore = createNoteStore(appPaths);
  const ragStore = createRagStore(appPaths);

  return {
    appPaths,
    noteStore,
    store,
    ragStore,
    close() {
      noteStore.close();
      ragStore.close();
      store.close();
      rmSync(appPaths.dataDir, { recursive: true, force: true });
    },
  };
}

function seedLibrary(context: ReturnType<typeof createContext>) {
  const storageDir = path.join(context.appPaths.dataDir, 'papers');
  const pdfPath = path.join(storageDir, 'seed.pdf');
  mkdirSync(storageDir, { recursive: true });
  writeFileSync(pdfPath, '%PDF-1.7\n');

  const library = context.store.load();
  library.settings.storageDir = storageDir;
  library.webdav.includePdfs = false;
  library.webdav.includeDerived = false;
  library.categories.push({
    id: 'cat-webdav',
    name: 'WebDAV',
    parentId: null,
    sortOrder: 10,
    isSystem: false,
    systemKey: null,
    createdAt: 1000,
    updatedAt: 1000,
    paperCount: 0,
  });
  library.papers.push({
    id: 'paper-webdav',
    title: 'Backed Up Paper',
    year: '2026',
    publication: 'Backup Tests',
    doi: null,
    url: null,
    abstractText: 'Backed up through SQLite.',
    keywords: ['backup'],
    importedAt: 1000,
    updatedAt: 1001,
    lastReadAt: null,
    readingProgress: 0.2,
    isFavorite: false,
    userNote: null,
    aiSummary: null,
    citation: null,
    source: 'local',
    sortOrder: 0,
    authors: [{
      id: 'author-webdav',
      name: 'Backup Author',
      givenName: null,
      familyName: null,
      sortOrder: 0,
    }],
    tags: [],
    categoryIds: ['cat-webdav'],
    attachments: [{
      id: 'att-webdav',
      paperId: 'paper-webdav',
      kind: 'pdf',
      originalPath: pdfPath,
      storedPath: pdfPath,
      relativePath: 'seed.pdf',
      fileName: 'seed.pdf',
      mimeType: 'application/pdf',
      fileSize: 9,
      contentHash: 'seed-hash',
      createdAt: 1000,
      missing: false,
    }],
  });

  context.store.save(library);
}

function seedRag(context: ReturnType<typeof createContext>) {
  context.ragStore.indexDocument({
    documentKey: 'paper-webdav',
    title: 'Backed Up Paper',
    sourceType: 'pdf-text',
    sourceSignature: 'sig-webdav',
    embeddingModelKey: 'embedding-test',
    totalChunkCount: 1,
    chunks: [{
      chunkId: 'webdav-1',
      chunkIndex: 0,
      pageIndex: 0,
      blockId: 'block-webdav',
      text: 'embedding restored from WebDAV',
      embedding: [0.5, 0.5, 0.1, 0.1],
    }],
  });
}

function seedNotes(context: ReturnType<typeof createContext>) {
  context.noteStore.createNote({
    paperId: 'paper-webdav',
    type: 'highlight',
    title: 'Important method',
    content: 'This note should survive WebDAV backup.',
    excerpt: 'method excerpt',
    tags: ['method'],
    color: '#fef3c7',
    pdfLocation: {
      pageNumber: 2,
      bbox: [10, 20, 120, 80],
      bboxCoordinateSystem: 'normalized-1000',
      highlightColor: '#fef3c7',
    },
  });
}

test('WebDAV backup uploads and restores library, notes, and RAG SQLite databases', async () => {
  const source = createContext('paperquay-webdav-source-');
  const target = createContext('paperquay-webdav-target-');
  const webdav = new MemoryWebdav();

  try {
    seedLibrary(source);
    seedNotes(source);
    seedRag(source);

    const backup = await runBackup(source, webdav);
    assert.equal(backup.ok, true);
    assert.equal(backup.databaseCount, 3);
    assert.ok(webdav.objects.has(LIBRARY_DATABASE_REMOTE_PATH));
    assert.ok(webdav.objects.has(NOTES_DATABASE_REMOTE_PATH));
    assert.ok(webdav.objects.has(RAG_DATABASE_REMOTE_PATH));

    const manifest = JSON.parse((await webdav.getText(LATEST_MANIFEST_REMOTE_PATH)) ?? '{}');
    assert.equal(manifest.version, 3);
    assert.deepEqual(
      manifest.objects
        .filter((object: { kind: string }) => object.kind === 'database')
        .map((object: { remotePath: string }) => object.remotePath)
        .sort(),
      [LIBRARY_DATABASE_REMOTE_PATH, NOTES_DATABASE_REMOTE_PATH, RAG_DATABASE_REMOTE_PATH].sort(),
    );

    const restore = await runRestore(target, webdav);
    assert.equal(restore.ok, true);
    assert.equal(restore.failedCount, 0);

    const restoredLibrary = target.store.load();
    const restoredPaper = restoredLibrary.papers.find((paper: { id: string }) => paper.id === 'paper-webdav');
    assert.ok(restoredPaper);
    assert.equal(restoredPaper.title, 'Backed Up Paper');
    assert.equal(restoredPaper.attachments[0].paperId, 'paper-webdav');
    assert.deepEqual(restoredPaper.categoryIds, ['cat-webdav']);

    const restoredNotes = target.noteStore.listNotes({ paperId: 'paper-webdav' });
    assert.equal(restoredNotes.length, 1);
    assert.equal(restoredNotes[0].title, 'Important method');
    assert.equal(restoredNotes[0].pdfLocation.pageNumber, 2);

    const results = target.ragStore.retrieveDocumentChunks({
      documentKey: 'paper-webdav',
      sourceType: 'pdf-text',
      queryEmbedding: [0.5, 0.5, 0.1, 0.1],
      topK: 1,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].chunkId, 'webdav-1');
    assert.equal(results[0].text, 'embedding restored from WebDAV');
  } finally {
    source.close();
    target.close();
  }
});
