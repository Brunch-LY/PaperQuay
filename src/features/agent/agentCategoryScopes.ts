import type { LiteratureCategory, LiteraturePaper } from '../../types/library';

export interface AgentCategoryScopeMatch {
  category: LiteratureCategory;
  path: string;
  papers: LiteraturePaper[];
}

const explicitFullLibrarySignals = [
  '全库',
  '整个文库',
  '全部文献',
  '所有文献',
  '全部论文',
  '所有论文',
  '我的文库',
  'full library',
  'entire library',
  'all papers',
  'all documents',
  'my library',
];

const discoverySignals = [
  '找文献',
  '找出',
  '推荐',
  '相关论文',
  '相关文献',
  '阅读顺序',
  '优先阅读',
  '文献综述',
  '研究脉络',
  '检索',
  'rag',
  '向量',
  'find papers',
  'recommend',
  'related papers',
  'literature review',
  'reading order',
  'retrieve',
];

const writeSignals = [
  '重命名',
  '改名',
  '删除',
  '移动',
  '标签',
  '分类',
  '补全',
  '清理',
  '写入',
  'rename',
  'delete',
  'move',
  'tag',
  'classify',
  'metadata',
  'update',
];

export function hasExplicitFullLibraryScope(instruction: string): boolean {
  const normalized = instruction.toLocaleLowerCase();
  return explicitFullLibrarySignals.some((signal) => normalized.includes(signal));
}

export function shouldUseFullLibraryCandidateSet(instruction: string): boolean {
  const normalized = instruction.toLocaleLowerCase();

  if (hasExplicitFullLibraryScope(instruction)) {
    return true;
  }

  return discoverySignals.some((signal) => normalized.includes(signal)) &&
    !writeSignals.some((signal) => normalized.includes(signal));
}

export function normalizeCategoryScopeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s"'“”‘’`·:：/\\|,，.。;；()[\]{}<>《》-]+/g, '');
}

export function categoryDisplayNameForAgent(category: LiteratureCategory): string {
  switch (category.systemKey) {
    case 'all':
      return '全部文献';
    case 'recent':
      return '最近导入';
    case 'uncategorized':
      return '未分类';
    case 'favorites':
      return '收藏';
    default:
      return category.name;
  }
}

export function categoryAliasesForAgent(category: LiteratureCategory): string[] {
  const aliases = new Set<string>([
    category.name,
    categoryDisplayNameForAgent(category),
  ]);

  switch (category.systemKey) {
    case 'all':
      [
        '全库',
        '整个文库',
        '全部文献',
        '所有文献',
        '全部论文',
        '所有论文',
        'All Papers',
        'full library',
        'all papers',
      ].forEach((alias) => aliases.add(alias));
      break;
    case 'recent':
      [
        '最近导入',
        '最近文献',
        '最近论文',
        'Recently Imported',
        'recent papers',
      ].forEach((alias) => aliases.add(alias));
      break;
    case 'uncategorized':
      [
        '未分类',
        '无分类',
        'Uncategorized',
        'uncategorized papers',
      ].forEach((alias) => aliases.add(alias));
      break;
    case 'favorites':
      ['收藏', '已收藏', 'Favorites', 'favorite papers'].forEach((alias) => aliases.add(alias));
      break;
    default:
      break;
  }

  return [...aliases].map((alias) => alias.trim()).filter(Boolean);
}

export function categoryPathForAgent(
  category: LiteratureCategory,
  categoryById: Map<string, LiteratureCategory>,
  seen = new Set<string>(),
): string {
  const name = categoryDisplayNameForAgent(category);

  if (!category.parentId || seen.has(category.id)) {
    return name;
  }

  seen.add(category.id);
  const parent = categoryById.get(category.parentId);
  return parent ? `${categoryPathForAgent(parent, categoryById, seen)} / ${name}` : name;
}

export function categoryDescendantIds(
  category: LiteratureCategory,
  categories: LiteratureCategory[],
): Set<string> {
  if (category.isSystem) {
    return new Set([category.id]);
  }

  const descendants = new Set([category.id]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const candidate of categories) {
      if (
        !candidate.isSystem &&
        candidate.parentId &&
        descendants.has(candidate.parentId) &&
        !descendants.has(candidate.id)
      ) {
        descendants.add(candidate.id);
        changed = true;
      }
    }
  }

  return descendants;
}

export function papersForCategoryScope(
  category: LiteratureCategory,
  categories: LiteratureCategory[],
  papers: LiteraturePaper[],
): LiteraturePaper[] {
  switch (category.systemKey) {
    case 'all':
      return papers;
    case 'recent':
      return papers.slice().sort((left, right) => right.importedAt - left.importedAt).slice(0, 30);
    case 'uncategorized':
      return papers.filter((paper) => paper.categoryIds.length === 0);
    case 'favorites':
      return papers.filter((paper) => paper.isFavorite);
    default: {
      const allowedCategoryIds = categoryDescendantIds(category, categories);
      return papers.filter((paper) => paper.categoryIds.some((id) => allowedCategoryIds.has(id)));
    }
  }
}

export function findMentionedCategoryScope(
  instruction: string,
  categories: LiteratureCategory[],
  papers: LiteraturePaper[],
): AgentCategoryScopeMatch | null {
  const normalizedInstruction = normalizeCategoryScopeText(instruction);

  if (!normalizedInstruction || categories.length === 0) {
    return null;
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const candidates = categories
    .map((category) => {
      const path = categoryPathForAgent(category, categoryById);
      const aliases = [...categoryAliasesForAgent(category), path];
      const matchLength = Math.max(
        0,
        ...aliases
          .map((alias) => normalizeCategoryScopeText(alias))
          .filter((alias) => alias.length >= 2 && normalizedInstruction.includes(alias))
          .map((alias) => alias.length),
      );

      return { category, path, matchLength };
    })
    .filter((candidate) => candidate.matchLength > 0)
    .sort((left, right) =>
      right.matchLength - left.matchLength ||
      Number(left.category.isSystem) - Number(right.category.isSystem) ||
      right.category.paperCount - left.category.paperCount,
    );

  const match = candidates[0];

  if (!match) {
    return null;
  }

  return {
    category: match.category,
    path: match.path,
    papers: papersForCategoryScope(match.category, categories, papers),
  };
}
