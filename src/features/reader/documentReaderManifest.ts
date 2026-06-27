import type { MineruCacheManifest } from './readerShared';

export function isMineruCacheManifest(value: unknown): value is MineruCacheManifest {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as MineruCacheManifest).documentKey === 'string' &&
      typeof (value as MineruCacheManifest).pdfPath === 'string',
  );
}
