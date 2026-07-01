import { useCallback, useRef, useState } from 'react';
import {
  BookOpenText,
  CheckCircle2,
  Cloud,
  Database,
  FolderOpen,
  Languages,
  Library,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';

import { openExternalUrl, getReaderPresetConfig, testEmbeddingConnection } from '../../services/desktop';
import { exportBibtex, getLibrarySettings, getPaperTranslation, listLibraryPapers, migrateAllToRepo, savePaperTranslation, translateTextViaProvider } from '../../services/library';
import { resolveSummaryOutputLanguage } from '../../services/summarySource';
import type { LibraryImportMode, LibrarySettings, LiteraturePaper, TranslationModelPreset } from '../../types/library';
import type { ReaderSettings } from '../../types/reader';
import {
  buildLanguageOptions,
  buildQaSourceOptions,
  buildRagSourceOptions,
  buildSummaryLanguageOptions,
  buildSummarySourceOptions,
  clampBatchConcurrency,
  EMPTY_BATCH_PROGRESS,
  resolveModelPreset,
  sleep,
  type BatchProgressState,
  type PreferencesSectionKey,
} from './readerShared';
import {
  BatchProgressCard,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  ToggleRow,
} from './readerPreferencesPrimitives';
import { ReaderPreferencesBackupSection } from './readerPreferencesBackupSection';
import { ReaderPreferencesModelsSection } from './readerPreferencesModelsSection';
import { ReaderPreferencesUpdateSection } from './readerPreferencesUpdateSection';
import type {
  ReaderPreferencesLocalizer,
  ReaderPreferencesSectionDescriptor,
  ReaderPreferencesWindowProps,
} from './readerPreferencesTypes';

interface ReaderPreferencesContentProps
  extends Pick<
    ReaderPreferencesWindowProps,
    | 'settings'
    | 'librarySettings'
    | 'zoteroLocalDataDir'
    | 'mineruApiToken'
    | 'embeddingApiKey'
    | 'qaModelPresets'
    | 'zoteroApiKey'
    | 'zoteroUserId'
    | 'libraryLoading'
    | 'translating'
    | 'onSettingChange'
    | 'onNativeLibrarySettingsChange'
    | 'onSelectLibraryStorageDir'
    | 'onSelectPaperRepoDir'
    | 'onZoteroLocalDataDirChange'
    | 'onMineruApiTokenChange'
    | 'onEmbeddingApiKeyChange'
    | 'onZoteroApiKeyChange'
    | 'onZoteroUserIdChange'
    | 'onDetectLocalZotero'
    | 'onSelectLocalZoteroDir'
    | 'onReloadLocalZotero'
    | 'onImportLocalZotero'
    | 'onEnrichAllLibraryMetadata'
    | 'onSelectMineruCacheDir'
    | 'onSelectRemotePdfDownloadDir'
    | 'onListLlmModels'
    | 'onTestLlmConnection'
    | 'onQaModelPresetAdd'
    | 'onQaModelPresetRemove'
    | 'onQaModelPresetChange'
    | 'onTranslate'
    | 'onCancelTranslate'
    | 'onClearTranslations'
    | 'onBatchMineruParse'
    | 'onBatchGenerateSummaries'
    | 'onToggleBatchMineruPause'
    | 'onCancelBatchMineru'
    | 'onToggleBatchSummaryPause'
    | 'onCancelBatchSummary'
    | 'batchMineruRunning'
    | 'batchSummaryRunning'
    | 'batchMineruPaused'
    | 'batchSummaryPaused'
    | 'batchMineruProgress'
    | 'batchSummaryProgress'
    | 'batchError'
  > {
  activeSection: PreferencesSectionKey;
  l: ReaderPreferencesLocalizer;
}

const DEFAULT_LIBRARY_SETTINGS: LibrarySettings = {
  storageDir: '',
  zoteroLocalDataDir: '',
  importMode: 'copy',
  autoRenameFiles: true,
  fileNamingRule: '{author}_{year}_{title}',
  createCategoryFolders: false,
  folderWatchEnabled: false,
  backupEnabled: false,
  preserveOriginalPath: true,
  openAlexEnabled: true,
  openAlexApiKey: '',
  openAlexMailto: '',
  translationProvider: 'ai',
  translationApiKey: '',
  translationBaseUrl: '',
  translationModel: 'gpt-4o-mini',
  translationAppId: '',
  translationSecretKey: '',
  paperRepoDir: '',
  translationPresets: [],
  titleTranslationPresetId: '',
};

export function buildReaderPreferencesSections(
  l: ReaderPreferencesLocalizer,
): ReaderPreferencesSectionDescriptor[] {
  return [
    {
      key: 'general',
      title: l('通用', 'General'),
      description: l(
        '语言、主题和基础应用行为',
        'Language, theme, and basic application behavior',
      ),
      icon: <Settings2 className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'library',
      title: l('文库与 Zotero', 'Library & Zotero'),
      description: l('Zotero、本地路径和 PDF 来源', 'Zotero, local paths, and PDF sources'),
      icon: <Library className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'reading',
      title: l('阅读显示', 'Reader Display'),
      description: l(
        '联动、滚动、布局和结构块显示',
        'Linking, scrolling, layout, and block display',
      ),
      icon: <BookOpenText className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'mineru',
      title: 'MinerU',
      description: l(
        'API Key、缓存、自动解析和批量任务',
        'API key, cache, auto parse, and batch jobs',
      ),
      icon: <Database className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'backup',
      title: l('备份 / WebDAV', 'Backup / WebDAV'),
      description: l(
        '配置手动远程副本、连接测试和立即备份',
        'Configure manual remote copies, connection test, and backup now',
      ),
      icon: <Cloud className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'translation',
      title: l('翻译', 'Translation'),
      description: l(
        '全文翻译、划词翻译、语言和吞吐',
        'Full translation, selection translation, languages, and throughput',
      ),
      icon: <Sparkles className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'models',
      title: l('AI 模型', 'AI Models'),
      description: l(
        'OpenAI 兼容模型预设和测试',
        'OpenAI-compatible model presets and tests',
      ),
      icon: <Sparkles className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'embedding',
      title: l('Embedding', 'Embedding'),
      description: l(
        '为本地 RAG 单独配置向量模型的 Base URL、API Key 和 Model',
        'Configure a dedicated embedding Base URL, API key, and model for local RAG.',
      ),
      icon: <Database className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'summaryQa',
      title: l('概览与问答', 'Overview & QA'),
      description: l(
        '概览输入、批量概览和问答上下文',
        'Overview input, batch overview, and QA context',
      ),
      icon: <Database className="h-4 w-4" strokeWidth={1.8} />,
    },
    {
      key: 'updates',
      title: l('软件更新', 'Software Updates'),
      description: l(
        '检查 GitHub 发布版本并安装更新',
        'Check GitHub releases and install updates',
      ),
      icon: <RefreshCw className="h-4 w-4" strokeWidth={1.8} />,
    },
  ];
}

export function ReaderPreferencesContent({
  activeSection,
  l,
  settings,
  librarySettings,
  zoteroLocalDataDir,
  mineruApiToken,
  embeddingApiKey,
  qaModelPresets,
  zoteroApiKey,
  zoteroUserId,
  libraryLoading,
  translating = false,
  onSettingChange,
  onNativeLibrarySettingsChange,
  onSelectLibraryStorageDir,
  onSelectPaperRepoDir,
  onZoteroLocalDataDirChange,
  onMineruApiTokenChange,
  onEmbeddingApiKeyChange,
  onZoteroApiKeyChange,
  onZoteroUserIdChange,
  onDetectLocalZotero,
  onSelectLocalZoteroDir,
  onReloadLocalZotero,
  onImportLocalZotero,
  onEnrichAllLibraryMetadata,
  onSelectMineruCacheDir,
  onSelectRemotePdfDownloadDir,
  onListLlmModels,
  onTestLlmConnection,
  onQaModelPresetAdd,
  onQaModelPresetRemove,
  onQaModelPresetChange,
  onTranslate,
  onCancelTranslate,
  onClearTranslations,
  onBatchMineruParse,
  onBatchGenerateSummaries,
  onToggleBatchMineruPause,
  onCancelBatchMineru,
  onToggleBatchSummaryPause,
  onCancelBatchSummary,
  batchMineruRunning = false,
  batchSummaryRunning = false,
  batchMineruPaused = false,
  batchSummaryPaused = false,
  batchMineruProgress,
  batchSummaryProgress,
  batchError,
}: ReaderPreferencesContentProps) {
  const languageOptions = buildLanguageOptions(settings.uiLanguage);
  const summaryLanguageOptions = buildSummaryLanguageOptions(settings.uiLanguage);
  const summarySourceOptions = buildSummarySourceOptions(settings.uiLanguage);
  const qaSourceOptions = buildQaSourceOptions(settings.uiLanguage);
  const ragSourceOptions = buildRagSourceOptions(settings.uiLanguage);
  const resolvedSummaryLanguage = resolveSummaryOutputLanguage(settings);
  const activeSummaryPreset = resolveModelPreset(
    qaModelPresets,
    settings.summaryModelPresetId,
  );
  const canTriggerTranslate = Boolean(onTranslate);
  const canCancelTranslate = Boolean(onCancelTranslate);
  const canClearTranslations = Boolean(onClearTranslations);
  const activeLibrarySettings = librarySettings ?? DEFAULT_LIBRARY_SETTINGS;
  const updateLibrarySetting = <Key extends keyof LibrarySettings>(
    key: Key,
    value: LibrarySettings[Key],
  ) => {
    onNativeLibrarySettingsChange({ [key]: value } as Partial<LibrarySettings>);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {activeSection === 'general' ? (
        <SettingsField
          label={l('软件语言', 'Software Language')}
          description={l(
            '切换后，主界面与设置界面会同步切换中英文。',
            'Switch the main interface and settings between Chinese and English.',
          )}
        >
          <SettingsSelect
            value={settings.uiLanguage}
            onChange={(event) =>
              onSettingChange('uiLanguage', event.target.value as ReaderSettings['uiLanguage'])
            }
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </SettingsSelect>
        </SettingsField>
      ) : null}

      {activeSection === 'library' ? (
        <>
          <SettingsField
            label={l('默认文献存储文件夹', 'Default paper storage folder')}
            description={l(
              '复制或移动导入 PDF 时，文件会进入这个文件夹；保留原路径模式不会复制文件。',
              'When import mode is copy or move, PDFs are placed here. Keep-path mode does not copy files.',
            )}
          >
            <SettingsInput
              value={activeLibrarySettings.storageDir}
              onChange={(event) => updateLibrarySetting('storageDir', event.target.value)}
              placeholder={l('选择一个用于集中管理 PDF 的本地文件夹', 'Choose a local folder for managed PDFs')}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSelectLibraryStorageDir}
                disabled={libraryLoading}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:bg-[var(--pq-surface-2)] dark:text-[var(--pq-text)] dark:hover:bg-[var(--pq-hover)]"
              >
                <FolderOpen className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                {l('选择目录', 'Select Directory')}
              </button>
              <button
                type="button"
                onClick={onEnrichAllLibraryMetadata}
                disabled={libraryLoading}
                className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-500 disabled:opacity-60 dark:bg-[var(--pq-accent-button-bg)] dark:text-[var(--pq-accent-button-text)]"
              >
                <Database className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                {l('解析全部元数据', 'Parse All Metadata')}
              </button>
            </div>
          </SettingsField>

          <SettingsField
            label={l('OpenAlex 元数据源', 'OpenAlex metadata source')}
            description={l(
              '导入和批量解析会优先查询 OpenAlex，再使用 Crossref 兜底。API Key 可选；mailto 有助于进入 OpenAlex polite pool。',
              'Import and batch parsing query OpenAlex first, with Crossref fallback. API key is optional; mailto helps OpenAlex place requests in the polite pool.',
            )}
          >
            <ToggleRow
              title={l('启用 OpenAlex', 'Enable OpenAlex')}
              description={l(
                '关闭后将跳过 OpenAlex，只使用其他可用的元数据来源。',
                'When disabled, PaperQuay skips OpenAlex and uses other available metadata sources.',
              )}
              checked={activeLibrarySettings.openAlexEnabled}
              onChange={(checked) => updateLibrarySetting('openAlexEnabled', checked)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-[var(--pq-text-muted)]">
                  {l('OpenAlex API Key（可选）', 'OpenAlex API Key (optional)')}
                </div>
                <SettingsInput
                  value={activeLibrarySettings.openAlexApiKey}
                  onChange={(event) => updateLibrarySetting('openAlexApiKey', event.target.value)}
                  type="password"
                  placeholder={l('Premium key，可留空', 'Premium key, can be empty')}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-[var(--pq-text-muted)]">
                  {l('OpenAlex mailto（推荐）', 'OpenAlex mailto (recommended)')}
                </div>
                <SettingsInput
                  value={activeLibrarySettings.openAlexMailto}
                  onChange={(event) => updateLibrarySetting('openAlexMailto', event.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            </div>
          </SettingsField>

          <SettingsField
            label={l('导入文件处理', 'Import file handling')}
            description={l(
              '复制最安全；移动会整理原文件；保留原路径适合只建立索引。Zotero 导入通常建议使用复制。',
              'Copy is safest. Move organizes original files. Keep path indexes files without copying. Copy is usually best for Zotero imports.',
            )}
          >
            <SettingsSelect
              value={activeLibrarySettings.importMode}
              onChange={(event) =>
                updateLibrarySetting('importMode', event.target.value as LibraryImportMode)
              }
            >
              <option value="copy">{l('复制到文献库文件夹', 'Copy into library folder')}</option>
              <option value="move">{l('移动到文献库文件夹', 'Move into library folder')}</option>
              <option value="keep">{l('保留原路径', 'Keep original path')}</option>
            </SettingsSelect>
            <SettingsInput
              value={activeLibrarySettings.fileNamingRule}
              onChange={(event) => updateLibrarySetting('fileNamingRule', event.target.value)}
              placeholder="{author}_{year}_{title}"
              className="font-mono"
            />
          </SettingsField>

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow
              title={l('自动重命名 PDF', 'Automatically rename PDFs')}
              description={l('导入时按命名规则生成更稳定的文件名。', 'Generate stable filenames during import.')}
              checked={activeLibrarySettings.autoRenameFiles}
              onChange={(checked) => updateLibrarySetting('autoRenameFiles', checked)}
            />
            <ToggleRow
              title={l('保留原始路径记录', 'Preserve original path')}
              description={l('复制后仍记录来源路径，便于追溯。', 'Keep the source path after copying for traceability.')}
              checked={activeLibrarySettings.preserveOriginalPath}
              onChange={(checked) => updateLibrarySetting('preserveOriginalPath', checked)}
            />
            <ToggleRow
              title={l('按分类创建文件夹', 'Create category folders')}
              description={l('导入时按目标分类组织子文件夹。', 'Organize imported files into category folders.')}
              checked={activeLibrarySettings.createCategoryFolders}
              onChange={(checked) => updateLibrarySetting('createCategoryFolders', checked)}
            />
            <ToggleRow
              title={l('监听文件夹', 'Folder watch')}
              description={l('监听新 PDF 并送入导入队列。', 'Watch for new PDFs and send them to the import queue.')}
              checked={activeLibrarySettings.folderWatchEnabled}
              onChange={(checked) => updateLibrarySetting('folderWatchEnabled', checked)}
            />
          </div>

          <div data-tour="zotero-settings">
            <SettingsField
              label={l('Zotero 本地数据目录', 'Zotero Local Data Directory')}
              description={l(
                '用于读取 Zotero 附件与分类树，目录中应包含 zotero.sqlite。',
                'Used to read Zotero attachments and collection trees. The directory should contain zotero.sqlite.',
              )}
            >
              <SettingsInput
                value={zoteroLocalDataDir}
                onChange={(event) => onZoteroLocalDataDirChange(event.target.value)}
                placeholder={l(
                  '例如 C:\\Users\\Lenovo\\Zotero',
                  'Example: C:\\Users\\Lenovo\\Zotero',
                )}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onDetectLocalZotero}
                  disabled={libraryLoading}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {l('自动查找', 'Auto Detect')}
                </button>
                <button
                  type="button"
                  onClick={onSelectLocalZoteroDir}
                  disabled={libraryLoading}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {l('选择目录', 'Select Directory')}
                </button>
                <button
                  type="button"
                  onClick={onReloadLocalZotero}
                  disabled={libraryLoading}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {l('重新读取', 'Reload')}
                </button>
                <button
                  type="button"
                  onClick={onImportLocalZotero}
                  disabled={libraryLoading}
                  className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-500 disabled:opacity-60 dark:bg-[var(--pq-accent)] dark:text-[var(--pq-accent-text)] dark:hover:bg-[var(--pq-accent-soft)]"
                >
                  {l('读取并导入本地文库', 'Read and Import to Library')}
                </button>
              </div>
            </SettingsField>

            <ExportBibtexButton l={l} />
          </div>

          <ToggleRow
            title={l('文库显示阅读热力', 'Show Reading Heat in Library')}
            description={l(
              '在“我的文库”条目右侧显示 PDF 阅读停留分布。',
              'Show PDF reading-time distribution on the right side of library rows.',
            )}
            checked={settings.showLibraryReadingHeatmap}
            onChange={(checked) => onSettingChange('showLibraryReadingHeatmap', checked)}
          />

          <SettingsField
            label={l('Zotero Web 回退', 'Zotero Web Fallback')}
            description={l(
              '当本地 PDF 缺失时，通过 Zotero Web API 回退获取附件。',
              'When the local PDF is missing, fetch the attachment through the Zotero Web API fallback.',
            )}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">API Key</div>
                <SettingsInput
                  value={zoteroApiKey}
                  onChange={(event) => onZoteroApiKeyChange(event.target.value)}
                  type="password"
                  placeholder={l(
                    '仅在本地 PDF 缺失时填写 API Key',
                    'Only required when the local PDF is missing.',
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">User ID</div>
                <SettingsInput
                  value={zoteroUserId}
                  onChange={(event) => onZoteroUserIdChange(event.target.value)}
                  placeholder={l(
                    '可留空，首次回退时自动获取',
                    'Optional. Auto-detected on first fallback.',
                  )}
                />
              </div>
            </div>
          </SettingsField>

          <SettingsField
            label={l('远程 PDF 下载目录', 'Remote PDF Download Directory')}
            description={l(
              '当通过 Zotero Web 获取 PDF 时，保存到此目录。',
              'When downloading PDFs through Zotero Web, save them to this directory.',
            )}
          >
            <SettingsInput
              value={settings.remotePdfDownloadDir}
              onChange={(event) => onSettingChange('remotePdfDownloadDir', event.target.value)}
              placeholder={l(
                '选择本地目录保存下载的 PDF',
                'Choose a local directory for downloaded PDFs',
              )}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSelectRemotePdfDownloadDir}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <FolderOpen className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                {l('选择目录', 'Select Directory')}
              </button>
              <button
                type="button"
                onClick={() => onSettingChange('remotePdfDownloadDir', '')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {l('清空路径', 'Clear Path')}
              </button>
            </div>
          </SettingsField>
        </>
      ) : null}

      {activeSection === 'reading' ? (
        <>
          <ToggleRow
            title={l('自动加载同名 JSON', 'Auto Load Sibling JSON')}
            description={l(
              '打开 PDF 时，自动尝试加载同目录下对应的 content_list_v2.json。',
              'When opening a PDF, automatically try to load the matching content_list_v2.json from the same directory.',
            )}
            checked={settings.autoLoadSiblingJson}
            onChange={(checked) => onSettingChange('autoLoadSiblingJson', checked)}
          />
          <ToggleRow
            title={l('平滑滚动联动', 'Smooth Linked Scrolling')}
            description={l(
              '在 PDF 与结构块之间联动时，使用更平滑的滚动定位。',
              'Use smoother scrolling when navigating between the PDF and structured blocks.',
            )}
            checked={settings.smoothScroll}
            onChange={(checked) => onSettingChange('smoothScroll', checked)}
          />
          <ToggleRow
            title={l('统计 PDF 阅读热力', 'Track PDF Reading Heat')}
            description={l(
              '记录 PDF 不同位置的停留时长，用于阅读热力进度和文库阅读概览。',
              'Record time spent at different PDF positions for the reading heat progress and library overview.',
            )}
            checked={settings.enablePdfReadingHeatmap}
            onChange={(checked) => onSettingChange('enablePdfReadingHeatmap', checked)}
          />
          <ToggleRow
            title={l('紧凑阅读模式', 'Compact Reading Mode')}
            description={l(
              '压缩结构块列表的间距，适合长文快速通读。',
              'Reduce block spacing for faster reading in long documents.',
            )}
            checked={settings.compactReading}
            onChange={(checked) => onSettingChange('compactReading', checked)}
          />
          <ToggleRow
            title={l('显示块元信息', 'Show Block Metadata')}
            description={l(
              '在结构块中显示页码、类型等辅助信息。',
              'Show page numbers, block types, and related metadata in the block view.',
            )}
            checked={settings.showBlockMeta}
            onChange={(checked) => onSettingChange('showBlockMeta', checked)}
          />
          <ToggleRow
            title={l('隐藏页眉页脚类块', 'Hide Page Decoration Blocks')}
            description={l(
              '在右侧结构块视图中隐藏 page_number、page_footer 等页面装饰内容。',
              'Hide page_header, page_footer, page_number, page_footnote, and similar decorative content from the block view.',
            )}
            checked={settings.hidePageDecorationsInBlockView}
            onChange={(checked) =>
              onSettingChange('hidePageDecorationsInBlockView', checked)
            }
          />
          <ToggleRow
            title={l('柔和页面阴影', 'Soft Page Shadow')}
            description={l(
              '为 PDF 页面添加更轻的阴影层次。',
              'Render PDF pages with a softer shadow treatment.',
            )}
            checked={settings.softPageShadow}
            onChange={(checked) => onSettingChange('softPageShadow', checked)}
          />
        </>
      ) : null}

      {activeSection === 'mineru' ? (
        <>
          <SettingsField
            label="MinerU API Token"
            description={
              <span>
                {l(
                  '配置后可将本地 PDF 发送给 MinerU 并生成结构化 JSON。可前往 ',
                  'Configure this to send local PDFs to MinerU and generate structured JSON. Visit ',
                )}
                <button
                  type="button"
                  onClick={() => void openExternalUrl('https://mineru.net/')}
                  className="font-semibold text-sky-600 underline decoration-sky-300 underline-offset-2 transition hover:text-sky-700 dark:text-sky-300 dark:decoration-sky-500/70 dark:hover:text-sky-200"
                >
                  https://mineru.net/
                </button>
                {l(' 获取或管理免费 API Key。', ' to get or manage your free API key.')}
              </span>
            }
          >
            <SettingsInput
              value={mineruApiToken}
              onChange={(event) => onMineruApiTokenChange(event.target.value)}
              type="password"
              placeholder={l('输入 MinerU API Token', 'Enter MinerU API Token')}
            />
          </SettingsField>

          <SettingsField
            label={l('MinerU 缓存目录', 'MinerU Cache Directory')}
            description={l(
              '用于保存 content_list_v2.json、middle.json、full.md 与 manifest 等解析产物。',
              'Stores content_list_v2.json, middle.json, full.md, manifest, and related parse outputs.',
            )}
          >
            <SettingsInput
              value={settings.mineruCacheDir}
              onChange={(event) => onSettingChange('mineruCacheDir', event.target.value)}
              placeholder={l(
                '选择一个本地目录保存 MinerU 结果',
                'Choose a local directory to store MinerU outputs',
              )}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSelectMineruCacheDir}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <FolderOpen className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                {l('选择目录', 'Select Directory')}
              </button>
              <button
                type="button"
                onClick={() => onSettingChange('mineruCacheDir', '')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {l('清空路径', 'Clear Path')}
              </button>
            </div>
          </SettingsField>

          <SettingsField
            label={l('文献仓库目录', 'Paper Repository Directory')}
            description={l(
              'MinerU 解析完成后自动同步 full.md 和元数据到该目录，供其他工具或 Agent 读取。',
              'Syncs full.md and metadata here after MinerU parsing, for other tools and Agents to consume.',
            )}
          >
            <SettingsInput
              value={activeLibrarySettings.paperRepoDir}
              onChange={(event) => updateLibrarySetting('paperRepoDir', event.target.value)}
              placeholder={l(
                '选择一个共享目录作为文献仓库',
                'Choose a shared directory for the paper repository',
              )}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSelectPaperRepoDir}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <FolderOpen className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                {l('选择目录', 'Select Directory')}
              </button>
              <button
                type="button"
                onClick={() => updateLibrarySetting('paperRepoDir', '')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {l('清空路径', 'Clear Path')}
              </button>
            </div>

            <MigrateRepoButton
              repoDir={activeLibrarySettings.paperRepoDir}
              l={l}
            />
          </SettingsField>

          <SettingsField
            label={l('MinerU 自动解析与批量任务', 'MinerU Automation and Batch Jobs')}
            description={l(
              '控制 MinerU 自动解析、批量解析和并发数。',
              'Control MinerU auto parsing, batch parsing, and concurrency.',
            )}
          >
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">
                    {l('MinerU 批处理并发数', 'MinerU Batch Concurrency')}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {l(
                      '控制批量 MinerU 解析的并发度，数值过高可能导致限流或性能波动。',
                      'Controls batch MinerU parse concurrency. Values that are too high may cause rate limits or unstable performance.',
                    )}
                  </div>
                </div>
                <SettingsInput
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  value={String(settings.libraryBatchConcurrency)}
                  onChange={(event) =>
                    onSettingChange(
                      'libraryBatchConcurrency',
                      clampBatchConcurrency(Number(event.target.value)),
                    )
                  }
                />
              </div>
              <ToggleRow
                title={l('自动执行 MinerU 解析', 'Auto Run MinerU Parse')}
                description={l(
                  '检测到可处理 PDF 时自动触发 MinerU 解析。',
                  'Automatically trigger MinerU parsing when a processable PDF is detected.',
                )}
                checked={settings.autoMineruParse}
                onChange={(checked) => onSettingChange('autoMineruParse', checked)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBatchMineruParse}
                  disabled={batchMineruRunning}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {batchMineruRunning
                    ? l('处理中...', 'Processing...')
                    : l('启动 MinerU 批量解析', 'Start MinerU Batch Parse')}
                </button>
                {batchMineruRunning ? (
                  <button
                    type="button"
                    onClick={onToggleBatchMineruPause}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    {batchMineruPaused ? l('继续', 'Resume') : l('暂停', 'Pause')}
                  </button>
                ) : null}
                {batchMineruRunning ? (
                  <button
                    type="button"
                    onClick={onCancelBatchMineru}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600 transition hover:bg-rose-100"
                  >
                    {l('取消', 'Cancel')}
                  </button>
                ) : null}
              </div>
              {batchError ? (
                <div className="mt-2 rounded-lg border border-rose-300/50 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {batchError}
                </div>
              ) : null}
              <BatchProgressCard
                title={l('MinerU 批量解析进度', 'MinerU Batch Progress')}
                progress={batchMineruProgress}
                tone="indigo"
              />
            </div>
          </SettingsField>
        </>
      ) : null}

      <ReaderPreferencesModelsSection
        active={activeSection === 'models'}
        l={l}
        uiLanguage={settings.uiLanguage}
        settings={settings}
        qaModelPresets={qaModelPresets}
        onSettingChange={onSettingChange}
        onListLlmModels={onListLlmModels}
        onTestLlmConnection={onTestLlmConnection}
        onQaModelPresetAdd={onQaModelPresetAdd}
        onQaModelPresetRemove={onQaModelPresetRemove}
        onQaModelPresetChange={onQaModelPresetChange}
      />

      <ReaderPreferencesBackupSection
        active={activeSection === 'backup'}
        l={l}
      />

      <ReaderPreferencesUpdateSection
        active={activeSection === 'updates'}
        l={l}
      />

      {activeSection === 'embedding' ? (
        <SettingsField
          label={l('本地 RAG Embedding 配置', 'Local RAG Embedding Configuration')}
          description={l(
            '本地 RAG 会只读取这里的 Base URL、API Key 和 Model，不再复用 AI 模型预设。',
            'Local RAG reads only the Base URL, API key, and model configured here instead of the shared AI model presets.',
          )}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-slate-500">
                {l('Base URL', 'Base URL')}
              </div>
              <SettingsInput
                value={settings.embeddingBaseUrl}
                onChange={(event) => onSettingChange('embeddingBaseUrl', event.target.value)}
                placeholder="https://api.openai.com"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-slate-500">API Key</div>
              <SettingsInput
                value={embeddingApiKey}
                onChange={(event) => onEmbeddingApiKeyChange(event.target.value)}
                type="password"
                placeholder={l(
                  '输入 embedding 服务对应的 API Key',
                  'Enter the API key for the embedding service',
                )}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-slate-500">
                {l('Model', 'Model')}
              </div>
              <SettingsInput
                value={settings.embeddingModel}
                onChange={(event) => onSettingChange('embeddingModel', event.target.value)}
                placeholder="text-embedding-3-small / Qwen/Qwen3-Embedding-8B"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">
                {l('Dimensions', 'Dimensions')}
              </div>
              <SettingsInput
                type="number"
                min={0}
                max={4096}
                value={settings.embeddingDimensions ?? ''}
                onChange={(event) =>
                  onSettingChange(
                    'embeddingDimensions',
                    event.target.value.trim()
                      ? Math.max(1, Math.min(4096, Number(event.target.value) || 0))
                      : null,
                  )
                }
                placeholder={l('留空表示使用服务默认维度', 'Leave empty to use the provider default')}
              />
              <div className="text-[11px] leading-5 text-slate-400">
                {l(
                  '只有服务支持 `dimensions` 参数时才会生效；修改后会使用新的索引键。',
                  'Only used when the provider supports the `dimensions` field. Changes produce a new index key.',
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">
                {l('请求超时（秒）', 'Request Timeout (s)')}
              </div>
              <SettingsInput
                type="number"
                min={10}
                max={600}
                value={String(settings.embeddingRequestTimeoutSeconds)}
                onChange={(event) =>
                  onSettingChange(
                    'embeddingRequestTimeoutSeconds',
                    Math.max(10, Math.min(600, Number(event.target.value) || 180)),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">
                {l('索引批大小', 'Index Batch Size')}
              </div>
              <SettingsInput
                type="number"
                min={1}
                max={128}
                value={String(settings.embeddingBatchSize)}
                onChange={(event) =>
                  onSettingChange(
                    'embeddingBatchSize',
                    Math.max(1, Math.min(128, Number(event.target.value) || 24)),
                  )
                }
              />
              <div className="text-[11px] leading-5 text-slate-400">
                {l(
                  '控制索引阶段每批送去 embedding 接口的 chunk 数。数值越大通常越快，但更容易触发限流或超时。',
                  'Controls how many chunks are sent to the embedding API per indexing batch. Larger values are usually faster but more likely to hit rate limits or timeouts.',
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
            {l(
              '建议填写专门的 embeddings 模型，而不是普通 chat 模型。Base URL 可填写服务根地址、`/v1`，或完整 `.../v1/embeddings`；软件会自动规范化后交给后端执行。这里的维度、超时和索引批大小也会真实影响本地 RAG 的 embedding 请求与索引行为。',
              'Use a dedicated embeddings model instead of a regular chat model. The Base URL can be the provider root, `/v1`, or the full `.../v1/embeddings` endpoint; the app normalizes it before sending requests from the backend. The dimensions, timeout, and index batch size configured here also affect local RAG embedding requests and indexing behavior.',
            )}
          </div>

          {!settings.embeddingBaseUrl.trim() ||
          !settings.embeddingModel.trim() ||
          !embeddingApiKey.trim() ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              {l(
                'Base URL、API Key 和 Model 需要同时填写，本地 RAG 才能建立或查询向量索引。',
                'Fill in the Base URL, API key, and model before local RAG can build or query the vector index.',
              )}
            </div>
          ) : null}

          <EmbeddingTestButton
            baseUrl={settings.embeddingBaseUrl}
            apiKey={embeddingApiKey}
            model={settings.embeddingModel}
            l={l}
          />
        </SettingsField>
      ) : null}

      {activeSection === 'translation' ? (
        <>
          <SettingsField
            label={l('翻译体验', 'Translation Experience')}
            description={l(
              '配置语言方向、自动划词翻译和文档级翻译操作。',
              'Configure language direction, auto selection translation, and document-level translation actions.',
            )}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  {l('源语言', 'Source Language')}
                </div>
                <SettingsSelect
                  value={settings.translationSourceLanguage}
                  onChange={(event) =>
                    onSettingChange('translationSourceLanguage', event.target.value)
                  }
                >
                  {languageOptions.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </SettingsSelect>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  {l('目标语言', 'Target Language')}
                </div>
                <SettingsSelect
                  value={settings.translationTargetLanguage}
                  onChange={(event) =>
                    onSettingChange('translationTargetLanguage', event.target.value)
                  }
                >
                  {languageOptions
                    .filter((language) => language.value !== 'auto')
                    .map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                </SettingsSelect>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs leading-5 text-slate-500">
              {l(
                '整篇翻译会按结构块分批调用模型，并将结果缓存到当前文档会话中。',
                'Full-document translation is executed in batches by structured blocks and cached in the current document session.',
              )}
            </div>

            <ToggleRow
              title={l('启用划词翻译浮层', 'Enable Selection Translation Popover')}
              description={l(
                '在 PDF 或结构化正文中选中文本后，显示划词翻译浮层和相关操作。',
                'Show the selection translation popover and related actions after selecting text in the PDF or structured text.',
              )}
              checked={settings.enableSelectionTranslation}
              onChange={(checked) => onSettingChange('enableSelectionTranslation', checked)}
            />

            <ToggleRow
              title={l('点击 PDF 段落显示译文', 'Show Translation When Clicking PDF Paragraphs')}
              description={l(
                '在 PDF 阅读模式点击 MinerU 解析出的段落时，弹出该段缓存译文或单段翻译入口。',
                'In PDF reading mode, show cached paragraph translation or a one-paragraph translation action when clicking MinerU parsed paragraphs.',
              )}
              checked={settings.enablePdfParagraphTranslationPopover}
              onChange={(checked) => onSettingChange('enablePdfParagraphTranslationPopover', checked)}
            />

            <ToggleRow
              title={l('自动翻译划词', 'Auto Translate Selection')}
              description={l(
                '划词翻译浮层开启时，选中文本后自动请求翻译，无需手动点击翻译按钮。',
                'When the selection translation popover is enabled, automatically translate selected text without requiring a manual click.',
              )}
              checked={settings.autoTranslateSelection}
              onChange={(checked) => onSettingChange('autoTranslateSelection', checked)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (translating ? onCancelTranslate?.() : onTranslate?.())}
                disabled={translating ? !canCancelTranslate : !canTriggerTranslate}
                className={clsx(
                  'rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60',
                  translating
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-900 hover:bg-slate-800',
                )}
              >
                <Languages className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                {translating
                  ? l('取消翻译', 'Cancel Translation')
                  : l('开始整篇翻译', 'Translate Document')}
              </button>
              <button
                type="button"
                onClick={() => onClearTranslations?.()}
                disabled={!canClearTranslations}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {l('清空翻译缓存', 'Clear Translation Cache')}
              </button>
            </div>
          </SettingsField>

          <SettingsField
            label={l('翻译吞吐配置', 'Translation Throughput')}
            description={l(
              '控制整篇翻译时每批块数与并发数。',
              'Control batch size and concurrency for full-document translation.',
            )}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  {l('每批块数', 'Blocks Per Batch')}
                </div>
                <SettingsInput
                  type="number"
                  min={1}
                  max={50}
                  value={String(settings.translationBatchSize)}
                  onChange={(event) =>
                    onSettingChange(
                      'translationBatchSize',
                      Math.max(1, Math.min(50, Number(event.target.value) || 1)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  {l('并发数', 'Concurrency')}
                </div>
                <SettingsInput
                  type="number"
                  min={1}
                  max={8}
                  value={String(settings.translationConcurrency)}
                  onChange={(event) =>
                    onSettingChange(
                      'translationConcurrency',
                      Math.max(1, Math.min(8, Number(event.target.value) || 1)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">
                  {l('每分钟请求数', 'Requests Per Minute')}
                </div>
                <SettingsInput
                  type="number"
                  min={0}
                  max={600}
                  value={String(settings.translationRequestsPerMinute)}
                  onChange={(event) =>
                    onSettingChange(
                      'translationRequestsPerMinute',
                      Math.max(0, Math.min(600, Number(event.target.value) || 0)),
                    )
                  }
                />
                <div className="text-[11px] leading-5 text-slate-400">
                  {l('填 0 表示不限制，由软件直接发送请求。', 'Use 0 for unlimited requests.')}
                </div>
              </div>
            </div>
          </SettingsField>

          <SettingsField
            label={l('标题翻译', 'Title Translation')}
            description={l(
              '选择用于翻译文献标题的 AI 模型。使用左侧 AI 模型预设中的配置。',
              'Choose the AI model for translating paper titles. Uses presets from the AI Models section.',
            )}
          >
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">{l('标题翻译模型', 'Title Translation Model')}</div>
              <SettingsSelect
                value={settings.titleTranslationModelPresetId}
                onChange={(event) => onSettingChange('titleTranslationModelPresetId', event.target.value)}
              >
                <option value="default">{l('跟随全文翻译模型', 'Follow document translation model')}</option>
                {qaModelPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </SettingsSelect>
              <div className="text-[11px] leading-5 text-slate-400">
                {l('也可在文献详情面板中手动选择其他模型。翻译预设不再需要单独配置 API Key。', 'You can also manually select different models in the paper details panel. No separate API key needed for title translation.')}
              </div>
            </div>

            <BatchTranslateButton
              settings={activeLibrarySettings}
              l={l}
            />
          </SettingsField>
        </>
      ) : null}

      {activeSection === 'summaryQa' ? (
        <>
          <SettingsField
            label={l('概览输入来源', 'Overview Input Source')}
            description={l(
              '决定概览生成优先读取 PDF 文本还是 MinerU Markdown。',
              'Decide whether overview generation should prefer PDF text or MinerU Markdown.',
            )}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {l('当前概览模型', 'Current Overview Preset')}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {activeSummaryPreset?.label || activeSummaryPreset?.model || l('未选择', 'Unselected')}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {activeSummaryPreset?.baseUrl || l('未配置 Base URL', 'Base URL not configured')}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-500">
                {l('概览输入模式', 'Overview Source Mode')}
              </div>
              <div className="grid gap-2">
                {summarySourceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSettingChange('summarySourceMode', option.value)}
                    className={
                      settings.summarySourceMode === option.value
                        ? 'rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-left transition'
                        : 'rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition hover:bg-slate-100'
                    }
                  >
                    <div className="text-sm font-medium text-slate-900">{option.label}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </SettingsField>

          <SettingsField
            label={l('概览输出语言', 'Overview Output Language')}
            description={l(
              '控制 AI 概览的生成语言；切换后会使用新的缓存 key，不会混用旧语言结果。',
              'Choose the language used for AI overviews. Changing it uses a separate cache key.',
            )}
          >
            <div className="grid gap-3">
              <SettingsSelect
                value={
                  summaryLanguageOptions.some(
                    (option) => option.value === settings.summaryOutputLanguage,
                  )
                    ? settings.summaryOutputLanguage
                    : 'custom'
                }
                onChange={(event) => {
                  if (event.target.value === 'custom') {
                    return;
                  }

                  onSettingChange('summaryOutputLanguage', event.target.value);
                }}
              >
                {summaryLanguageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">{l('自定义语言', 'Custom Language')}</option>
              </SettingsSelect>

              <SettingsInput
                value={
                  settings.summaryOutputLanguage === 'follow-ui'
                    ? ''
                    : settings.summaryOutputLanguage
                }
                placeholder={l(
                  `例如：Chinese / English / Japanese；留空则${resolvedSummaryLanguage}`,
                  `e.g. Chinese / English / Japanese; leave empty for ${resolvedSummaryLanguage}`,
                )}
                onChange={(event) =>
                  onSettingChange(
                    'summaryOutputLanguage',
                    event.target.value.trimStart() || 'follow-ui',
                  )
                }
              />
              <div className="text-xs text-slate-500 dark:text-[var(--pq-text-muted)]">
                {l(
                  `当前实际输出语言：${resolvedSummaryLanguage}`,
                  `Effective output language: ${resolvedSummaryLanguage}`,
                )}
              </div>
            </div>
          </SettingsField>

          <SettingsField
            label={l('问答上下文来源', 'QA Context Source')}
            description={l(
              '控制问答时优先使用 MinerU Markdown 还是 PDF 文本。',
              'Choose whether QA should prefer MinerU Markdown or extracted PDF text.',
            )}
          >
            <div className="grid gap-2">
              {qaSourceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSettingChange('qaSourceMode', option.value)}
                  className={
                    settings.qaSourceMode === option.value
                      ? 'rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-left text-indigo-700 transition'
                      : 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-600 transition hover:border-slate-300 hover:bg-white'
                  }
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>
          </SettingsField>

          <SettingsField
            label={l('本地 RAG 检索', 'Local RAG Retrieval')}
            description={l(
              '先检索相关片段，再回退到整篇上下文，可减少长文档问答失败和重复消耗。',
              'Retrieve relevant chunks first, then fall back to the original full-document context when needed.',
            )}
          >
            <div className="space-y-3">
              <ToggleRow
                title={l('启用本地 RAG', 'Enable Local RAG')}
                description={l(
                  '为当前文档建立或复用本地向量索引，并优先将命中的片段发送给问答模型。',
                  'Build or reuse a local vector index for the current document and prefer retrieved chunks for QA.',
                )}
                checked={settings.localRagEnabled}
                onChange={(checked) => onSettingChange('localRagEnabled', checked)}
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs leading-5 text-slate-500">
                {l(
                  'Embedding 模型请在单独的 “Embedding” 分区配置；这里仅控制检索策略和 Top-K 检索块数。',
                  'Configure the embedding model in the dedicated Embedding section. This panel controls only retrieval strategy and Top-K retrieved blocks.',
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">
                    {l('检索来源模式', 'Retrieval Source Mode')}
                  </div>
                  <div className="grid gap-2">
                    {ragSourceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onSettingChange('ragSourceMode', option.value)}
                        className={
                          settings.ragSourceMode === option.value
                            ? 'rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-left text-indigo-700 transition'
                            : 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-600 transition hover:border-slate-300 hover:bg-white'
                        }
                      >
                        <div className="text-sm font-medium">{option.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">
                    {l('Top-K 检索块数', 'Top-K Retrieved Blocks')}
                  </div>
                  <SettingsInput
                    type="number"
                    min={1}
                    max={12}
                    value={String(settings.localRagTopK)}
                    onChange={(event) =>
                      onSettingChange(
                        'localRagTopK',
                        Math.max(1, Math.min(12, Number(event.target.value) || 1)),
                      )
                    }
                  />
                  <div className="text-[11px] leading-5 text-slate-400">
                    {l(
                      '控制每次 RAG 选取几个最相近的上下文块。建议范围 4-8；值越大，发送给模型的内容越多，也更容易撑大上下文。',
                      'Controls how many closest context blocks RAG sends to the model. Recommended range: 4-8; higher values add more context and grow the prompt faster.',
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SettingsField>

          <SettingsField
            label={l('批量概览生成', 'Batch Overview Generation')}
            description={l(
              '为文库中已解析的论文批量生成概览。',
              'Generate overviews in batch for parsed papers in the library.',
            )}
          >
            <div className="space-y-3">
              <ToggleRow
                title={l('自动生成概览', 'Auto Generate Overview')}
                description={l(
                  '检测到结构化内容后自动生成概览预览。',
                  'Automatically generate an overview preview once structured content is available.',
                )}
                checked={settings.autoGenerateSummary}
                onChange={(checked) => onSettingChange('autoGenerateSummary', checked)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBatchGenerateSummaries}
                  disabled={batchSummaryRunning}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {batchSummaryRunning
                    ? l('处理中...', 'Processing...')
                    : l('全部生成概览', 'Generate All Overviews')}
                </button>
                {batchSummaryRunning ? (
                  <button
                    type="button"
                    onClick={onToggleBatchSummaryPause}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    {batchSummaryPaused ? l('继续', 'Resume') : l('暂停', 'Pause')}
                  </button>
                ) : null}
                {batchSummaryRunning ? (
                  <button
                    type="button"
                    onClick={onCancelBatchSummary}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600 transition hover:bg-rose-100"
                  >
                    {l('取消', 'Cancel')}
                  </button>
                ) : null}
              </div>
              <BatchProgressCard
                title={l('批量概览生成进度', 'Batch Overview Progress')}
                progress={batchSummaryProgress}
                tone="emerald"
              />
            </div>
          </SettingsField>
        </>
      ) : null}
    </div>
  );
}

interface TranslationTestButtonProps {
  settings: LibrarySettings;
  l: ReaderPreferencesLocalizer;
}

function TranslationPresetManager({ presets, selectedId, onUpdatePresets, onSelectPreset, l }: {
  presets: TranslationModelPreset[];
  selectedId: string;
  onUpdatePresets: (presets: TranslationModelPreset[]) => void;
  onSelectPreset: (id: string) => void;
  l: ReaderPreferencesLocalizer;
}) {
  const [editing, setEditing] = useState<TranslationModelPreset | null>(null);

  const handleAdd = () => {
    const newPreset: TranslationModelPreset = { id: `preset_${Date.now()}`, label: l('新预设', 'New Preset'), provider: 'ai', apiKey: '', baseUrl: '', model: 'gpt-4o-mini', appId: '', secretKey: '' };
    onUpdatePresets([...presets, newPreset]);
    setEditing(newPreset);
  };

  const handleSave = (preset: TranslationModelPreset) => {
    onUpdatePresets(presets.map((p) => p.id === preset.id ? preset : p));
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    onUpdatePresets(presets.filter((p) => p.id !== id));
    if (selectedId === id) onSelectPreset('');
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--pq-text-faint)]">
          {l('翻译预设', 'Translation Presets')}
        </span>
        <button type="button" onClick={handleAdd} className="pq-icon-button h-6 w-6">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
      </div>

      {presets.length > 0 && (
        <div className="space-y-1">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--pq-surface-2)]">
              <input
                type="radio"
                checked={selectedId === p.id}
                onChange={() => onSelectPreset(p.id)}
                className="h-3.5 w-3.5"
              />
              <span className="flex-1 truncate text-sm">{p.label || p.model}</span>
              <span className="text-[10px] text-[var(--pq-text-faint)]">{p.provider}</span>
              <button type="button" onClick={() => setEditing(editing?.id === p.id ? null : p)} className="pq-icon-button h-6 w-6 opacity-0 group-hover:opacity-100">
                <Pencil className="h-3 w-3" strokeWidth={1.9} />
              </button>
              <button type="button" onClick={() => handleDelete(p.id)} className="pq-icon-button h-6 w-6 text-[var(--pq-text-faint)] hover:text-[var(--pq-danger)]">
                <Trash2 className="h-3 w-3" strokeWidth={1.9} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="rounded-lg border border-[var(--pq-border)] p-3 space-y-2">
          <SettingsInput value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder={l('预设名称', 'Preset name')} />
          <select value={editing.provider} onChange={(e) => setEditing({ ...editing, provider: e.target.value as any })} className="pq-input h-9 w-full px-2 text-sm">
            <option value="ai">AI (OpenAI Compatible)</option>
            <option value="baidu">Baidu</option>
            <option value="google">Google</option>
            <option value="deepl">DeepL</option>
            <option value="aliyun">Aliyun</option>
            <option value="tencent">Tencent</option>
            <option value="volc">Volc</option>
          </select>
          {editing.provider === 'ai' && (
            <><SettingsInput value={editing.baseUrl} onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
              <SettingsInput value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} placeholder="gpt-4o-mini" />
            </>
          )}
          <SettingsInput type="password" value={editing.apiKey} onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })} placeholder="API Key" />
          {editing.provider === 'baidu' && (
            <><SettingsInput value={editing.appId} onChange={(e) => setEditing({ ...editing, appId: e.target.value })} placeholder="APP ID" />
              <SettingsInput type="password" value={editing.secretKey} onChange={(e) => setEditing({ ...editing, secretKey: e.target.value })} placeholder="Secret Key" />
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="pq-button px-3 py-1.5 text-xs">{l('取消', 'Cancel')}</button>
            <button type="button" onClick={() => handleSave(editing)} className="pq-button-primary px-3 py-1.5 text-xs">{l('保存', 'Save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TranslationTestButton({ settings, l }: TranslationTestButtonProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      if (settings.translationProvider === 'ai') {
        const baseUrl = settings.translationBaseUrl || 'https://api.openai.com/v1';
        if (!settings.translationApiKey) throw new Error(l('请先填写 API Key', 'Please enter an API Key first'));
        const { translateTextOpenAICompatible } = await import('../../services/translation');
        const result = await translateTextOpenAICompatible({
          baseUrl,
          apiKey: settings.translationApiKey,
          model: settings.translationModel || 'gpt-4o-mini',
          sourceLanguage: 'English',
          targetLanguage: 'Chinese',
          text: 'Hello, this is a test.',
        });
        setTestResult({ ok: true, message: result });
      } else if (settings.translationProvider === 'baidu') {
        if (!settings.translationAppId || !settings.translationSecretKey) {
          throw new Error(l('请填写 APP ID 和密钥', 'Please enter APP ID and Secret Key'));
        }
        const result = await translateTextViaProvider({
          provider: 'baidu', text: 'Hello, this is a test.',
          sourceLang: 'en', targetLang: 'zh',
        });
        setTestResult({ ok: true, message: result });
      } else if (settings.translationProvider === 'google' || settings.translationProvider === 'deepl') {
        if (!settings.translationApiKey) throw new Error(l('请填写 API Key', 'Please enter an API Key first'));
        const result = await translateTextViaProvider({
          provider: settings.translationProvider, text: 'Hello, this is a test.',
          sourceLang: 'en', targetLang: 'zh',
        });
        setTestResult({ ok: true, message: result });
      } else {
        if (!settings.translationApiKey || !settings.translationSecretKey) {
          throw new Error(l('请填写 Access Key 和 Secret Key', 'Please enter Access Key and Secret Key'));
        }
        const result = await translateTextViaProvider({
          provider: settings.translationProvider, text: 'Hello, this is a test.',
          sourceLang: 'en', targetLang: 'zh',
        });
        setTestResult({ ok: true, message: result });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={testing}
        className="pq-button flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-60"
      >
        {testing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.9} />
        ) : (
          <Languages className="h-3.5 w-3.5" strokeWidth={1.9} />
        )}
        {testing ? l('测试中...', 'Testing...') : l('测试翻译', 'Test Translation')}
      </button>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${
            testResult.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-300'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          )}
          <span className="whitespace-pre-wrap break-words">{testResult.message}</span>
        </div>
      )}
    </div>
  );
}

interface MigrateRepoButtonProps {
  repoDir: string;
  l: ReaderPreferencesLocalizer;
}

function MigrateRepoButton({ repoDir, l }: MigrateRepoButtonProps) {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<{ total: number; synced: number; failed: number } | null>(null);

  const handleMigrate = useCallback(async () => {
    if (!repoDir.trim()) return;
    setMigrating(true);
    setResult(null);
    try {
      const res = await migrateAllToRepo();
      setResult(res);
    } catch (error) {
      setResult({ total: 0, synced: 0, failed: 1 });
    } finally {
      setMigrating(false);
    }
  }, [repoDir]);

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={handleMigrate}
        disabled={migrating || !repoDir.trim()}
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
      >
        {migrating ? (
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" strokeWidth={1.8} />
        ) : (
          <Upload className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
        )}
        {migrating ? l('迁移中...', 'Migrating...') : l('一键迁移全部文献', 'Migrate All Papers')}
      </button>

      {result && (
        <div className={`rounded-lg border px-3 py-2 text-xs leading-5 ${
          result.failed === 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : result.synced > 0
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-rose-200 bg-rose-50 text-rose-600'
        }`}>
          {result.failed === 0
            ? l(`迁移完成：共 ${result.total} 篇，全部成功`, `Done: ${result.total} papers, all synced`)
            : l(
                `迁移完成：共 ${result.total} 篇，成功 ${result.synced}，失败 ${result.failed}`,
                `Done: ${result.total} papers, ${result.synced} synced, ${result.failed} failed`,
              )}
        </div>
      )}
    </div>
  );
}

function EmbeddingTestButton({ baseUrl, apiKey, model, l }: { baseUrl: string; apiKey: string; model: string; l: ReaderPreferencesLocalizer }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; dimensions?: number; model?: string; error?: string } | null>(null);

  const handleTest = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !model.trim()) return;
    setTesting(true);
    setResult(null);
    const res = await testEmbeddingConnection({ baseUrl, apiKey, model });
    setResult(res);
    setTesting(false);
  };

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={testing}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
      >
        {testing ? (
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" strokeWidth={1.8} />
        ) : null}
        {testing ? l('测试中...', 'Testing...') : l('测试 Embedding 连接', 'Test Embedding')}
      </button>

      {result && (
        <div className={`rounded-lg border px-3 py-2 text-xs leading-5 ${
          result.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-600'
        }`}>
          {result.ok
            ? l(`连接成功！模型: ${result.model}，维度: ${result.dimensions}`, `OK! Model: ${result.model}, dims: ${result.dimensions}`)
            : l(`连接失败: ${result.error}`, `Failed: ${result.error}`)}
        </div>
      )}
    </div>
  );
}

interface BatchTranslateButtonProps {
  settings: LibrarySettings;
  l: ReaderPreferencesLocalizer;
}

function ExportBibtexButton({ l }: { l: ReaderPreferencesLocalizer }) {
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const bibtex = await exportBibtex();
      const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paperquay-export-${Date.now()}.bib`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy}
      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
    >
      {busy ? l('导出中...', 'Exporting...') : l('导出 BibTeX', 'Export BibTeX')}
    </button>
  );
}

function BatchTranslateButton({ settings, l }: BatchTranslateButtonProps) {
  const [progress, setProgress] = useState<BatchProgressState>(EMPTY_BATCH_PROGRESS);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);

  const handleBatchTranslate = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    pausedRef.current = false;
    cancelRef.current = false;

    try {
      const allPapers = await listLibraryPapers({ limit: 5000 });
      const candidates = [] as { paper: LiteraturePaper; title: string }[];

      for (const paper of allPapers) {
        if (!paper.title?.trim() || !paper.id) continue;
        const existing = await getPaperTranslation({ paperId: paper.id, field: 'title', targetLang: 'zh-CN' }).catch(() => null);
        if (!existing?.translated_text) candidates.push({ paper, title: paper.title });
      }

      if (candidates.length === 0) {
        setProgress({ running: false, paused: false, cancelRequested: false, total: 0, completed: 0, succeeded: 0, skipped: 0, failed: 0, currentLabel: '' });
        return;
      }

      const total = candidates.length;
      setProgress({ running: true, paused: false, cancelRequested: false, total, completed: 0, succeeded: 0, skipped: 0, failed: 0, currentLabel: candidates[0].title });

      const BATCH = 3;
      let completed = 0, succeeded = 0, failed = 0;

      for (let i = 0; i < candidates.length; i += BATCH) {
        if (cancelRef.current) break;
        while (pausedRef.current && !cancelRef.current) await sleep(200);

        const batch = candidates.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(async ({ paper, title }) => {
          const preset = await getReaderPresetConfig();
          if (preset.apiKey) {
            const { translateTextOpenAICompatible } = await import('../../services/translation');
            return await translateTextOpenAICompatible({
              baseUrl: preset.baseUrl,
              apiKey: preset.apiKey,
              model: preset.model,
              sourceLanguage: 'English',
              targetLanguage: 'Chinese',
              text: title,
            });
          }
          const settingsData = await getLibrarySettings();
          if (settingsData.translationProvider === 'ai') {
            const { translateTextOpenAICompatible } = await import('../../services/translation');
            return await translateTextOpenAICompatible({
              baseUrl: settingsData.translationBaseUrl || 'https://api.openai.com/v1',
              apiKey: settingsData.translationApiKey,
              model: settingsData.translationModel || 'gpt-4o-mini',
              sourceLanguage: 'English',
              targetLanguage: 'Chinese',
              text: title,
            });
          } else {
            return await translateTextViaProvider({
              provider: settingsData.translationProvider,
              text: title,
              sourceLang: 'en',
              targetLang: 'zh',
            });
          }
        }));

        for (let j = 0; j < batch.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled') {
            succeeded += 1;
            await savePaperTranslation({
              paperId: batch[j].paper.id,
              field: 'title',
              targetLang: 'zh-CN',
              translatedText: r.value,
            }).catch(() => { failed += 1; succeeded -= 1; });
          } else {
            failed += 1;
          }
        }

        completed += batch.length;
        const nextIdx = Math.min(i + BATCH, candidates.length - 1);
        setProgress((p) => ({ ...p, completed, succeeded, failed, currentLabel: candidates[nextIdx]?.title ?? '' }));
      }

      setProgress((p) => ({ ...p, running: false, completed }));
    } catch {
      setProgress((p) => ({ ...p, running: false }));
    } finally {
      runningRef.current = false;
    }
  }, []);

  const handlePause = useCallback(() => { pausedRef.current = !pausedRef.current; setProgress((p) => ({ ...p, paused: !p.paused })); }, []);
  const handleCancel = useCallback(() => { cancelRef.current = true; setProgress((p) => ({ ...p, cancelRequested: true })); }, []);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleBatchTranslate}
          disabled={progress.running}
          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
        >
          {progress.running ? (
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" strokeWidth={1.8} />
          ) : (
            <Languages className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          )}
          {l('翻译所有标题', 'Translate All Titles')}
        </button>

        {progress.running && !progress.cancelRequested && (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 transition hover:bg-amber-100"
          >
            {progress.paused ? l('继续', 'Resume') : l('暂停', 'Pause')}
          </button>
        )}

        {progress.running && !progress.cancelRequested && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-100"
          >
            {l('取消', 'Cancel')}
          </button>
        )}
      </div>

      <BatchProgressCard title={l('标题翻译进度', 'Title Translation Progress')} progress={progress} tone="indigo" />
    </div>
  );
}
