const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

async function doTranslateText(provider, text, sourceLang, targetLang, settings) {
  const source = sourceLang || 'auto';
  const target = targetLang || 'zh';

  if (provider === 'ai') {
    const baseUrl = (settings?.translationBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiKey = settings?.translationApiKey || '';
    const model = settings?.translationModel || 'gpt-4o-mini';
    if (!apiKey) throw new Error('AI translation requires API Key');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `You are a professional translator. Translate the following academic paper title from ${source} to ${target}. Only output the translated text, nothing else.` },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(`AI translation error: ${data.error.message || JSON.stringify(data.error)}`);
    return (data.choices?.[0]?.message?.content || text).trim();
  }

  if (provider === 'baidu') {
    const appid = settings?.translationAppId || '';
    const secretKey = settings?.translationSecretKey || '';
    if (!appid || !secretKey) throw new Error('Baidu Translate requires APP ID and Secret Key');
    const salt = String(Date.now());
    const sign = crypto.createHash('md5').update(`${appid}${text}${salt}${secretKey}`).digest('hex');
    const response = await fetch(`https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=${source}&to=${target}&appid=${appid}&salt=${salt}&sign=${sign}`);
    const data = await response.json();
    if (data.error_code && data.error_code !== '0') throw new Error(`Baidu error: ${data.error_code} ${data.error_msg || ''}`);
    return data.trans_result?.[0]?.dst ?? text;
  }

  if (provider === 'google') {
    if (!settings?.translationApiKey) throw new Error('Google Translate requires API Key');
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${settings.translationApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
    });
    const data = await response.json();
    if (data.error) throw new Error(`Google error: ${data.error.message}`);
    return data.data?.translations?.[0]?.translatedText ?? text;
  }

  if (provider === 'deepl') {
    if (!settings?.translationApiKey) throw new Error('DeepL requires API Key');
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ auth_key: settings.translationApiKey, text, source_lang: source.toUpperCase(), target_lang: target.toUpperCase() }),
    });
    const data = await response.json();
    if (data.message) throw new Error(`DeepL error: ${data.message}`);
    return data.translations?.[0]?.text ?? text;
  }

  if (provider === 'aliyun') {
    if (!settings?.translationApiKey || !settings?.translationSecretKey) throw new Error('Alibaba requires Access Key and Secret Key');
    const response = await fetch('https://mt.cn-hangzhou.aliyuncs.com/api/translate/web/general', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SourceText: text, SourceLanguage: source, TargetLanguage: target, FormatType: 'text' }),
    });
    const data = await response.json();
    if (data.Code !== 'OK') throw new Error(`Alibaba error: ${data.Message || data.Code}`);
    return data.Data?.Translated ?? text;
  }

  if (provider === 'tencent') {
    if (!settings?.translationApiKey || !settings?.translationSecretKey) throw new Error('Tencent requires SecretId and SecretKey');
    const response = await fetch('https://tmt.tencentcloudapi.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TC-Action': 'TextTranslate', 'X-TC-Region': 'ap-guangzhou' },
      body: JSON.stringify({ SourceText: text, Source: source, Target: target, ProjectId: 0 }),
    });
    const data = await response.json();
    if (data.Response?.Error) throw new Error(`Tencent error: ${data.Response.Error.Message}`);
    return data.Response?.TargetText ?? text;
  }

  if (provider === 'volc') {
    if (!settings?.translationApiKey || !settings?.translationSecretKey) throw new Error('Volcano requires Access Key and Secret Key');
    const response = await fetch('https://translate.volcengineapi.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SourceLanguage: source, TargetLanguage: target, TextList: [text] }),
    });
    const data = await response.json();
    if (data.ResponseMetadata?.Error) throw new Error(`Volcano error: ${data.ResponseMetadata.Error.Message}`);
    return data.TranslationList?.[0]?.Translation ?? text;
  }

  throw new Error(`Unsupported translation provider: ${provider}`);
}

async function translateOnePaperTitle(paper, library, appPaths) {
  const db = new DatabaseSync(appPaths.libraryDatabasePath, { timeout: 3000 });
  try {
    const existing = db.prepare('SELECT 1 FROM paper_translations WHERE paper_id = ? AND field = ? AND target_lang = ?').get(paper.id, 'title', 'zh-CN');
    if (existing) return 'skipped';

    const translated = await doTranslateText(
      library.settings.translationProvider,
      paper.title,
      'en',
      'zh',
      library.settings,
    );
    db.prepare(`INSERT INTO paper_translations (paper_id, field, source_lang, target_lang, translated_text, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(paper_id, field, target_lang) DO UPDATE SET translated_text = excluded.translated_text, updated_at = excluded.updated_at
    `).run(paper.id, 'title', 'en', 'zh-CN', translated.trim(), Date.now());
    return 'ok';
  } catch (error) {
    console.error(`[paperquay] Failed to translate title for paper ${paper.id}:`, error);
    return 'error';
  } finally {
    db.close();
  }
}

async function syncSinglePaperToRepo(paper, repoDir, appPaths) {
  const paperDir = path.join(repoDir, paper.id);
  await fsp.mkdir(paperDir, { recursive: true });

  await fsp.writeFile(
    path.join(paperDir, 'metadata.json'),
    JSON.stringify({
      id: paper.id,
      title: paper.title,
      authors: paper.authors.map((a) => a.name),
      year: paper.year,
      publication: paper.publication,
      doi: paper.doi,
      url: paper.url,
      abstract: paper.abstractText,
      keywords: paper.keywords,
      tags: paper.tags.map((t) => t.name),
      userNote: paper.userNote,
      isFavorite: paper.isFavorite,
      source: paper.source,
      importedAt: paper.importedAt,
      updatedAt: paper.updatedAt,
    }, null, 2),
  );

  const mineruDir = path.join(appPaths.mineruCacheDir, `document-${paper.id}`);
  for (const [src, dst] of [['full.md', 'full.md'], ['content_list_v2.json', 'content_list_v2.json']]) {
    try { await fsp.access(path.join(mineruDir, src)); await fsp.copyFile(path.join(mineruDir, src), path.join(paperDir, dst)); } catch {}
  }

  const pdfAttachment = paper.attachments.find((a) => a.kind === 'pdf');
  if (pdfAttachment) {
    try { await fsp.access(pdfAttachment.storedPath); await fsp.copyFile(pdfAttachment.storedPath, path.join(paperDir, 'paper.pdf')); } catch {}
  }

  if (paper.userNote?.trim()) {
    try { await fsp.writeFile(path.join(paperDir, 'note.md'), paper.userNote); } catch {}
  }

  const indexEntry = {
    id: paper.id,
    title: paper.title,
    authors: paper.authors.map((a) => a.name),
    year: paper.year,
    doi: paper.doi,
    tags: paper.tags.map((t) => t.name),
    hasPdf: Boolean(pdfAttachment),
    hasMarkdown: false,
  };
  try { await fsp.access(path.join(paperDir, 'full.md')); indexEntry.hasMarkdown = true; } catch {}

  const indexPath = path.join(repoDir, 'index.json');
  let index = [];
  try { index = JSON.parse(await fsp.readFile(indexPath, 'utf8')); } catch {}
  const existingIdx = index.findIndex((e) => e.id === paper.id);
  if (existingIdx >= 0) { index[existingIdx] = indexEntry; } else { index.push(indexEntry); }
  await fsp.writeFile(indexPath, JSON.stringify(index, null, 2));
}

const {
  attachCategoryCounts,
  normalizeAuthor,
  normalizeTag,
  paperMatches,
  sortPapers,
} = require('./libraryStore.cjs');
const { DatabaseSync, sqlStringLiteral, withTransaction } = require('./nodeSqlite.cjs');
const {
  cleanString,
  ensureFile,
  fileNameFromPath,
  hashBytes,
  hashFile,
  id,
  isPdf,
  now,
  readRequestJson,
  safeFileName,
} = require('./utils.cjs');

const OPENALEX_API_BASE = 'https://api.openalex.org';

function normalizeDoi(value) {
  return cleanString(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim();
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const nextValue = value.find((item) => typeof item === 'string' && item.trim());
      if (nextValue) return nextValue.trim();
    }
  }

  return null;
}

function normalizeYear(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  const text = cleanString(value);
  const match = text.match(/\b(18|19|20|21)\d{2}\b/);
  return match?.[0] ?? null;
}

function doiUrl(doi) {
  const normalized = normalizeDoi(doi);
  return normalized ? `https://doi.org/${normalized}` : '';
}

function normalizeTitleForMatching(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleTokens(value) {
  return normalizeTitleForMatching(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function diceCoefficient(left, right) {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightCounts = new Map();
  for (const token of rightTokens) {
    rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  }

  let matches = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) ?? 0;
    if (count <= 0) continue;
    matches += 1;
    rightCounts.set(token, count - 1);
  }

  return (2 * matches) / (leftTokens.length + rightTokens.length);
}

function titleSimilarity(left, right) {
  const normalizedLeft = normalizeTitleForMatching(left);
  const normalizedRight = normalizeTitleForMatching(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const shorter = normalizedLeft.length < normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = normalizedLeft.length < normalizedRight.length ? normalizedRight : normalizedLeft;
  const containmentScore = shorter.length >= 16 && longer.includes(shorter)
    ? Math.min(0.92, shorter.length / Math.max(longer.length, 1) + 0.18)
    : 0;

  return Math.max(diceCoefficient(normalizedLeft, normalizedRight), containmentScore);
}

function bestOpenAlexTitleMatch(results, requestedTitle) {
  const candidates = (Array.isArray(results) ? results : [])
    .map((item) => ({
      item,
      score: titleSimilarity(requestedTitle, firstString(item?.title, item?.display_name)),
    }))
    .filter((candidate) => candidate.score >= 0.78)
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.item ?? null;
}

function buildUrl(base, params) {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params ?? {})) {
    const normalized = cleanString(value);
    if (normalized) {
      url.searchParams.set(key, normalized);
    }
  }

  return url.toString();
}

function hasMetadataValue(metadata) {
  return Boolean(
    metadata &&
    (
      cleanString(metadata.doi) ||
      cleanString(metadata.title) ||
      cleanString(metadata.year) ||
      cleanString(metadata.publication) ||
      cleanString(metadata.url) ||
      cleanString(metadata.abstractText) ||
      (Array.isArray(metadata.authors) && metadata.authors.length > 0)
    ),
  );
}

function abstractFromOpenAlexInvertedIndex(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') {
    return null;
  }

  const positionedWords = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;

    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0) {
        positionedWords[position] = word;
      }
    }
  }

  const abstract = positionedWords.filter(Boolean).join(' ').trim();
  return abstract || null;
}

function mapOpenAlexWork(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const publication =
    item.primary_location?.source?.display_name ||
    item.host_venue?.display_name ||
    item.locations?.find((location) => location?.source?.display_name)?.source?.display_name ||
    null;
  const doi = normalizeDoi(item.doi);

  return {
    source: 'openalex',
    doi: doi || null,
    title: firstString(item.title, item.display_name),
    authors: (item.authorships ?? [])
      .map((authorship) => cleanString(authorship?.author?.display_name))
      .filter(Boolean),
    year: normalizeYear(item.publication_year ?? item.publication_date),
    publication: cleanString(publication) || null,
    url: firstString(item.primary_location?.landing_page_url, item.doi, item.id),
    abstractText: abstractFromOpenAlexInvertedIndex(item.abstract_inverted_index),
  };
}

function mapCrossrefWork(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  return {
    source: 'crossref',
    doi: normalizeDoi(item.DOI) || null,
    title: firstString(item.title),
    authors: (item.author ?? [])
      .map((author) => [author.given, author.family].filter(Boolean).join(' '))
      .map(cleanString)
      .filter(Boolean),
    year: normalizeYear(item.issued?.['date-parts']?.[0]?.[0] ?? item.published?.['date-parts']?.[0]?.[0]),
    publication: firstString(item['container-title']),
    url: firstString(item.URL, doiUrl(item.DOI)),
    abstractText: firstString(item.abstract),
  };
}

function mergeMetadataResults(...results) {
  const usefulResults = results.filter(hasMetadataValue);
  if (usefulResults.length === 0) {
    return null;
  }

  const merged = {
    source: usefulResults.map((result) => result.source).join('+'),
    doi: null,
    title: null,
    authors: [],
    year: null,
    publication: null,
    url: null,
    abstractText: null,
  };

  for (const result of usefulResults) {
    merged.doi ||= cleanString(result.doi) || null;
    merged.title ||= cleanString(result.title) || null;
    merged.year ||= cleanString(result.year) || null;
    merged.publication ||= cleanString(result.publication) || null;
    merged.url ||= cleanString(result.url) || null;
    merged.abstractText ||= cleanString(result.abstractText) || null;

    if (merged.authors.length === 0 && Array.isArray(result.authors) && result.authors.length > 0) {
      merged.authors = result.authors.map(cleanString).filter(Boolean);
    }
  }

  return merged;
}

async function lookupOpenAlexMetadata({ doi, title, settings }) {
  if (settings?.openAlexEnabled === false) {
    return null;
  }

  const params = {
    api_key: settings?.openAlexApiKey,
    mailto: settings?.openAlexMailto,
  };
  let endpoint = '';

  if (doi) {
    endpoint = buildUrl(`${OPENALEX_API_BASE}/works/${encodeURIComponent(doiUrl(doi))}`, params);
  } else if (title) {
    endpoint = buildUrl(`${OPENALEX_API_BASE}/works`, {
      ...params,
      filter: `title.search:${title}`,
      'per-page': '10',
    });
  }

  if (!endpoint) {
    return null;
  }

  const data = await readRequestJson(await fetch(endpoint), 'OpenAlex metadata');
  const item = doi ? data : bestOpenAlexTitleMatch(data?.results, title);
  return mapOpenAlexWork(item);
}

async function lookupCrossrefMetadata({ doi, title }) {
  const endpoint = doi
    ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    : title
      ? `https://api.crossref.org/works?rows=1&query.title=${encodeURIComponent(title)}`
      : '';

  if (!endpoint) {
    return null;
  }

  const data = await readRequestJson(await fetch(endpoint), 'Crossref metadata');
  const item = doi ? data.message : data.message?.items?.[0];
  return mapCrossrefWork(item);
}

function createLibraryCommands(context) {
  const { appPaths, store } = context;

  const commands = {
    async library_init() {
      const library = store.load();
      await store.save(library);
      return {
        settings: library.settings,
        categories: attachCategoryCounts(library),
        papers: sortPapers(library.papers, { sortBy: 'manual' }),
      };
    },

    async library_get_settings() {
      return store.load().settings;
    },

    async library_update_settings({ settings }) {
      const library = store.load();
      library.settings = {
        ...library.settings,
        ...settings,
        importMode: settings.importMode || library.settings.importMode,
      };
      if (library.settings.storageDir) await fsp.mkdir(library.settings.storageDir, { recursive: true });
      await store.save(library);
      return library.settings;
    },

    async library_list_categories() {
      return attachCategoryCounts(store.load());
    },

    async library_create_category({ request }) {
      const library = store.load();
      const name = cleanString(request?.name);
      if (!name) throw new Error('Category name cannot be empty');

      const parentId = request?.parentId || null;
      const category = {
        id: id('cat'),
        name,
        parentId,
        sortOrder: library.categories.filter((item) => item.parentId === parentId && !item.isSystem).length,
        isSystem: false,
        systemKey: null,
        createdAt: now(),
        updatedAt: now(),
        paperCount: 0,
      };
      library.categories.push(category);
      await store.save(library);
      return attachCategoryCounts(library).find((item) => item.id === category.id);
    },

    async library_update_category({ request }) {
      const library = store.load();
      const category = library.categories.find((item) => item.id === request.id);
      if (!category) throw new Error('Category does not exist');
      if (category.isSystem) throw new Error('System categories cannot be modified');

      if (request.name != null && cleanString(request.name)) category.name = cleanString(request.name);
      if (request.parentId !== undefined) category.parentId = request.parentId || null;
      if (request.sortOrder != null) category.sortOrder = request.sortOrder;
      category.updatedAt = now();

      await store.save(library);
      return attachCategoryCounts(library).find((item) => item.id === category.id);
    },

    async library_move_category({ request }) {
      return commands.library_update_category({
        request: {
          id: request.categoryId,
          parentId: request.parentId ?? null,
          sortOrder: request.sortOrder,
        },
      });
    },

    async library_delete_category({ categoryId }) {
      const library = store.load();
      const target = library.categories.find((item) => item.id === categoryId);
      if (!target) throw new Error('Category does not exist');
      if (target.isSystem) throw new Error('System categories cannot be deleted');

      const removeIds = new Set([categoryId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const category of library.categories) {
          if (category.parentId && removeIds.has(category.parentId) && !removeIds.has(category.id)) {
            removeIds.add(category.id);
            changed = true;
          }
        }
      }

      library.categories = library.categories.filter((item) => !removeIds.has(item.id));
      for (const paper of library.papers) {
        paper.categoryIds = paper.categoryIds.filter((id) => !removeIds.has(id));
      }
      await store.save(library);
    },

    async library_list_papers({ request = {} }) {
      const library = store.load();
      const limit = Math.max(1, Math.min(1000, request.limit ?? 300));
      return sortPapers(library.papers.filter((paper) => paperMatches(paper, request, library)), request).slice(0, limit);
    },

    async library_reorder_papers({ request }) {
      const library = store.load();
      const order = new Map((request.paperIds ?? []).map((paperId, index) => [paperId, index]));
      for (const paper of library.papers) {
        if (order.has(paper.id)) paper.sortOrder = order.get(paper.id);
      }
      await store.save(library);
    },

    async library_import_pdfs({ request }) {
      const library = store.load();
      const results = [];
      const storageDir = library.settings.storageDir || path.join(appPaths.dataDir, 'paperquay-data');
      await fsp.mkdir(storageDir, { recursive: true });

      for (const sourcePath of request.paths ?? []) {
        try {
          if (!isPdf(sourcePath)) throw new Error('Only PDF files can be imported');
          await ensureFile(sourcePath);

          const bytes = await fsp.readFile(sourcePath);
          const contentHash = hashBytes(bytes);
          const metadata = request.metadata?.[sourcePath] ?? {};

          let existingPaper = library.papers.find((paper) =>
            paper.attachments.some((attachment) => attachment.contentHash === contentHash),
          );

          if (!existingPaper) {
            const sourceDoi = cleanString(metadata.doi);
            if (sourceDoi) {
              existingPaper = library.papers.find((p) => cleanString(p.doi) === sourceDoi) ?? null;
            }
          }

          if (!existingPaper) {
            const sourceTitle = cleanString(metadata.title || path.basename(sourcePath, '.pdf').replace(/\.pdf$/i, ''));
            if (sourceTitle) {
              const norm = (t) => t.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '').toLowerCase();
              const titleNorm = norm(sourceTitle);
              existingPaper = library.papers.find((p) => {
                const pNorm = norm(cleanString(p.title));
                return pNorm && (pNorm === titleNorm || pNorm.includes(titleNorm) || titleNorm.includes(pNorm));
              }) ?? null;
            }
          }

          if (!existingPaper) {
            const fileNameNoExt = path.basename(sourcePath).replace(/\.pdf$/i, '').toLowerCase();
            if (fileNameNoExt) {
              existingPaper = library.papers.find((p) => {
                const storedFile = p.attachments.find((a) => a.kind === 'pdf' && a.fileName);
                return storedFile && storedFile.fileName.toLowerCase().replace(/\.pdf$/i, '') === fileNameNoExt;
              }) ?? null;
            }
          }

          if (existingPaper) {
            let matchedHashFileMissing = false;
            let anyValidPdf = false;
            for (const a of existingPaper.attachments) {
              if (a.kind !== 'pdf' || !a.storedPath) continue;
              let fileExists = false;
              try { await fsp.access(a.storedPath); fileExists = true; } catch { a.missing = true; }
              if (fileExists) anyValidPdf = true;
              if (a.contentHash === contentHash && !fileExists) matchedHashFileMissing = true;
            }

            if (anyValidPdf) {
              results.push({ sourcePath, paper: existingPaper, duplicated: true, existingPaperId: existingPaper.id, status: 'duplicate', message: 'PDF already exists' });
              if (matchedHashFileMissing) await store.save(library);
              continue;
            }

            const attId = id('att');
            const fileName = safeFileName(fileNameFromPath(sourcePath));
            const storedPath = path.join(storageDir, `${attId}-${fileName}`);
            await fsp.copyFile(sourcePath, storedPath);
            const stat = await fsp.stat(storedPath);
            existingPaper.attachments.push({
              id: attId,
              paperId: existingPaper.id,
              kind: 'pdf',
              originalPath: sourcePath,
              storedPath,
              relativePath: path.relative(storageDir, storedPath),
              fileName,
              mimeType: 'application/pdf',
              fileSize: stat.size,
              contentHash,
              createdAt: now(),
              missing: false,
            });
            existingPaper.updatedAt = now();
            await store.save(library);
            results.push({ sourcePath, paper: existingPaper, duplicated: false, existingPaperId: existingPaper.id, status: 'imported', message: 'PDF supplemented' });
            continue;
          }

          const paperId = id('paper');
          const fileName = safeFileName(fileNameFromPath(sourcePath));
          let storedPath = sourcePath;
          let relativePath = null;
          const importMode = request.importMode || library.settings.importMode;

          if (importMode !== 'keep') {
            storedPath = path.join(storageDir, `${paperId}-${fileName}`);
            if (importMode === 'move') await fsp.rename(sourcePath, storedPath);
            else await fsp.copyFile(sourcePath, storedPath);
            relativePath = path.relative(storageDir, storedPath);
          }

          const stat = await fsp.stat(storedPath);
          const paper = {
            id: paperId,
            title: cleanString(metadata.title) || path.basename(fileName, path.extname(fileName)),
            year: metadata.year ?? null,
            publication: metadata.publication ?? null,
            doi: metadata.doi ?? null,
            url: metadata.url ?? null,
            abstractText: metadata.abstractText ?? null,
            keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
            importedAt: now(),
            updatedAt: now(),
            lastReadAt: null,
            readingProgress: 0,
            isFavorite: false,
            userNote: null,
            aiSummary: null,
            citation: null,
            source: 'local',
            sortOrder: Math.min(0, ...library.papers.map((item) => item.sortOrder ?? 0)) - 1,
            authors: (metadata.authors ?? []).map(normalizeAuthor),
            tags: [],
            categoryIds: request.targetCategoryId ? [request.targetCategoryId] : [],
            attachments: [{
              id: id('att'),
              paperId,
              kind: 'pdf',
              originalPath: sourcePath,
              storedPath,
              relativePath,
              fileName,
              mimeType: 'application/pdf',
              fileSize: stat.size,
              contentHash,
              createdAt: now(),
              missing: false,
            }],
          };
          library.papers.push(paper);
          results.push({ sourcePath, paper, duplicated: false, existingPaperId: null, status: 'imported', message: 'Imported' });
        } catch (error) {
          results.push({ sourcePath, paper: null, duplicated: false, existingPaperId: null, status: 'failed', message: error instanceof Error ? error.message : String(error) });
        }
      }

      await store.save(library);
      return results;
    },

    async library_assign_paper_category({ request }) {
      const library = store.load();
      const paper = library.papers.find((item) => item.id === request.paperId);
      if (!paper) throw new Error('Paper does not exist');
      if (!paper.categoryIds.includes(request.categoryId)) paper.categoryIds.push(request.categoryId);
      paper.updatedAt = now();
      await store.save(library);
      return paper;
    },

    async library_update_paper({ request }) {
      const library = store.load();
      const paper = library.papers.find((item) => item.id === request.paperId);
      if (!paper) throw new Error('Paper does not exist');

      for (const key of ['title', 'year', 'publication', 'doi', 'url', 'abstractText', 'userNote', 'aiSummary', 'citation']) {
        if (request[key] !== undefined) paper[key] = request[key];
      }
      if (request.keywords) paper.keywords = request.keywords.map(cleanString).filter(Boolean);
      if (request.authors) paper.authors = request.authors.map(cleanString).filter(Boolean).map(normalizeAuthor);
      if (request.tags) paper.tags = request.tags.map(cleanString).filter(Boolean).map(normalizeTag);
      if (request.isFavorite != null) paper.isFavorite = Boolean(request.isFavorite);
      paper.updatedAt = now();

      await store.save(library);
      return paper;
    },

    async library_delete_paper({ request }) {
      const library = store.load();
      const paper = library.papers.find((item) => item.id === request.paperId);
      library.papers = library.papers.filter((item) => item.id !== request.paperId);

      if (request.deleteFiles && paper) {
        for (const attachment of paper.attachments) {
          await fsp.rm(attachment.storedPath, { force: true }).catch(() => {});
        }
      }

      await store.save(library);
    },

    async library_batch_delete_tags({ request }) {
      const tagIds = Array.isArray(request?.tagIds) ? request.tagIds : [];
      if (tagIds.length === 0) return;

      const library = store.load();
      const tagIdSet = new Set(tagIds);
      let changed = false;

      for (const paper of library.papers) {
        const before = paper.tags.length;
        paper.tags = paper.tags.filter((tag) => !tagIdSet.has(tag.id));
        if (paper.tags.length !== before) changed = true;
      }

      if (changed) {
        await store.save(library);
      }
    },

    async library_merge_categories({ request }) {
      const { sourceCategoryId, targetCategoryId } = request ?? {};
      if (!sourceCategoryId || !targetCategoryId) throw new Error('sourceCategoryId and targetCategoryId are required');
      if (sourceCategoryId === targetCategoryId) throw new Error('Cannot merge a category into itself');

      const library = store.load();
      const source = library.categories.find((c) => c.id === sourceCategoryId);
      if (!source) throw new Error('Source category does not exist');
      const target = library.categories.find((c) => c.id === targetCategoryId);
      if (!target) throw new Error('Target category does not exist');

      const allDescendantIds = (parentId) => {
        const ids = [];
        const queue = [parentId];
        while (queue.length) {
          const id = queue.shift();
          ids.push(id);
          for (const c of library.categories) {
            if (c.parentId === id && !ids.includes(c.id)) queue.push(c.id);
          }
        }
        return ids;
      };

      const targetDescendants = allDescendantIds(targetCategoryId);
      if (targetDescendants.includes(sourceCategoryId)) {
        throw new Error('Cannot merge a parent category into its descendant');
      }

      for (const paper of library.papers) {
        if (paper.categoryIds.includes(sourceCategoryId)) {
          if (!paper.categoryIds.includes(targetCategoryId)) {
            paper.categoryIds.push(targetCategoryId);
          }
          paper.categoryIds = paper.categoryIds.filter((id) => id !== sourceCategoryId);
        }
      }

      const removeIds = new Set([sourceCategoryId, ...allDescendantIds(sourceCategoryId).filter((id) => id !== sourceCategoryId)]);
      library.categories = library.categories.filter((c) => !removeIds.has(c.id));

      await store.save(library);
    },

    async library_sync_paper_to_repo({ request }) {
      const { paperId } = request ?? {};
      if (!paperId) return;

      const library = store.load();
      const paper = library.papers.find((p) => p.id === paperId);
      if (!paper) return;

      const repoDir = cleanString(library.settings.paperRepoDir);
      if (!repoDir) return;

      await syncSinglePaperToRepo(paper, repoDir, appPaths);
    },

    async library_batch_delete_papers({ request }) {
      const { paperIds, deleteFiles } = request ?? {};
      if (!paperIds?.length) return { deleted: 0 };

      const library = store.load();
      let deleted = 0;
      for (const paperId of paperIds) {
        const paper = library.papers.find((p) => p.id === paperId);
        if (!paper) continue;
        if (deleteFiles) {
          for (const attachment of paper.attachments) {
            await fsp.rm(attachment.storedPath, { force: true }).catch(() => {});
          }
        }
        deleted += 1;
      }
      library.papers = library.papers.filter((p) => !paperIds.includes(p.id));
      await store.save(library);
      return { deleted };
    },

    async library_find_duplicates() {
      const library = store.load();
      const groups = [];
      const seen = new Set();

      const isGenericTitle = (t) => {
        const raw = cleanString(t);
        if (!raw) return true;
        const lowered = raw.toLowerCase().trim();
        const generics = [
          'untitled', 'no title', 'notitle', 'untitled pdf', 'no title available',
          '未命名', 'unknown', 'unnamed', 'pdf', 'document', 'paper',
          /^\d{10,}$/,    // purely numeric (e.g. timestamps)
          /^[a-z0-9]{20,}$/,  // random alphanumeric (e.g. hashes)
        ];
        return generics.some((g) => typeof g === 'string' ? lowered.includes(g) : g.test(lowered));
      };

      const normalizeDoi = (d) => {
        const raw = cleanString(d);
        if (!raw) return null;
        const lowered = raw.toLowerCase()
          .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
          .replace(/^doi:\s*/i, '')
          .replace(/[^a-z0-9.\-\/_:]/g, '')
          .trim();
        if (!lowered) return null;
        const placeholders = /^(n\/?a|none|nil|na|\-|\.|unknown|null|not\s*available)$/;
        if (placeholders.test(lowered)) return null;
        return lowered;
      };

      const normalizeTitle = (t) => {
        const raw = cleanString(t);
        if (!raw || raw.length < 15 || isGenericTitle(raw)) return null;
        const norm = raw.toLowerCase()
          .replace(/[\[\]{}()《》【】「」『』""''“”‘’.,;:!?。，；：！？、·…\-—\s]+/g, '')
          .trim();
        return norm.length >= 15 ? norm : null;
      };

      const doiMap = new Map();
      const titleMap = new Map();
      const hashMap = new Map();

      for (const paper of library.papers) {
        const doi = normalizeDoi(paper.doi);
        if (doi) {
          if (!doiMap.has(doi)) doiMap.set(doi, []);
          doiMap.get(doi).push(paper);
        }

        const title = normalizeTitle(paper.title);
        if (title) {
          if (!titleMap.has(title)) titleMap.set(title, []);
          titleMap.get(title).push(paper);
        }

        for (const att of paper.attachments) {
          if (att.kind === 'pdf' && att.contentHash) {
            let fileExists = false;
            try { fs.accessSync(att.storedPath); fileExists = true; } catch {}
            if (fileExists) {
              if (!hashMap.has(att.contentHash)) hashMap.set(att.contentHash, []);
              hashMap.get(att.contentHash).push(paper);
            }
          }
        }
      }

      const normStr = (t) => (t || '').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '').toLowerCase().trim();
      const makeEntry = (p) => ({ id: p.id, title: p.title, norm: normStr(p.title), authors: p.authors.map((a) => a.name).join(', '), year: p.year, doi: p.doi });

      for (const [, papers] of doiMap) {
        const ids = [...new Set(papers.map((p) => p.id))].filter((id) => !seen.has(id));
        if (ids.length >= 2) {
          ids.forEach((id) => seen.add(id));
          groups.push({ type: 'doi', value: papers[0].doi, entries: papers.map(makeEntry) });
        }
      }

      for (const [, papers] of titleMap) {
        const ids = [...new Set(papers.map((p) => p.id))].filter((id) => !seen.has(id));
        if (ids.length >= 2 && ids.length <= 5) {
          ids.forEach((id) => seen.add(id));
          groups.push({ type: 'title', entries: papers.map(makeEntry) });
        }
      }

      for (const [, papers] of hashMap) {
        const ids = [...new Set(papers.map((p) => p.id))].filter((id) => !seen.has(id));
        if (ids.length >= 2) {
          ids.forEach((id) => seen.add(id));
          groups.push({ type: 'hash', entries: papers.map(makeEntry) });
        }
      }

      return { totalDuplicates: seen.size, groups };
    },

    async library_zotero_supplement({ request }) {
      const { dataDir, collectionKeys } = request ?? {};
      if (!dataDir || !collectionKeys?.length) return { total: 0, supplemented: 0, imported: 0, duplicates: 0, errors: 0, skipped: 0, titleMismatches: [] };

      const { listLocalCollectionItems } = require('./zoteroLocal.cjs');
      const library = store.load();
      const storageDir = library.settings.storageDir || path.join(appPaths.dataDir, 'paperquay-data');
      await fsp.mkdir(storageDir, { recursive: true });
      const norm = (t) => (t || '').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '').toLowerCase();
      let total = 0, supplemented = 0, imported = 0, duplicates = 0, errors = 0, skipped = 0;
      const titleMismatches = [];

      for (const key of collectionKeys) {
        const items = await listLocalCollectionItems({ dataDir, collectionKey: key });
        for (const item of items) {
          if (!item.localPdfPath) { skipped += 1; continue; }
          total += 1;
          try {
            await ensureFile(item.localPdfPath);
            const bytes = await fsp.readFile(item.localPdfPath);
            const contentHash = hashBytes(bytes);
            const itemTitle = item.title?.trim() || item.attachmentFilename || item.itemKey;
            const itemTitleNorm = norm(itemTitle);

            let matched = library.papers.find((p) =>
              p.attachments.some((a) => a.contentHash === contentHash && (() => { try { fs.accessSync(a.storedPath); return true; } catch { return false; } })()),
            );
            if (matched) { duplicates += 1; continue; }

            matched = library.papers.find((p) => {
              const pNorm = norm(p.title);
              return pNorm && (pNorm === itemTitleNorm || pNorm.includes(itemTitleNorm) || itemTitleNorm.includes(pNorm));
            });

            if (matched) {
              const hasValidPdf = matched.attachments.some((a) => { try { fs.accessSync(a.storedPath); return true; } catch { return false; } });
              if (!hasValidPdf) {
                const attId = id('att');
                const fileName = safeFileName(fileNameFromPath(item.localPdfPath));
                const storedPath = path.join(storageDir, `${attId}-${fileName}`);
                await fsp.copyFile(item.localPdfPath, storedPath);
                const stat = await fsp.stat(storedPath);
                matched.attachments.push({
                  id: attId,
                  paperId: matched.id,
                  kind: 'pdf',
                  originalPath: item.localPdfPath,
                  storedPath,
                  relativePath: path.relative(storageDir, storedPath),
                  fileName,
                  mimeType: 'application/pdf',
                  fileSize: stat.size,
                  contentHash,
                  createdAt: now(),
                  missing: false,
                });
                matched.updatedAt = now();
                supplemented += 1;
              } else {
                duplicates += 1;
              }
              continue;
            }

            library.papers.find((p) => {
              const pNorm = norm(p.title);
              if (pNorm && pNorm.length > 3) {
                const itemShort = itemTitleNorm.slice(0, 20);
                const pShort = pNorm.slice(0, 20);
                if (pShort === itemShort) titleMismatches.push({ zotero: itemTitle.slice(0, 60), library: p.title.slice(0, 60) });
              }
              return false;
            });

            const paperId = id('paper');
            const fileName = safeFileName(fileNameFromPath(item.localPdfPath));
            const storedPath = path.join(storageDir, `${paperId}-${fileName}`);
            await fsp.copyFile(item.localPdfPath, storedPath);
            const stat = await fsp.stat(storedPath);
            library.papers.push({
              id: paperId, title: itemTitle, year: item.year || null,
              publication: null, doi: null, url: null, abstractText: null, keywords: [],
              importedAt: now(), updatedAt: now(), lastReadAt: null, readingProgress: 0,
              isFavorite: false, userNote: null, aiSummary: null, citation: null,
              source: 'zotero',
              sortOrder: Math.min(0, ...library.papers.map((p) => p.sortOrder ?? 0)) - 1,
              authors: item.creators ? [{ id: id('auth'), paperId, name: item.creators, givenName: null, familyName: null, sortOrder: 0 }] : [],
              tags: [], categoryIds: [],
              attachments: [{ id: id('att'), paperId, kind: 'pdf', originalPath: item.localPdfPath, storedPath, relativePath: null, fileName, mimeType: 'application/pdf', fileSize: stat.size, contentHash, createdAt: now(), missing: false }],
            });
            imported += 1;
          } catch (e) { errors += 1; }
        }
      }
      await store.save(library);
      return { total, supplemented, imported, duplicates, errors, skipped, titleMismatches };
    },

    async library_export_bibtex() {
      const library = store.load();
      const entries = library.papers.map((paper) => {
        const authors = paper.authors.map((a) => a.name).join(' and ');
        const year = paper.year || 'n.d.';
        const key = `${paper.authors[0]?.name?.split(' ').pop() || 'Unknown'}${year}${paper.id.slice(-4)}`;
        const lines = [`@article{${key},`];
        if (paper.title) lines.push(`  title = {${paper.title}},`);
        if (authors) lines.push(`  author = {${authors}},`);
        if (paper.year) lines.push(`  year = {${paper.year}},`);
        if (paper.publication) lines.push(`  journal = {${paper.publication}},`);
        if (paper.doi) lines.push(`  doi = {${paper.doi}},`);
        if (paper.url) lines.push(`  url = {${paper.url}},`);
        lines.push('}');
        return lines.join('\n');
      });
      return entries.join('\n\n');
    },

    async library_migrate_all_to_repo() {
      const library = store.load();
      const repoDir = cleanString(library.settings.paperRepoDir);
      if (!repoDir) throw new Error('请先配置文献仓库目录');

      const results = { total: 0, synced: 0, failed: 0, errors: [] };
      for (const paper of library.papers) {
        results.total += 1;
        try {
          await syncSinglePaperToRepo(paper, repoDir, appPaths);
          results.synced += 1;
        } catch (error) {
          results.failed += 1;
          results.errors.push({ id: paper.id, error: String(error) });
        }
      }
      return results;
    },

    async library_batch_rename_tag({ request }) {
      const { sourceTagId, targetName, targetColor } = request ?? {};
      if (!sourceTagId || !targetName) throw new Error('sourceTagId and targetName are required');

      const library = store.load();
      let changed = false;

      for (const paper of library.papers) {
        for (const tag of paper.tags) {
          if (tag.id === sourceTagId) {
            tag.name = targetName.trim();
            if (targetColor) tag.color = targetColor;
            changed = true;
          }
        }
      }

      if (changed) {
        await store.save(library);
      }
    },

    async library_relocate_attachment({ request }) {
      const library = store.load();
      const paper = library.papers.find((item) => item.attachments.some((attachment) => attachment.id === request.attachmentId));
      if (!paper) throw new Error('Attachment does not exist');

      const attachment = paper.attachments.find((item) => item.id === request.attachmentId);
      await ensureFile(request.newPath);
      const stat = await fsp.stat(request.newPath);
      attachment.storedPath = request.newPath;
      attachment.fileName = fileNameFromPath(request.newPath);
      attachment.fileSize = stat.size;
      attachment.contentHash = await hashFile(request.newPath);
      attachment.missing = false;
      paper.updatedAt = now();

      await store.save(library);
      return attachment;
    },

    async library_get_translation({ request }) {
      const { paperId, field, targetLang } = request ?? {};
      if (!paperId || !field || !targetLang) return null;
      const db = new DatabaseSync(appPaths.libraryDatabasePath, { timeout: 3000 });
      try {
        const row = db.prepare(
          'SELECT translated_text, source_lang, updated_at FROM paper_translations WHERE paper_id = ? AND field = ? AND target_lang = ?'
        ).get(paperId, field, targetLang);
        return row ?? null;
      } finally {
        db.close();
      }
    },

    async library_batch_get_translations({ request }) {
      const { paperIds, field, targetLang } = request ?? {};
      if (!paperIds?.length || !field || !targetLang) return {};
      const placeholders = paperIds.map(() => '?').join(',');
      const db = new DatabaseSync(appPaths.libraryDatabasePath, { timeout: 3000 });
      try {
        const rows = db.prepare(
          `SELECT paper_id, translated_text FROM paper_translations WHERE field = ? AND target_lang = ? AND paper_id IN (${placeholders})`
        ).all(field, targetLang, ...paperIds);
        const result = {};
        for (const row of rows) result[row.paper_id] = row.translated_text;
        return result;
      } finally {
        db.close();
      }
    },

    async library_save_translation({ request }) {
      const { paperId, field, sourceLang, targetLang, translatedText } = request ?? {};
      if (!paperId || !field || !targetLang || !translatedText) return;
      const db = new DatabaseSync(appPaths.libraryDatabasePath, { timeout: 3000 });
      try {
        db.prepare(`INSERT INTO paper_translations (paper_id, field, source_lang, target_lang, translated_text, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(paper_id, field, target_lang)
          DO UPDATE SET translated_text = excluded.translated_text, source_lang = excluded.source_lang, updated_at = excluded.updated_at
        `).run(paperId, field, sourceLang ?? null, targetLang, translatedText, Date.now());
      } finally {
        db.close();
      }
    },

    async library_translate_text({ request }) {
      const { provider, text, sourceLang, targetLang, settings } = request ?? {};
      if (!text || !provider) throw new Error('Missing required parameters');
      return doTranslateText(provider, text, sourceLang, targetLang, settings);
    },

    async library_translate_all_titles() {
      const library = store.load();
      const provider = library.settings.translationProvider;
      if (!provider || provider === 'ai' && !library.settings.translationApiKey) {
        throw new Error('请先在设置中配置翻译服务');
      }

      const results = { total: 0, translated: 0, skipped: 0, failed: 0 };
      const filtered = library.papers.filter((p) => p.title?.trim() && p.id);
      results.total = filtered.length;

      const BATCH_SIZE = 3;
      const DELAY_MS = 600;

      for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
        const batch = filtered.slice(i, i + BATCH_SIZE);
        const statuses = await Promise.all(batch.map((p) => translateOnePaperTitle(p, library, appPaths)));
        for (const s of statuses) {
          if (s === 'ok') results.translated += 1;
          else if (s === 'skipped') results.skipped += 1;
          else results.failed += 1;
        }
        if (i + BATCH_SIZE < filtered.length) await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      return results;
    },

    async library_list_all_tags() {
      const library = store.load();
      const tagMap = new Map();
      for (const paper of library.papers) {
        for (const tag of paper.tags) {
          if (!tagMap.has(tag.id)) {
            tagMap.set(tag.id, { id: tag.id, name: tag.name, color: tag.color, paperCount: 0 });
          }
          tagMap.get(tag.id).paperCount += 1;
        }
      }
      return Array.from(tagMap.values()).sort((a, b) => b.paperCount - a.paperCount);
    },

    async lookup_literature_metadata({ request }) {
      const library = store.load();
      const doi = normalizeDoi(request?.doi);
      const title = cleanString(request?.title);
      if (!doi && !title) return null;

      const [openAlexResult, crossrefResult] = await Promise.all([
        lookupOpenAlexMetadata({ doi, title, settings: library.settings }).catch(() => null),
        lookupCrossrefMetadata({ doi, title }).catch(() => null),
      ]);

      return mergeMetadataResults(openAlexResult, crossrefResult);
    },
  };

  return commands;
}

module.exports = { createLibraryCommands };
