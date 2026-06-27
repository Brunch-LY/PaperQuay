const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');
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
          const duplicate = library.papers.find((paper) =>
            paper.attachments.some((attachment) => attachment.contentHash === contentHash),
          );

          if (duplicate) {
            results.push({ sourcePath, paper: duplicate, duplicated: true, existingPaperId: duplicate.id, status: 'duplicate', message: 'Duplicate PDF' });
            continue;
          }

          const metadata = request.metadata?.[sourcePath] ?? {};
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

      const source = sourceLang || 'auto';
      const target = targetLang || 'zh';

      if (provider === 'baidu') {
        const appid = settings?.translationAppId || '';
        const secretKey = settings?.translationSecretKey || '';
        if (!appid || !secretKey) throw new Error('Baidu Translate requires APP ID and Secret Key');

        const salt = String(Date.now());
        const sign = crypto.createHash('md5').update(`${appid}${text}${salt}${secretKey}`).digest('hex');
        const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=${source}&to=${target}&appid=${appid}&salt=${salt}&sign=${sign}`;

        const response = await fetch(url);
        const data = await response.json();
        if (data.error_code && data.error_code !== '0') throw new Error(`Baidu Translate error: ${data.error_code} ${data.error_msg || ''}`);
        return data.trans_result?.[0]?.dst ?? text;
      }

      if (provider === 'google') {
        const apiKey = settings?.translationApiKey || '';
        if (!apiKey) throw new Error('Google Translate requires API Key');

        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, source, target, format: 'text' }),
        });
        const data = await response.json();
        if (data.error) throw new Error(`Google Translate error: ${data.error.message}`);
        return data.data?.translations?.[0]?.translatedText ?? text;
      }

      if (provider === 'deepl') {
        const apiKey = settings?.translationApiKey || '';
        if (!apiKey) throw new Error('DeepL requires API Key');

        const url = `https://api-free.deepl.com/v2/translate`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ auth_key: apiKey, text, source_lang: source.toUpperCase(), target_lang: target.toUpperCase() }),
        });
        const data = await response.json();
        if (data.message) throw new Error(`DeepL error: ${data.message}`);
        return data.translations?.[0]?.text ?? text;
      }

      if (provider === 'aliyun') {
        const accessKey = settings?.translationApiKey || '';
        const secretKey = settings?.translationSecretKey || '';
        if (!accessKey || !secretKey) throw new Error('Alibaba Cloud Translate requires Access Key and Secret Key');

        const url = 'https://mt.cn-hangzhou.aliyuncs.com/api/translate/web/general';
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessKey}` },
          body: JSON.stringify({ SourceText: text, SourceLanguage: source, TargetLanguage: target, FormatType: 'text' }),
        });
        const data = await response.json();
        if (data.Code !== 'OK') throw new Error(`Alibaba Cloud Translate error: ${data.Message || data.Code}`);
        return data.Data?.Translated ?? text;
      }

      if (provider === 'tencent') {
        const secretId = settings?.translationApiKey || '';
        const secretKey = settings?.translationSecretKey || '';
        if (!secretId || !secretKey) throw new Error('Tencent Cloud Translate requires SecretId and SecretKey');

        const url = 'https://tmt.tencentcloudapi.com';
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-TC-Action': 'TextTranslate', 'X-TC-Region': 'ap-guangzhou' },
          body: JSON.stringify({ SourceText: text, Source: source, Target: target, ProjectId: 0 }),
        });
        const data = await response.json();
        if (data.Response?.Error) throw new Error(`Tencent Cloud error: ${data.Response.Error.Message}`);
        return data.Response?.TargetText ?? text;
      }

      if (provider === 'volc') {
        const accessKey = settings?.translationApiKey || '';
        const secretKey = settings?.translationSecretKey || '';
        if (!accessKey || !secretKey) throw new Error('Volcano Engine requires Access Key and Secret Key');

        const url = 'https://translate.volcengineapi.com';
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ SourceLanguage: source, TargetLanguage: target, TextList: [text] }),
        });
        const data = await response.json();
        if (data.ResponseMetadata?.Error) throw new Error(`Volcano Engine error: ${data.ResponseMetadata.Error.Message}`);
        return data.TranslationList?.[0]?.Translation ?? text;
      }

      throw new Error(`Unsupported translation provider: ${provider}`);
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
