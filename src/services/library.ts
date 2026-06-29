import { invoke } from '../platform/electron/core';
import type {
  AssignPaperCategoryRequest,
  CreateCategoryRequest,
  DeletePaperRequest,
  ImportedPdfResult,
  ImportPdfRequest,
  LibrarySettings,
  LibrarySnapshot,
  ListPapersRequest,
  LiteratureAttachment,
  LiteratureCategory,
  LiteraturePaper,
  LiteratureTag,
  MoveCategoryRequest,
  RelocateAttachmentRequest,
  ReorderPapersRequest,
  UpdatePaperRequest,
  UpdateCategoryRequest,
} from '../types/library';

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

export async function selectLibraryPdfFiles(): Promise<string[]> {
  try {
    return (await invoke<string[] | null>('library_select_pdf_files')) ?? [];
  } catch (error) {
    throw new Error(toErrorMessage(error, '选择 PDF 文件失败'));
  }
}

export async function initializeLiteratureLibrary(): Promise<LibrarySnapshot> {
  try {
    return await invoke<LibrarySnapshot>('library_init');
  } catch (error) {
    throw new Error(toErrorMessage(error, '初始化文献库失败'));
  }
}

export async function getLibrarySettings(): Promise<LibrarySettings> {
  try {
    return await invoke<LibrarySettings>('library_get_settings');
  } catch (error) {
    throw new Error(toErrorMessage(error, '读取文献库设置失败'));
  }
}

export async function updateLibrarySettings(
  settings: LibrarySettings,
): Promise<LibrarySettings> {
  try {
    return await invoke<LibrarySettings>('library_update_settings', { settings });
  } catch (error) {
    throw new Error(toErrorMessage(error, '保存文献库设置失败'));
  }
}

export async function listLibraryCategories(): Promise<LiteratureCategory[]> {
  try {
    return await invoke<LiteratureCategory[]>('library_list_categories');
  } catch (error) {
    throw new Error(toErrorMessage(error, '读取分类失败'));
  }
}

export async function createLibraryCategory(
  request: CreateCategoryRequest,
): Promise<LiteratureCategory> {
  try {
    return await invoke<LiteratureCategory>('library_create_category', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '创建分类失败'));
  }
}

export async function updateLibraryCategory(
  request: UpdateCategoryRequest,
): Promise<LiteratureCategory> {
  try {
    return await invoke<LiteratureCategory>('library_update_category', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '更新分类失败'));
  }
}

export async function moveLibraryCategory(
  request: MoveCategoryRequest,
): Promise<LiteratureCategory> {
  try {
    return await invoke<LiteratureCategory>('library_move_category', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '移动分类失败'));
  }
}

export async function deleteLibraryCategory(categoryId: string): Promise<void> {
  try {
    await invoke('library_delete_category', { categoryId });
  } catch (error) {
    throw new Error(toErrorMessage(error, '删除分类失败'));
  }
}

export async function listLibraryPapers(
  request: ListPapersRequest = {},
): Promise<LiteraturePaper[]> {
  try {
    return await invoke<LiteraturePaper[]>('library_list_papers', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '读取文献列表失败'));
  }
}

export async function reorderLibraryPapers(
  request: ReorderPapersRequest,
): Promise<void> {
  try {
    await invoke('library_reorder_papers', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '保存文献排序失败'));
  }
}

export async function importPdfsToLibrary(
  request: ImportPdfRequest,
): Promise<ImportedPdfResult[]> {
  try {
    return await invoke<ImportedPdfResult[]>('library_import_pdfs', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '导入 PDF 失败'));
  }
}

export async function assignPaperToLibraryCategory(
  request: AssignPaperCategoryRequest,
): Promise<LiteraturePaper> {
  try {
    return await invoke<LiteraturePaper>('library_assign_paper_category', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '移动文献到分类失败'));
  }
}

export async function updateLibraryPaper(
  request: UpdatePaperRequest,
): Promise<LiteraturePaper> {
  try {
    return await invoke<LiteraturePaper>('library_update_paper', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '更新文献信息失败'));
  }
}

export async function deleteLibraryPaper(
  request: DeletePaperRequest,
): Promise<void> {
  try {
    await invoke('library_delete_paper', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '删除文献记录失败'));
  }
}

export async function batchGetPaperTranslations(paperIds: string[], field = 'title', targetLang = 'zh-CN'): Promise<Record<string, string>> {
  try {
    return await invoke('library_batch_get_translations', { request: { paperIds, field, targetLang } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '批量读取翻译失败'));
  }
}

export async function getPaperTranslation(request: {
  paperId: string;
  field: string;
  targetLang: string;
}): Promise<{ translated_text: string; source_lang: string | null; updated_at: number } | null> {
  try {
    return await invoke('library_get_translation', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '读取翻译失败'));
  }
}

export async function savePaperTranslation(request: {
  paperId: string;
  field: string;
  sourceLang?: string;
  targetLang: string;
  translatedText: string;
}): Promise<void> {
  try {
    await invoke('library_save_translation', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '保存翻译失败'));
  }
}

export async function translateTextViaProvider(request: {
  provider: string;
  text: string;
  sourceLang?: string;
  targetLang?: string;
}): Promise<string> {
  const settings = await invoke<any>('library_get_settings');
  try {
    return await invoke<string>('library_translate_text', {
      request: { ...request, settings },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, '翻译失败'));
  }
}

export async function batchDeleteTags(tagIds: string[]): Promise<void> {
  try {
    await invoke('library_batch_delete_tags', { request: { tagIds } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '批量删除标签失败'));
  }
}

export async function batchRenameTag(sourceTagId: string, targetName: string, targetColor?: string): Promise<void> {
  try {
    await invoke('library_batch_rename_tag', { request: { sourceTagId, targetName, targetColor } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '重命名标签失败'));
  }
}

export async function syncPaperToRepo(paperId: string): Promise<void> {
  try {
    await invoke('library_sync_paper_to_repo', { request: { paperId } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '同步文献到仓库失败'));
  }
}

export async function migrateAllToRepo(): Promise<{ total: number; synced: number; failed: number; errors: { id: string; error: string }[] }> {
  try {
    return await invoke('library_migrate_all_to_repo');
  } catch (error) {
    throw new Error(toErrorMessage(error, '迁移全部文献失败'));
  }
}

export async function mergeLibraryCategories(sourceCategoryId: string, targetCategoryId: string): Promise<void> {
  try {
    await invoke('library_merge_categories', { request: { sourceCategoryId, targetCategoryId } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '合并分类失败'));
  }
}

export async function batchDeletePapers(paperIds: string[], deleteFiles = false): Promise<{ deleted: number }> {
  try {
    return await invoke('library_batch_delete_papers', { request: { paperIds, deleteFiles } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '批量删除文献失败'));
  }
}

export async function fetchZoteroPdf(paperId: string, dataDir: string): Promise<{ ok: boolean; fileName?: string; error?: string }> {
  try {
    return await invoke('library_fetch_zotero_pdf', { request: { paperId, dataDir } });
  } catch (error) {
    throw new Error(toErrorMessage(error, '从 Zotero 获取 PDF 失败'));
  }
}

export async function zoteroSupplement(request: { dataDir: string; collectionKeys: string[] }): Promise<{ total: number; supplemented: number; imported: number; duplicates: number; errors: number; skipped: number; titleMismatches: { zotero: string; library: string }[] }> {
  try {
    return await invoke('library_zotero_supplement', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Zotero 补充 PDF 失败'));
  }
}

export async function findDuplicatePapers(): Promise<{ totalDuplicates: number; groups: { type: string; value?: string; entries: { id: string; title: string; norm?: string; authors: string; year: string; doi: string }[] }[] }> {
  try {
    return await invoke('library_find_duplicates');
  } catch (error) {
    throw new Error(toErrorMessage(error, '查找重复文献失败'));
  }
}

export async function exportBibtex(): Promise<string> {
  try {
    return await invoke<string>('library_export_bibtex');
  } catch (error) {
    throw new Error(toErrorMessage(error, '导出 BibTeX 失败'));
  }
}

export async function translateAllTitles(): Promise<{ total: number; translated: number; skipped: number; failed: number }> {
  try {
    return await invoke('library_translate_all_titles');
  } catch (error) {
    throw new Error(toErrorMessage(error, '批量翻译标题失败'));
  }
}

export async function listAllTags(): Promise<LiteratureTag[]> {
  try {
    return await invoke<LiteratureTag[]>('library_list_all_tags');
  } catch (error) {
    throw new Error(toErrorMessage(error, '读取标签列表失败'));
  }
}

export async function relocateLibraryAttachment(
  request: RelocateAttachmentRequest,
): Promise<LiteratureAttachment> {
  try {
    return await invoke<LiteratureAttachment>('library_relocate_attachment', { request });
  } catch (error) {
    throw new Error(toErrorMessage(error, '重新定位 PDF 文件失败'));
  }
}
