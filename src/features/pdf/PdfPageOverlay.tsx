import type { Dispatch, SetStateAction } from 'react';
import type {
  PaperAnnotation,
  PdfHighlightTarget,
  PositionedMineruBlock,
} from '../../types/reader';
import { bboxToCssStyle, bboxToRect, type PageSize } from '../../utils/bbox';
import { cn } from '../../utils/cn';
import { resolveBBoxBaseSize } from './pdfViewerUtils';

type LocaleText = (zh: string, en: string) => string;

interface PdfPageOverlayProps {
  pageIndex: number;
  originalPage: PageSize;
  renderedPage: PageSize;
  pageBlocks: PositionedMineruBlock[];
  pageAnnotations: PaperAnnotation[];
  activeBlock: PositionedMineruBlock | null;
  activeBlockId: string | null;
  hoveredBlockId: string | null;
  selectedAnnotationId: string | null;
  activeHighlight: PdfHighlightTarget | null;
  activeHighlightSource: PdfHighlightTarget | PositionedMineruBlock | null;
  annotationComposerBlock: PositionedMineruBlock | null;
  annotationComposerBlockId: string | null;
  annotationDraft: string;
  allowLinkedInteractions: boolean;
  onAnnotationSelect?: (annotationId: string) => void;
  onAnnotationCreate?: (note: string) => void;
  setAnnotationComposerBlockId: Dispatch<SetStateAction<string | null>>;
  setAnnotationDraft: Dispatch<SetStateAction<string>>;
  l: LocaleText;
}

export function PdfPageOverlay({
  pageIndex,
  originalPage,
  renderedPage,
  pageBlocks,
  pageAnnotations,
  activeBlock,
  activeBlockId,
  hoveredBlockId,
  selectedAnnotationId,
  activeHighlight,
  activeHighlightSource,
  annotationComposerBlock,
  annotationComposerBlockId,
  annotationDraft,
  allowLinkedInteractions,
  onAnnotationSelect,
  onAnnotationCreate,
  setAnnotationComposerBlockId,
  setAnnotationDraft,
  l,
}: PdfPageOverlayProps) {
  const composerAnchorBlock = annotationComposerBlock ?? activeBlock;
  const composerAnchorRect =
    composerAnchorBlock != null
      ? bboxToRect(
          composerAnchorBlock.bbox!,
          resolveBBoxBaseSize(composerAnchorBlock, originalPage),
          renderedPage,
        )
      : null;

  return (
    <div className="paperquay-page-overlay relative h-full w-full pointer-events-none">
      {pageBlocks.map((block) => (
        <div
          key={block.blockId}
          aria-label={block.blockId}
          className={cn(
            'absolute rounded-lg border transition-all duration-150',
            hoveredBlockId === block.blockId && 'border-amber-300 bg-amber-200/18',
            activeBlockId === block.blockId &&
              'border-indigo-400 bg-indigo-300/14 shadow-[0_0_0_1px_rgba(99,102,241,0.18)]',
            hoveredBlockId !== block.blockId &&
              activeBlockId !== block.blockId &&
              'border-transparent bg-transparent',
          )}
          style={bboxToCssStyle(
            block.bbox!,
            resolveBBoxBaseSize(block, originalPage),
            renderedPage,
          )}
        />
      ))}

      {pageAnnotations.map((annotation, index) => {
        const isNoteAnchor = annotation.id.startsWith('note-anchor:');
        const annotationStyle = bboxToCssStyle(
          annotation.bbox,
          resolveBBoxBaseSize(annotation, originalPage),
          renderedPage,
        );
        const annotationTitle =
          annotation.note ||
          annotation.quote ||
          l(`批注 ${index + 1}`, `Annotation ${index + 1}`);

        if (isNoteAnchor) {
          return (
            <div
              key={annotation.id}
              className={cn(
                'pointer-events-none absolute rounded-lg border-2 transition-all duration-150',
                selectedAnnotationId === annotation.id
                  ? 'border-amber-500 bg-amber-200/18 shadow-[0_0_0_1px_rgba(245,158,11,0.20)]'
                  : 'border-amber-300/80 bg-amber-200/10',
              )}
              style={annotationStyle}
              title={annotationTitle}
            >
              {allowLinkedInteractions ? (
                <button
                  type="button"
                  data-annotation-ui="true"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAnnotationSelect?.(annotation.id);
                  }}
                  className="pointer-events-auto absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white shadow-sm transition hover:bg-amber-600"
                  title={annotationTitle}
                >
                  {index + 1}
                </button>
              ) : null}
            </div>
          );
        }

        return (
          <button
            key={annotation.id}
            type="button"
            data-annotation-ui="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onAnnotationSelect?.(annotation.id);
            }}
            className={cn(
              'absolute rounded-lg border-2 transition-all duration-150',
              allowLinkedInteractions ? 'pointer-events-auto' : 'pointer-events-none',
              selectedAnnotationId === annotation.id
                ? 'border-amber-500 bg-amber-200/18 shadow-[0_0_0_1px_rgba(245,158,11,0.20)]'
                : 'border-amber-300/90 bg-amber-200/10 hover:bg-amber-200/16',
            )}
            style={annotationStyle}
            title={annotationTitle}
          >
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white shadow-sm">
              {index + 1}
            </span>
          </button>
        );
      })}

      {activeHighlight && activeHighlight.pageIndex === pageIndex && activeHighlightSource ? (
        <div
          className="absolute z-[5] rounded-lg border-2 border-indigo-500 bg-indigo-200/18 shadow-[0_0_0_1px_rgba(79,70,229,0.18)]"
          style={bboxToCssStyle(
            activeHighlight.bbox,
            resolveBBoxBaseSize(activeHighlightSource, originalPage),
            renderedPage,
          )}
        />
      ) : null}

      {allowLinkedInteractions && composerAnchorRect && onAnnotationCreate ? (
        <>
          <button
            type="button"
            data-label={l('批注', 'Annotate')}
            data-annotation-ui="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              setAnnotationComposerBlockId((current) =>
                current === composerAnchorBlock?.blockId
                  ? null
                  : composerAnchorBlock?.blockId ?? null,
              );
              setAnnotationDraft('');
            }}
            className="pointer-events-auto absolute z-[6] inline-flex items-center rounded-full border border-slate-200 bg-white/96 px-3 py-1.5 text-[0px] font-medium shadow-[0_10px_20px_rgba(15,23,42,0.12)] transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-[var(--pq-surface-1)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.24)] dark:hover:border-white/15 dark:hover:bg-[var(--pq-surface-2)] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-medium after:text-slate-700 after:content-[attr(data-label)] dark:after:text-[var(--pq-text-muted)]"
            style={{
              left: `${Math.min(
                Math.max(composerAnchorRect.left, 8),
                Math.max(renderedPage.width - 108, 8),
              )}px`,
              top: `${Math.max(composerAnchorRect.top - 38, 8)}px`,
            }}
          >
            {l('批注', 'Annotate')}
          </button>

          {annotationComposerBlockId === composerAnchorBlock?.blockId ? (
            <div
              data-annotation-ui="true"
              className="pointer-events-auto absolute z-[6] w-72 rounded-2xl border border-slate-200 bg-white/96 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[var(--pq-surface-1)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
              style={{
                left: `${Math.min(
                  Math.max(composerAnchorRect.left, 8),
                  Math.max(renderedPage.width - 288, 8),
                )}px`,
                top: `${Math.min(
                  composerAnchorRect.top + composerAnchorRect.height + 10,
                  Math.max(renderedPage.height - 176, 8),
                )}px`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--pq-text-faint)]">
                {l('页面批注', 'Page Annotation')}
              </div>
              <textarea
                value={annotationDraft}
                onChange={(event) => setAnnotationDraft(event.target.value)}
                placeholder={l(
                  'Write an annotation for the current block, or save the marker only.',
                  'Write an annotation for the current block, or save the marker only.',
                )}
                className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white dark:border-white/10 dark:bg-[var(--pq-surface-1)] dark:text-[var(--pq-text-muted)] dark:focus:border-indigo-400/40 dark:focus:bg-[var(--pq-surface-2)]"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAnnotationCreate(annotationDraft);
                    setAnnotationDraft('');
                    setAnnotationComposerBlockId(null);
                  }}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-[var(--pq-accent)] dark:text-[var(--pq-text)] dark:hover:bg-[var(--pq-accent-hover)]"
                >
                  {l('保存批注', 'Save Annotation')}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-label={l('Save Marker', 'Save Marker')}
                    onClick={() => {
                      onAnnotationCreate('');
                      setAnnotationDraft('');
                      setAnnotationComposerBlockId(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0px] font-medium transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--pq-surface-1)] dark:hover:border-white/15 dark:hover:bg-[var(--pq-surface-2)] after:text-xs after:font-medium after:text-slate-700 after:content-[attr(data-label)] dark:after:text-[var(--pq-text-muted)]"
                  >
                    {l('Save Marker', 'Save Marker')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnnotationComposerBlockId(null);
                      setAnnotationDraft('');
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--pq-surface-1)] dark:text-[var(--pq-text-muted)] dark:hover:border-white/15 dark:hover:bg-[var(--pq-surface-2)]"
                  >
                    {l('取消', 'Cancel')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
