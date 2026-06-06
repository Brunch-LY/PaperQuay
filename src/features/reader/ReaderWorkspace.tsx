import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Minimize2 } from 'lucide-react';
import BlockViewer from '../blocks/BlockViewer';
import PdfViewer from '../pdf/PdfViewer';
import { useLocaleText } from '../../i18n/uiLanguage';
import { AssistantSidebar } from './AssistantSidebar';
import { ReaderWorkspaceOverview } from './readerWorkspaceOverview';
import { buildReaderAssistantSidebarProps } from './readerAssistantSidebarProps';
import { ReaderWorkspaceHeader } from './readerWorkspaceHeader';
import { FloatingAssistantPanel, SelectionQuickActions } from './readerWorkspaceOverlays';
import {
  ASSISTANT_PANEL_WIDTH_STORAGE_KEY,
  MAX_ASSISTANT_PANEL_WIDTH,
  MIN_ASSISTANT_PANEL_WIDTH,
  formatReaderDocumentSource,
  loadStoredNumber,
  type ReaderWorkspaceDocument,
} from './readerWorkspaceShared';
import type {
  CreateNoteRequest,
  Note,
  NoteAnchor,
  NoteAnchorInsertRequest,
  UpdateNoteRequest,
} from '../../types/notes';
import type {
  AssistantPanelKey,
  DocumentChatAttachment,
  DocumentChatCitation,
  DocumentChatMessage,
  DocumentChatRenderMode,
  DocumentChatSession,
  ModelReasoningEffort,
  PaperAnnotation,
  PaperSummary,
  PdfHighlightTarget,
  PdfReadingHeatmap,
  PdfScrollPosition,
  PdfSource,
  PositionedMineruBlock,
  QaModelPreset,
  ReaderViewMode,
  SelectedExcerpt,
  TextSelectionPayload,
  TextSelectionSource,
  TranslationDisplayMode,
  TranslationMap,
  WorkspaceStage,
  ZoteroRelatedNote,
} from '../../types/reader';

interface ReaderWorkspaceProps {
  currentDocument: ReaderWorkspaceDocument;
  selectedSectionTitle: string;
  currentPdfName: string;
  currentJsonName: string;
  mineruPath: string;
  translatedCount: number;
  translationProgressCompleted: number;
  translationProgressTotal: number;
  workspaceStage: WorkspaceStage;
  onStageChange: (stage: WorkspaceStage) => void;
  readingViewMode: ReaderViewMode;
  onReadingViewModeChange: (mode: ReaderViewMode) => void;
  loading: boolean;
  translating: boolean;
  error: string;
  statusMessage: string;
  activeBlockSummary: string;
  currentPdfVariantLabel: string;
  canOpenOriginalPdf: boolean;
  onOpenOriginalPdf: () => void;
  currentPdfPath: string;
  availablePdfOptions: Array<{
    path: string;
    label: string;
  }>;
  onCurrentPdfPathChange: (path: string) => void;
  pdfAnnotationSaveDirectory: string;
  originalPdfPath: string;
  pdfSource: PdfSource;
  pdfData: Uint8Array | null;
  pdfScrollPosition: PdfScrollPosition | null;
  pdfReadingHeatmap: PdfReadingHeatmap | null;
  onPdfScrollPositionChange: (position: PdfScrollPosition) => void;
  onPdfReadingHeatmapChange: (heatmap: PdfReadingHeatmap) => void;
  blocks: PositionedMineruBlock[];
  translations: TranslationMap;
  translationDisplayMode: TranslationDisplayMode;
  translationLanguageLabel: string;
  activeBlockId: string | null;
  hoveredBlockId: string | null;
  activePdfHighlight: PdfHighlightTarget | null;
  pdfHighlightSignal: number;
  blockScrollSignal: number;
  smoothScroll: boolean;
  enablePdfReadingHeatmap: boolean;
  softPageShadow: boolean;
  compactReading: boolean;
  showBlockMeta: boolean;
  hidePageDecorationsInBlockView: boolean;
  leftPaneWidthRatio: number;
  layoutRef: RefObject<HTMLDivElement>;
  onStartResize: () => void;
  onResetLayout: () => void;
  onPdfBlockHover: (block: PositionedMineruBlock | null) => void;
  onPdfBlockSelect: (block: PositionedMineruBlock) => void;
  onBlockClick: (block: PositionedMineruBlock) => void;
  onTranslationDisplayModeChange: (mode: TranslationDisplayMode) => void;
  onTextSelect: (selection: TextSelectionPayload, source: TextSelectionSource) => void;
  onOpenStandalonePdf: () => void;
  onOpenMineruJson: () => void;
  onCloudParse: () => void;
  onTranslateDocument: () => void;
  onOpenPreferences: () => void;
  notes: Note[];
  activeNoteId: string | null;
  notesLoading: boolean;
  notesSaving: boolean;
  notesError: string;
  pendingAnchorInsert?: NoteAnchorInsertRequest | null;
  onPendingAnchorInsertHandled?: (requestId: string) => void;
  noteEditorSourceId?: string;
  externalUpdateNote?: Note | null;
  onExternalUpdateApply?: (note: Note) => void;
  onCreateNote: (request: CreateNoteRequest) => void;
  onCreateStandaloneNote: () => void;
  onSelectNote: (note: Note) => void;
  onUpdateNote: (noteId: string, patch: UpdateNoteRequest, options?: { sourceId?: string }) => void;
  onDeleteNote: (noteId: string) => void;
  onJumpToNote: (note: Note) => void;
  onJumpToNoteAnchor: (note: Note, anchor: NoteAnchor) => void;
  onAddSelectionToNote: () => void;
  workspaceNoteMarkdown: string;
  annotations: PaperAnnotation[];
  selectedAnnotationId: string | null;
  zoteroRelatedNotes: ZoteroRelatedNote[];
  zoteroRelatedNotesLoading: boolean;
  zoteroRelatedNotesError: string;
  onWorkspaceNoteChange: (value: string) => void;
  onAppendSelectedExcerptToNote: () => void;
  onCreateAnnotation: (note: string) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onSelectAnnotation: (annotationId: string) => void;
  paperSummary: PaperSummary | null;
  paperSummaryLoading: boolean;
  paperSummaryError: string;
  onGenerateSummary: () => void;
  qaSessions: DocumentChatSession[];
  selectedQaSessionId: string;
  qaMessages: DocumentChatMessage[];
  qaInput: string;
  qaAttachments: DocumentChatAttachment[];
  qaModelPresets: QaModelPreset[];
  selectedQaPresetId: string;
  qaRagEnabled: boolean;
  qaAnswerRenderMode: DocumentChatRenderMode;
  qaReasoningEffort: ModelReasoningEffort;
  screenshotLoading: boolean;
  onQaInputChange: (value: string) => void;
  onQaSubmit: () => void;
  onQaPresetChange: (presetId: string) => void;
  onQaRagEnabledChange: (value: boolean) => void;
  onQaAnswerRenderModeChange: (mode: DocumentChatRenderMode) => void;
  onQaReasoningEffortChange: (reasoningEffort: ModelReasoningEffort) => void;
  onQaSessionCreate: () => void;
  onQaSessionSelect: (sessionId: string) => void;
  onQaSessionDelete: (sessionId: string) => void;
  onSelectImageAttachments: () => void;
  onSelectFileAttachments: () => void;
  onCaptureScreenshot: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onCitationClick: (citation: DocumentChatCitation) => void;
  onSaveAssistantMessageAsNote: (message: DocumentChatMessage) => void;
  qaLoading: boolean;
  qaError: string;
  selectedExcerpt: SelectedExcerpt | null;
  selectedExcerptTranslation: string;
  selectedExcerptTranslating: boolean;
  selectedExcerptError: string;
  autoTranslateSelection: boolean;
  onAppendSelectedExcerptToQa: () => void;
  onTranslateSelectedExcerpt: () => void;
  onClearSelectedExcerpt: () => void;
  onPdfAnnotationSaveSuccess: (path: string) => void;
  aiConfigured: boolean;
  assistantDetached: boolean;
  assistantActivePanel: AssistantPanelKey;
  onAssistantActivePanelChange: (panel: AssistantPanelKey) => void;
  leftSidebarCollapsed: boolean;
  onToggleLeftSidebar: () => void;
  onDetachAssistant: () => void;
  onAttachAssistant: () => void;
  showLibraryToggle?: boolean;
}

function ReadingStage(props: ReaderWorkspaceProps & { immersiveReading: boolean }) {
  const l = useLocaleText();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const {
    blocks,
    translations,
    translationDisplayMode,
    readingViewMode,
    activeBlockId,
    hoveredBlockId,
    activePdfHighlight,
    pdfHighlightSignal,
    immersiveReading,
    blockScrollSignal,
    smoothScroll,
    enablePdfReadingHeatmap,
    softPageShadow,
    compactReading,
    showBlockMeta,
    hidePageDecorationsInBlockView,
    leftPaneWidthRatio,
    layoutRef,
    pdfSource,
    pdfData,
    pdfScrollPosition,
    pdfReadingHeatmap,
    currentPdfName,
    currentJsonName,
    mineruPath,
    translatedCount,
    translationProgressCompleted,
    translationProgressTotal,
    translating,
    currentDocument,
    selectedSectionTitle,
    statusMessage,
    pdfAnnotationSaveDirectory,
    originalPdfPath,
    onPdfScrollPositionChange,
    onPdfReadingHeatmapChange,
    onStartResize,
    onResetLayout,
    onPdfBlockHover,
    onPdfBlockSelect,
    onBlockClick,
    onTextSelect,
    qaSessions,
    selectedQaSessionId,
    qaMessages,
    qaInput,
    qaAttachments,
    qaModelPresets,
    selectedQaPresetId,
    qaRagEnabled,
    qaAnswerRenderMode,
    qaReasoningEffort,
    qaLoading,
    qaError,
    screenshotLoading,
    selectedExcerpt,
    selectedExcerptTranslation,
    selectedExcerptTranslating,
    selectedExcerptError,
    notes,
    activeNoteId,
    notesLoading,
    notesSaving,
    notesError,
    pendingAnchorInsert,
    onPendingAnchorInsertHandled,
    noteEditorSourceId,
    externalUpdateNote,
    onExternalUpdateApply,
    workspaceNoteMarkdown,
    annotations,
    selectedAnnotationId,
    zoteroRelatedNotes,
    zoteroRelatedNotesLoading,
    zoteroRelatedNotesError,
    onQaInputChange,
    onQaSubmit,
    onQaPresetChange,
    onQaRagEnabledChange,
    onQaAnswerRenderModeChange,
    onQaReasoningEffortChange,
    onQaSessionCreate,
    onQaSessionSelect,
    onQaSessionDelete,
    onSelectImageAttachments,
    onSelectFileAttachments,
    onCaptureScreenshot,
    onRemoveAttachment,
    onCitationClick,
    onCreateNote,
    onCreateStandaloneNote,
    onSelectNote,
    onUpdateNote,
    onDeleteNote,
    onJumpToNote,
    onJumpToNoteAnchor,
    onAddSelectionToNote,
    onSaveAssistantMessageAsNote,
    onAppendSelectedExcerptToQa,
    onAppendSelectedExcerptToNote,
    onTranslateSelectedExcerpt,
    onClearSelectedExcerpt,
    onPdfAnnotationSaveSuccess,
    onWorkspaceNoteChange,
    onCreateAnnotation,
    onDeleteAnnotation,
    onSelectAnnotation,
    aiConfigured,
    assistantDetached,
    assistantActivePanel,
    onReadingViewModeChange,
    onAssistantActivePanelChange,
    onDetachAssistant,
  } = props;
  const documentSource = formatReaderDocumentSource(l, currentDocument, selectedSectionTitle);
  const hasBlocks = blocks.length > 0;
  const showDualPane = hasBlocks && readingViewMode === 'dual-pane';
  const showAssistantSidebar = !assistantDetached;
  const matchesCurrentDocument = useCallback(
    (paperId?: string | null) => {
      const value = paperId?.trim();

      if (!value) {
        return true;
      }

      return value === currentDocument.workspaceId || value === currentDocument.itemKey;
    },
    [currentDocument.itemKey, currentDocument.workspaceId],
  );
  const notePdfAnnotations = useMemo<PaperAnnotation[]>(() => {
    const output: PaperAnnotation[] = [];

    for (const note of notes) {
      for (const anchor of note.anchors) {
        if (!matchesCurrentDocument(anchor.paperId || note.paperId)) {
          continue;
        }

        const location = anchor.pdfLocation;
        if (!location?.bbox || !location.pageNumber) continue;

        output.push({
          id: `note-anchor:${note.id}:${anchor.id}`,
          blockId: `note-anchor:${note.id}:${anchor.id}`,
          blockType: 'note-anchor',
          pageIndex: Math.max(0, location.pageNumber - 1),
          bbox: location.bbox,
          bboxCoordinateSystem: location.bboxCoordinateSystem,
          bboxPageSize: location.bboxPageSize,
          note: anchor.label || note.title || note.content,
          quote: anchor.excerpt,
          createdAt: anchor.createdAt,
          updatedAt: note.updatedAt,
        });
      }
    }

    return output;
  }, [matchesCurrentDocument, notes]);
  const pdfAnnotations = useMemo(
    () => [...notePdfAnnotations, ...annotations],
    [annotations, notePdfAnnotations],
  );
  const activeNoteAnnotationId = null;
  const [assistantPanelWidth, setAssistantPanelWidth] = useState(() =>
    loadStoredNumber(ASSISTANT_PANEL_WIDTH_STORAGE_KEY, 408),
  );
  const [resizingAssistantPanel, setResizingAssistantPanel] = useState(false);
  const handlePdfTextSelect = useCallback(
    (selection: TextSelectionPayload) => {
      onTextSelect(selection, 'pdf');
    },
    [onTextSelect],
  );
  const handleBlockTextSelect = useCallback(
    (selection: TextSelectionPayload) => {
      onTextSelect(selection, 'blocks');
    },
    [onTextSelect],
  );

  useEffect(() => {
    localStorage.setItem(
      ASSISTANT_PANEL_WIDTH_STORAGE_KEY,
      String(Math.round(assistantPanelWidth)),
    );
  }, [assistantPanelWidth]);

  useEffect(() => {
    if (!resizingAssistantPanel) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const stageRect = stageRef.current?.getBoundingClientRect();

      if (!stageRect) {
        return;
      }

      const boundedMaxWidth = Math.min(
        MAX_ASSISTANT_PANEL_WIDTH,
        Math.max(MIN_ASSISTANT_PANEL_WIDTH, stageRect.width - 120),
      );
      const nextWidth = Math.round(
        Math.min(
          boundedMaxWidth,
          Math.max(MIN_ASSISTANT_PANEL_WIDTH, stageRect.right - event.clientX),
        ),
      );

      setAssistantPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setResizingAssistantPanel(false);
    };

    const previousUserSelect = globalThis.document.body.style.userSelect;
    const previousCursor = globalThis.document.body.style.cursor;

    globalThis.document.body.style.userSelect = 'none';
    globalThis.document.body.style.cursor = 'col-resize';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      globalThis.document.body.style.userSelect = previousUserSelect;
      globalThis.document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizingAssistantPanel]);

  const sharedAssistantSidebarProps = buildReaderAssistantSidebarProps({
    l,
    activePanel: assistantActivePanel,
    onActivePanelChange: onAssistantActivePanelChange,
    currentDocument,
    documentSource,
    currentPdfName,
    currentJsonName,
    blockCount: blocks.length,
    translatedCount,
    statusMessage,
    hasBlocks,
    aiConfigured,
    paperId: currentDocument.workspaceId,
    notes,
    activeNoteId,
    notesLoading,
    notesSaving,
    notesError,
    pendingAnchorInsert,
    noteEditorSourceId,
    externalUpdateNote,
    onExternalUpdateApply,
    qaSessions,
    selectedQaSessionId,
    qaMessages,
    qaInput,
    qaAttachments,
    qaModelPresets,
    selectedQaPresetId,
    qaRagEnabled,
    qaAnswerRenderMode,
    qaReasoningEffort,
    qaLoading,
    qaError,
    screenshotLoading,
    onQaInputChange,
    onQaSubmit,
    onQaPresetChange,
    onQaRagEnabledChange,
    onQaAnswerRenderModeChange,
    onQaReasoningEffortChange,
    onQaSessionCreate,
    onQaSessionSelect,
    onQaSessionDelete,
    onSelectImageAttachments,
    onSelectFileAttachments,
    onCaptureScreenshot,
    onRemoveAttachment,
    onCitationClick,
    onCreateNote,
    onCreateStandaloneNote,
    onSelectNote,
    onUpdateNote,
    onDeleteNote,
    onJumpToNote,
    onJumpToNoteAnchor,
    onAddSelectionToNote,
    onPendingAnchorInsertHandled,
    onSaveAssistantMessageAsNote,
    selectedExcerpt,
    selectedExcerptTranslation,
    selectedExcerptTranslating,
    selectedExcerptError,
    onAppendSelectedExcerptToQa,
    activeBlockSummary: props.activeBlockSummary,
    workspaceNoteMarkdown,
    annotations,
    zoteroRelatedNotes,
    zoteroRelatedNotesLoading,
    zoteroRelatedNotesError,
    onWorkspaceNoteChange,
    onAppendSelectedExcerptToNote,
    onCreateAnnotation,
    onDeleteAnnotation,
    onSelectAnnotation,
    onTranslateSelectedExcerpt,
    onClearSelectedExcerpt,
    onOpenPreferences: props.onOpenPreferences,
  });

  return (
    <div ref={stageRef} data-tour="linked-reading" className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={layoutRef} className="flex min-h-0 flex-1">
          <section
            className="min-h-0 min-w-0 bg-[#eef3f9] transition-all duration-300"
            style={{
              width: showDualPane ? `calc(${(leftPaneWidthRatio * 100).toFixed(2)}% - 4px)` : '100%',
            }}
          >
            <PdfViewer
              source={pdfSource}
              pdfData={pdfData}
              scrollPosition={pdfScrollPosition}
              readingHeatmap={pdfReadingHeatmap}
              currentPdfName={currentPdfName}
              defaultSaveDirectory={pdfAnnotationSaveDirectory}
              originalPdfPath={originalPdfPath}
              translating={translating}
              translationProgressCompleted={translationProgressCompleted}
              translationProgressTotal={translationProgressTotal}
              hideToolbar={immersiveReading}
              blocks={blocks}
              activeBlockId={activeBlockId}
              hoveredBlockId={hoveredBlockId}
              activeHighlight={activePdfHighlight}
              highlightScrollSignal={pdfHighlightSignal}
              smoothScroll={smoothScroll}
              enableReadingHeatmap={enablePdfReadingHeatmap}
              softPageShadow={softPageShadow}
              annotations={pdfAnnotations}
              selectedAnnotationId={activeNoteAnnotationId ?? selectedAnnotationId}
              onBlockHover={onPdfBlockHover}
              onBlockSelect={onPdfBlockSelect}
              onAnnotationSelect={onSelectAnnotation}
              onAnnotationCreate={onCreateAnnotation}
              onTextSelect={handlePdfTextSelect}
              onScrollPositionChange={onPdfScrollPositionChange}
              onReadingHeatmapChange={onPdfReadingHeatmapChange}
              onSaveSuccess={onPdfAnnotationSaveSuccess}
            />
          </section>

          {showDualPane ? (
            <>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={l('调整阅读分栏', 'Resize reading split')}
                onDoubleClick={onResetLayout}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onStartResize();
                }}
                className="group relative z-20 w-2 shrink-0 cursor-col-resize bg-transparent transition-all duration-200"
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300/80 transition-all duration-200 group-hover:w-[3px] group-hover:bg-indigo-300" />
                <div className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 transition-all duration-200 group-hover:w-1.5 group-hover:bg-indigo-400" />
              </div>

              <section data-tour="block-translation" className="min-h-0 min-w-0 flex-1 bg-[#f7f9fc] transition-all duration-300">
                <BlockViewer
                  blocks={blocks}
                  mineruPath={mineruPath}
                  translations={translations}
                  translationDisplayMode={translationDisplayMode}
                  translationLanguageLabel={props.translationLanguageLabel}
                  activeBlockId={activeBlockId}
                  hoveredBlockId={hoveredBlockId}
                  scrollSignal={blockScrollSignal}
                  compactMode={compactReading}
                  showBlockMeta={showBlockMeta}
                  hidePageDecorations={hidePageDecorationsInBlockView}
                  smoothScroll={smoothScroll}
                  onBlockClick={onBlockClick}
                  onTranslationDisplayModeChange={props.onTranslationDisplayModeChange}
                  onTextSelect={handleBlockTextSelect}
                />
              </section>
            </>
          ) : (
            <section className="w-0 overflow-hidden opacity-0 transition-all duration-300" />
          )}
        </div>
      </div>

      {showAssistantSidebar ? (
        <>
          {assistantActivePanel ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={l('调整问答侧栏宽度', 'Resize assistant sidebar')}
              onPointerDown={(event) => {
                event.preventDefault();
                setResizingAssistantPanel(true);
              }}
              className="group relative z-20 ml-auto w-2 shrink-0 cursor-col-resize bg-transparent transition-all duration-200"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300/90 transition-all duration-200 group-hover:w-[3px] group-hover:bg-slate-400" />
              <div className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 transition-all duration-200 group-hover:w-1.5 group-hover:bg-slate-500" />
            </div>
          ) : null}

          <aside className="flex min-h-0 shrink-0 self-stretch transition-all duration-300">
            <AssistantSidebar
              {...sharedAssistantSidebarProps}
              panelWidth={assistantPanelWidth}
              chatLayoutMode="compact"
              onDetach={onDetachAssistant}
            />
          </aside>
        </>
      ) : null}

      <SelectionQuickActions
        selectedExcerpt={selectedExcerpt}
        selectedExcerptTranslation={selectedExcerptTranslation}
        selectedExcerptTranslating={selectedExcerptTranslating}
        selectedExcerptError={selectedExcerptError}
        aiConfigured={aiConfigured}
        autoTranslateSelection={props.autoTranslateSelection}
        onAppendSelectedExcerptToQa={onAppendSelectedExcerptToQa}
        onAddSelectionToNote={onAddSelectionToNote}
        onTranslateSelectedExcerpt={onTranslateSelectedExcerpt}
        onClearSelectedExcerpt={onClearSelectedExcerpt}
      />
    </div>
  );
}

function ReaderWorkspace(props: ReaderWorkspaceProps) {
  const l = useLocaleText();
  const {
    currentDocument,
    selectedSectionTitle,
    currentPdfName,
    currentPdfVariantLabel,
    currentPdfPath,
    availablePdfOptions,
    workspaceStage,
    onStageChange,
    readingViewMode,
    onReadingViewModeChange,
    loading,
    translating,
    error,
    statusMessage,
    activeBlockSummary,
    onOpenMineruJson,
    onCloudParse,
    onTranslateDocument,
    onOpenPreferences,
    onCurrentPdfPathChange,
    assistantDetached,
  } = props;
  const sourceLabel =
    formatReaderDocumentSource(l, currentDocument, selectedSectionTitle);
  const [immersiveReading, setImmersiveReading] = useState(false);
  const floatingAssistantChatProps = {
    sessions: props.qaSessions,
    selectedSessionId: props.selectedQaSessionId,
    messages: props.qaMessages,
    input: props.qaInput,
    loading: props.qaLoading,
    error: props.qaError,
    hasBlocks: props.blocks.length > 0,
    selectedExcerpt: props.selectedExcerpt,
    attachments: props.qaAttachments,
    qaModelPresets: props.qaModelPresets,
    selectedQaPresetId: props.selectedQaPresetId,
    qaRagEnabled: props.qaRagEnabled,
    qaAnswerRenderMode: props.qaAnswerRenderMode,
    qaReasoningEffort: props.qaReasoningEffort,
    screenshotLoading: props.screenshotLoading,
    onInputChange: props.onQaInputChange,
    onSubmit: props.onQaSubmit,
    onQaPresetChange: props.onQaPresetChange,
    onQaRagEnabledChange: props.onQaRagEnabledChange,
    onQaAnswerRenderModeChange: props.onQaAnswerRenderModeChange,
    onQaReasoningEffortChange: props.onQaReasoningEffortChange,
    onSessionCreate: props.onQaSessionCreate,
    onSessionSelect: props.onQaSessionSelect,
    onSessionDelete: props.onQaSessionDelete,
    onAppendSelectedExcerpt: props.onAppendSelectedExcerptToQa,
    onSelectImageAttachments: props.onSelectImageAttachments,
    onSelectFileAttachments: props.onSelectFileAttachments,
    onCaptureScreenshot: props.onCaptureScreenshot,
    onRemoveAttachment: props.onRemoveAttachment,
    onCitationClick: props.onCitationClick,
    onSaveAssistantMessageAsNote: props.onSaveAssistantMessageAsNote,
  };

  useEffect(() => {
    if (workspaceStage !== 'reading') {
      setImmersiveReading(false);
    }
  }, [workspaceStage]);

  useEffect(() => {
    if (!immersiveReading) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImmersiveReading(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [immersiveReading]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#f8fafc,#f1f5f9)] dark:bg-[linear-gradient(180deg,#0f1a2e,#0c1525)]">
      {!immersiveReading ? (
        <ReaderWorkspaceHeader
          sourceLabel={sourceLabel}
          documentTitle={currentDocument.title}
          documentCreators={currentDocument.creators}
          documentYear={currentDocument.year}
          currentPdfName={currentPdfName}
          currentPdfVariantLabel={currentPdfVariantLabel}
          currentPdfPath={currentPdfPath}
          availablePdfOptions={availablePdfOptions}
          workspaceStage={workspaceStage}
          readingViewMode={readingViewMode}
          loading={loading}
          translating={translating}
          onStageChange={onStageChange}
          onReadingViewModeChange={onReadingViewModeChange}
          onCurrentPdfPathChange={onCurrentPdfPathChange}
          onOpenMineruJson={onOpenMineruJson}
          onCloudParse={onCloudParse}
          onTranslateDocument={onTranslateDocument}
          onOpenPreferences={onOpenPreferences}
          onEnterImmersive={() => setImmersiveReading(true)}
        />
      ) : null}

      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-600 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-400">
          {error}
        </div>
      ) : null}

      {workspaceStage === 'overview' ? (
        <ReaderWorkspaceOverview
          currentDocument={props.currentDocument}
          selectedSectionTitle={props.selectedSectionTitle}
          currentPdfName={props.currentPdfName}
          currentJsonName={props.currentJsonName}
          loading={props.loading}
          translating={props.translating}
          blocks={props.blocks}
          translationProgressCompleted={props.translationProgressCompleted}
          translationProgressTotal={props.translationProgressTotal}
          paperSummary={props.paperSummary}
          paperSummaryLoading={props.paperSummaryLoading}
          paperSummaryError={props.paperSummaryError}
          onGenerateSummary={props.onGenerateSummary}
          onEnterReading={() => props.onStageChange('reading')}
          onOpenMineruJson={props.onOpenMineruJson}
          onCloudParse={props.onCloudParse}
          onTranslateDocument={props.onTranslateDocument}
          aiConfigured={props.aiConfigured}
        />
      ) : (
        <ReadingStage {...props} immersiveReading={immersiveReading} />
      )}

      {immersiveReading ? (
        <button
          type="button"
          onClick={() => setImmersiveReading(false)}
          className="fixed bottom-14 right-5 z-[120] inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white/92 px-3 text-sm font-medium text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-[var(--pq-surface-1)] dark:text-[var(--pq-text)] dark:hover:bg-[var(--pq-surface-2)]"
          title={l('退出沉浸', 'Exit Immersive')}
          aria-label={l('退出沉浸', 'Exit Immersive')}
        >
          <Minimize2 className="h-4 w-4" strokeWidth={1.8} />
          {l('退出沉浸', 'Exit')}
        </button>
      ) : null}

      {assistantDetached ? (
        <FloatingAssistantPanel
          title={currentDocument.title}
          onAttachAssistant={props.onAttachAssistant}
          chatProps={floatingAssistantChatProps}
        />
      ) : null}

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 bg-white/70 px-6 py-2.5 text-xs text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-[var(--pq-bg-primary)] dark:text-[var(--pq-text-faint)]">
        <div className="min-w-0 truncate">
          {loading || translating ? l('正在处理中...', 'Processing...') : statusMessage}
        </div>
        <div className="hidden items-center gap-4 lg:flex">
          <span>{activeBlockSummary}</span>
          <span>{l('单击预览，双击进入阅读', 'Single-click to preview, double-click to read')}</span>
          <span>Ctrl + {l('滚轮缩放', 'Scroll to zoom')}</span>
        </div>
      </footer>
    </div>
  );
}

export default ReaderWorkspace;

