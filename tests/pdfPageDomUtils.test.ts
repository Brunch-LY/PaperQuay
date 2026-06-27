import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arePageHostsEqual,
  getPageElementHeight,
  getPageTargetFromElement,
  getRenderedPageSize,
  resolveHitBlockByPoint,
} from '../src/features/pdf/pdfPageDomUtils.ts';
import type { PositionedMineruBlock } from '../src/types/reader.ts';

function pageElement(options: {
  pageNumber?: string;
  clientWidth?: number;
  clientHeight?: number;
  rect?: Partial<DOMRect>;
} = {}): HTMLDivElement {
  return {
    dataset: { pageNumber: options.pageNumber },
    clientWidth: options.clientWidth ?? 0,
    clientHeight: options.clientHeight ?? 0,
    getBoundingClientRect: () => ({
      left: options.rect?.left ?? 0,
      top: options.rect?.top ?? 0,
      width: options.rect?.width ?? 0,
      height: options.rect?.height ?? 0,
    }),
  } as HTMLDivElement;
}

function block(overrides: Partial<PositionedMineruBlock> = {}): PositionedMineruBlock {
  return {
    blockId: overrides.blockId ?? 'block-1',
    type: overrides.type ?? 'paragraph',
    content: overrides.content ?? 'content',
    pageIndex: overrides.pageIndex ?? 0,
    blockIndex: overrides.blockIndex ?? 0,
    bbox: overrides.bbox ?? [0, 0, 100, 100],
    bboxCoordinateSystem: overrides.bboxCoordinateSystem,
    bboxPageSize: overrides.bboxPageSize,
  };
}

test('getPageTargetFromElement maps one-based page numbers to zero-based indexes', () => {
  const page = pageElement({ pageNumber: '3' });

  assert.deepEqual(getPageTargetFromElement(page), {
    pageElement: page,
    pageIndex: 2,
  });
  assert.equal(getPageTargetFromElement(pageElement({ pageNumber: '0' })), null);
  assert.equal(getPageTargetFromElement(pageElement({ pageNumber: 'abc' })), null);
  assert.equal(getPageTargetFromElement(null), null);
});

test('getRenderedPageSize and getPageElementHeight use client size before rect fallback', () => {
  const clientSizedPage = pageElement({
    clientWidth: 600,
    clientHeight: 800,
    rect: { width: 500, height: 700 },
  });
  const rectSizedPage = pageElement({ rect: { width: 400, height: 500 } });

  assert.deepEqual(getRenderedPageSize(clientSizedPage), { width: 600, height: 800 });
  assert.equal(getPageElementHeight(clientSizedPage), 800);
  assert.deepEqual(getRenderedPageSize(rectSizedPage), { width: 400, height: 500 });
  assert.equal(getPageElementHeight(rectSizedPage), 500);
  assert.equal(getRenderedPageSize(pageElement()), null);
});

test('arePageHostsEqual compares host identities and tolerates sub-pixel size drift', () => {
  const element = pageElement();
  const overlayElement = pageElement();
  const left = {
    0: { element, overlayElement, width: 100, height: 200 },
  };

  assert.equal(
    arePageHostsEqual(left, {
      0: { element, overlayElement, width: 100.4, height: 199.7 },
    }),
    true,
  );
  assert.equal(
    arePageHostsEqual(left, {
      0: { element, overlayElement, width: 101, height: 200 },
    }),
    false,
  );
  assert.equal(arePageHostsEqual(left, {}), false);
});

test('resolveHitBlockByPoint returns the smallest matching block', () => {
  const targetPage = pageElement({ rect: { left: 10, top: 20, width: 1000, height: 1000 } });
  const hitBlock = resolveHitBlockByPoint(
    65,
    75,
    targetPage,
    [
      block({ blockId: 'large', bbox: [0, 0, 200, 200] }),
      block({ blockId: 'small', bbox: [40, 40, 80, 80] }),
      block({ blockId: 'miss', bbox: [500, 500, 600, 600] }),
    ],
    { width: 1000, height: 1000 },
    { width: 1000, height: 1000 },
  );

  assert.equal(hitBlock?.blockId, 'small');
  assert.equal(
    resolveHitBlockByPoint(
      900,
      900,
      targetPage,
      [block({ blockId: 'large', bbox: [0, 0, 200, 200] })],
      { width: 1000, height: 1000 },
      { width: 1000, height: 1000 },
    ),
    null,
  );
});
