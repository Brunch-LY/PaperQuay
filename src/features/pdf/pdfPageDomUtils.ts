import type { TextSelectionPayload, PositionedMineruBlock } from '../../types/reader';
import { bboxToRect, type PageSize } from '../../utils/bbox.ts';
import { normalizeSelectionText } from '../../utils/text.ts';
import { resolveBBoxBaseSize } from './pdfViewerUtils.ts';

export interface PageHostState {
  element: HTMLDivElement;
  overlayElement: HTMLDivElement;
  width: number;
  height: number;
}

export interface PdfPageTarget {
  pageElement: HTMLDivElement;
  pageIndex: number;
}

export function hasActiveTextSelection(): boolean {
  const selection = window.getSelection();

  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

export function ensurePageOverlayElement(pageElement: HTMLDivElement): HTMLDivElement {
  pageElement.style.position ||= 'relative';

  let overlayElement = pageElement.querySelector<HTMLDivElement>('.paperquay-page-overlay-host');

  if (!overlayElement) {
    overlayElement = document.createElement('div');
    overlayElement.className = 'paperquay-page-overlay-host';
    overlayElement.style.position = 'absolute';
    overlayElement.style.inset = '0';
    overlayElement.style.pointerEvents = 'none';
    overlayElement.style.zIndex = '4';
    pageElement.appendChild(overlayElement);
  }

  return overlayElement;
}

export function getPageTargetFromElement(pageElement: HTMLDivElement | null): PdfPageTarget | null {
  if (!pageElement) {
    return null;
  }

  const pageNumber = Number(pageElement.dataset.pageNumber ?? 0);

  if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
    return null;
  }

  return {
    pageElement,
    pageIndex: pageNumber - 1,
  };
}

export function getRenderedPageSize(pageElement: HTMLDivElement): PageSize | null {
  const rect = pageElement.getBoundingClientRect();
  const width = pageElement.clientWidth || rect.width;
  const height = pageElement.clientHeight || rect.height;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

export function getScopedSelectionPayload(container: HTMLElement | null): TextSelectionPayload | null {
  const selection = window.getSelection();

  if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const text = normalizeSelectionText(selection.toString());

  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const targetNode =
    commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;

  if (!targetNode || !container.contains(targetNode)) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  const anchorClientX = rect.width > 0 ? rect.left + rect.width / 2 : rect.left;
  const anchorClientY = rect.bottom;
  const targetElement = targetNode instanceof Element ? targetNode : null;
  const pageElement = targetElement?.closest('.page');
  const pageTarget = pageElement instanceof HTMLDivElement ? getPageTargetFromElement(pageElement) : null;
  const renderedPage = pageElement instanceof HTMLDivElement ? getRenderedPageSize(pageElement) : null;
  const pageRect = pageElement instanceof HTMLDivElement ? pageElement.getBoundingClientRect() : null;
  const normalizedSelectionRect =
    pageTarget && renderedPage && pageRect && rect.width > 0 && rect.height > 0
      ? {
          x: Math.max(0, Math.min(1000, ((rect.left - pageRect.left) / renderedPage.width) * 1000)),
          y: Math.max(0, Math.min(1000, ((rect.top - pageRect.top) / renderedPage.height) * 1000)),
          width: Math.max(1, Math.min(1000, (rect.width / renderedPage.width) * 1000)),
          height: Math.max(1, Math.min(1000, (rect.height / renderedPage.height) * 1000)),
        }
      : null;
  const pdfLocation =
    pageTarget && normalizedSelectionRect
      ? {
          pageNumber: pageTarget.pageIndex + 1,
          boundingRect: normalizedSelectionRect,
          bbox: [
            normalizedSelectionRect.x,
            normalizedSelectionRect.y,
            Math.min(1000, normalizedSelectionRect.x + normalizedSelectionRect.width),
            Math.min(1000, normalizedSelectionRect.y + normalizedSelectionRect.height),
          ] as [number, number, number, number],
          bboxCoordinateSystem: 'normalized-1000' as const,
          bboxPageSize: [1000, 1000] as [number, number],
        }
      : undefined;

  return {
    text,
    anchorClientX,
    anchorClientY,
    placement: 'bottom',
    pdfLocation,
  };
}

export function selectionBelongsToContainer(container: HTMLElement | null): boolean {
  const selection = window.getSelection();

  if (!container || !selection) {
    return false;
  }

  if (
    (selection.anchorNode && container.contains(selection.anchorNode)) ||
    (selection.focusNode && container.contains(selection.focusNode))
  ) {
    return true;
  }

  if (selection.rangeCount === 0) {
    return false;
  }

  return container.contains(selection.getRangeAt(0).commonAncestorContainer);
}

export function isAnnotationUiTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-annotation-ui="true"]'));
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function getPageElementHeight(pageElement: HTMLDivElement): number {
  const rect = pageElement.getBoundingClientRect();

  return pageElement.clientHeight || rect.height || 0;
}

export function resolveScrollAnchorPage(
  container: HTMLDivElement,
  viewer: HTMLDivElement | null,
  fallbackPage: number,
): {
  page: number;
  pageElement: HTMLDivElement | null;
} {
  const fallbackPageNumber = Math.max(1, fallbackPage || 1);
  const fallbackPageElement =
    viewer?.querySelector<HTMLDivElement>(`.page[data-page-number="${fallbackPageNumber}"]`) ??
    null;

  if (!viewer) {
    return {
      page: fallbackPageNumber,
      pageElement: null,
    };
  }

  const containerRect = container.getBoundingClientRect();
  const anchorClientX =
    containerRect.left + Math.min(Math.max(containerRect.width / 2, 1), Math.max(1, containerRect.width - 1));
  const anchorClientY =
    containerRect.top + Math.min(48, Math.max(8, containerRect.height * 0.04));
  const elements = document.elementsFromPoint(anchorClientX, anchorClientY);

  for (const element of elements) {
    if (!viewer.contains(element)) {
      continue;
    }

    const pageElement = element.classList.contains('page')
      ? element
      : element.closest('.page');

    if (pageElement instanceof HTMLDivElement && viewer.contains(pageElement)) {
      const page = Number(pageElement.dataset.pageNumber ?? fallbackPageNumber);

      return {
        page: Number.isFinite(page) && page > 0 ? page : fallbackPageNumber,
        pageElement,
      };
    }
  }

  return {
    page: fallbackPageNumber,
    pageElement: fallbackPageElement,
  };
}

export function resolveHitBlockByPoint(
  clientX: number,
  clientY: number,
  pageElement: HTMLDivElement,
  pageBlocks: PositionedMineruBlock[],
  originalPage: PageSize,
  renderedPage: PageSize,
): PositionedMineruBlock | null {
  const pageRect = pageElement.getBoundingClientRect();
  const offsetX = clientX - pageRect.left;
  const offsetY = clientY - pageRect.top;
  const tolerance = 6;
  let bestBlock: PositionedMineruBlock | null = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const block of pageBlocks) {
    const rect = bboxToRect(
      block.bbox!,
      resolveBBoxBaseSize(block, originalPage),
      renderedPage,
    );

    const isHit =
      offsetX >= rect.left - tolerance &&
      offsetX <= rect.left + rect.width + tolerance &&
      offsetY >= rect.top - tolerance &&
      offsetY <= rect.top + rect.height + tolerance;

    if (!isHit) {
      continue;
    }

    const area = rect.width * rect.height;

    if (area < bestArea) {
      bestArea = area;
      bestBlock = block;
    }
  }

  return bestBlock;
}

export function getPageElementFromTargetOrPoint(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
  viewer?: HTMLDivElement | null,
): HTMLDivElement | null {
  const targetPage =
    target instanceof Element ? (target.closest('.page') as HTMLDivElement | null) : null;

  if (targetPage) {
    return targetPage;
  }

  if (!viewer) {
    return null;
  }

  const elements = document.elementsFromPoint(clientX, clientY);

  for (const element of elements) {
    if (!viewer.contains(element)) {
      continue;
    }

    const pageElement = element.classList.contains('page')
      ? element
      : element.closest('.page');

    if (pageElement instanceof HTMLDivElement && viewer.contains(pageElement)) {
      return pageElement;
    }
  }

  return null;
}

export function getPageTargetFromEvent(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
  viewer?: HTMLDivElement | null,
): PdfPageTarget | null {
  return getPageTargetFromElement(getPageElementFromTargetOrPoint(target, clientX, clientY, viewer));
}

export function arePageHostsEqual(
  left: Record<number, PageHostState>,
  right: Record<number, PageHostState>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftHost = left[Number(key)];
    const rightHost = right[Number(key)];

    return (
      leftHost?.element === rightHost?.element &&
      leftHost?.overlayElement === rightHost?.overlayElement &&
      Math.abs((leftHost?.width ?? 0) - (rightHost?.width ?? 0)) < 0.5 &&
      Math.abs((leftHost?.height ?? 0) - (rightHost?.height ?? 0)) < 0.5
    );
  });
}
