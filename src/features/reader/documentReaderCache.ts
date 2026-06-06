import type { MineruPage, PaperSummary, PdfSource, WorkspaceItem } from '../../types/reader.ts';
import {
  buildMineruCachePathCandidates,
  buildMineruSummaryCachePathCandidates,
} from '../../utils/mineruCache.ts';
import { isMineruCacheManifest } from './documentReaderManifest.ts';
type Localize = (zh: string, en: string) => string;

type ReadLocalTextFileIfExists = (path: string) => Promise<string | null>;
type LoadPdfBinary = (source: PdfSource) => Promise<Uint8Array | null>;
type FetchJsonText = (url: string) => Promise<string | null>;
type ParseMineruPages = (payload: string | unknown) => MineruPage[];
type SummaryCacheEnvelope = {
  sourceKey: string;
  summary: PaperSummary;
};

const ONBOARDING_WELCOME_WORKSPACE_ID = 'onboarding:welcome';
const ONBOARDING_WELCOME_CACHE_DIR = '/onboarding/mineru-cache/welcome-bfc1ec86';

export interface SavedMineruPagesResult {
  pages: MineruPage[];
  path: string;
  message: string;
}

async function defaultFetchJsonText(url: string) {
  const response = await fetch(url);
  return response.ok ? response.text() : null;
}

function isOnboardingWelcomeItem(item: WorkspaceItem | null | undefined): boolean {
  return item?.workspaceId === ONBOARDING_WELCOME_WORKSPACE_ID;
}

export function isMatchingSummaryCacheEnvelope(
  value: unknown,
  sourceKey: string,
): value is SummaryCacheEnvelope {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Partial<SummaryCacheEnvelope>).sourceKey === sourceKey &&
      (value as Partial<SummaryCacheEnvelope>).summary,
  );
}

export async function loadSavedSummaryCache({
  item,
  mineruCacheDir,
  sourceKey,
  readText,
}: {
  item: WorkspaceItem;
  mineruCacheDir: string;
  sourceKey: string;
  readText: ReadLocalTextFileIfExists;
}): Promise<PaperSummary | null> {
  if (!mineruCacheDir.trim() || !sourceKey.trim()) {
    return null;
  }

  const candidatePaths = buildMineruSummaryCachePathCandidates(
    mineruCacheDir.trim(),
    item,
    sourceKey,
  );

  for (const candidatePath of candidatePaths) {
    try {
      const raw = await readText(candidatePath);
      if (!raw) continue;

      const parsed = JSON.parse(raw);

      if (!isMatchingSummaryCacheEnvelope(parsed, sourceKey)) {
        continue;
      }

      return parsed.summary;
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadSavedMineruPages({
  item,
  mineruCacheDir,
  onboardingDemoReveal,
  l,
  readText,
  parsePages,
  fetchJsonText = defaultFetchJsonText,
}: {
  item: WorkspaceItem;
  mineruCacheDir: string;
  onboardingDemoReveal?: { parsed: boolean } | null;
  l: Localize;
  readText: ReadLocalTextFileIfExists;
  parsePages: ParseMineruPages;
  fetchJsonText?: FetchJsonText;
}): Promise<SavedMineruPagesResult | null> {
  if (isOnboardingWelcomeItem(item)) {
    if (onboardingDemoReveal && !onboardingDemoReveal.parsed) {
      return null;
    }

    const path = `${ONBOARDING_WELCOME_CACHE_DIR}/content_list_v2.json`;
    const jsonText = await fetchJsonText(path);

    if (!jsonText) {
      return null;
    }

    return {
      pages: parsePages(jsonText),
      path,
      message: l(
        '已加载 Welcome 内置 MinerU 解析结果',
        'Loaded the built-in Welcome MinerU parse result',
      ),
    };
  }

  if (!mineruCacheDir.trim()) {
    return null;
  }

  const candidateCaches = buildMineruCachePathCandidates(mineruCacheDir.trim(), item);

  for (const cachePaths of candidateCaches) {
    for (const candidatePath of [cachePaths.contentJsonPath, cachePaths.middleJsonPath]) {
      try {
        const jsonText = await readText(candidatePath);
        if (!jsonText) continue;

        return {
          pages: parsePages(jsonText),
          path: candidatePath,
          message: l(
            `已从本地缓存恢复《${item.title}》的解析结果`,
            `Restored the parsing result for "${item.title}" from the local cache`,
          ),
        };
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function resolveSavedPdfPath({
  item,
  mineruCacheDir,
  readText,
  loadPdf,
}: {
  item: WorkspaceItem;
  mineruCacheDir: string;
  readText: ReadLocalTextFileIfExists;
  loadPdf: LoadPdfBinary;
}): Promise<string | null> {
  if (!mineruCacheDir.trim()) {
    return null;
  }

  const candidateCaches = buildMineruCachePathCandidates(mineruCacheDir.trim(), item);

  for (const cachePaths of candidateCaches) {
    try {
      const manifestText = await readText(cachePaths.manifestPath);
      if (!manifestText) continue;

      const parsed = JSON.parse(manifestText);

      if (!isMineruCacheManifest(parsed) || !parsed.pdfPath.trim()) {
        continue;
      }

      try {
        await loadPdf({ kind: 'local-path', path: parsed.pdfPath } satisfies PdfSource);
        return parsed.pdfPath;
      } catch {
        continue;
      }
    } catch {
      continue;
    }
  }

  return null;
}
