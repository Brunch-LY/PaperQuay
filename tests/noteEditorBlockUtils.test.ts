import test from 'node:test';
import assert from 'node:assert/strict';

import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  clampDocPosition,
  getBlockLabelFromNode,
  getEditorContextAtPoint,
  getEditorContextAtPosition,
  getTextPositionInsideBlock,
  getTopLevelBlockRangeAtPos,
  getTopLevelBlocks,
  isEditorPositionInTable,
  resolveActiveBlock,
  toActiveNoteBlock,
  type NoteBlockRange,
} from '../src/features/notes/noteEditorBlockUtils.ts';

function block(
  name: string,
  nodeSize: number,
  attrs: Record<string, unknown> = {},
  descendants: Array<{ name: string; pos: number; isTextblock?: boolean }> = [],
): ProseMirrorNode {
  return {
    type: { name },
    attrs,
    nodeSize,
    isAtom: false,
    isLeaf: false,
    textContent: '',
    descendants(callback: (node: ProseMirrorNode, pos: number) => boolean | void) {
      for (const child of descendants) {
        const shouldContinue = callback({
          type: { name: child.name },
          attrs: {},
          nodeSize: 1,
          isAtom: false,
          isLeaf: false,
          isTextblock: Boolean(child.isTextblock),
          textContent: '',
        } as ProseMirrorNode, child.pos);
        if (shouldContinue === false) break;
      }
    },
    toJSON() {
      return { type: name, attrs };
    },
  } as unknown as ProseMirrorNode;
}

function editorWithBlocks(
  blocks: ProseMirrorNode[],
  options: {
    selectionFrom?: number;
    posAtCoords?: number | null;
    resolvedNodeNames?: string[];
  } = {},
): Editor {
  const contentSize = blocks.reduce((sum, node) => sum + node.nodeSize, 0);
  const doc = {
    content: { size: contentSize },
    childCount: blocks.length,
    forEach(callback: (node: ProseMirrorNode, offset: number) => void) {
      let offset = 0;
      for (const node of blocks) {
        callback(node, offset);
        offset += node.nodeSize;
      }
    },
    resolve() {
      const names = options.resolvedNodeNames ?? [];
      return {
        depth: names.length,
        node(depth: number) {
          return { type: { name: names[depth - 1] ?? 'doc' } };
        },
      };
    },
  };

  return {
    state: {
      doc,
      selection: { from: options.selectionFrom ?? 0 },
    },
    view: {
      posAtCoords() {
        return typeof options.posAtCoords === 'number' ? { pos: options.posAtCoords } : null;
      },
    },
  } as unknown as Editor;
}

test('block labels match editor menu names', () => {
  assert.equal(getBlockLabelFromNode(block('heading', 3, { level: 2 })), 'Heading 2');
  assert.equal(getBlockLabelFromNode(block('paragraph', 3)), 'Paragraph');
  assert.equal(getBlockLabelFromNode(block('bulletList', 5)), 'Bullet list');
  assert.equal(getBlockLabelFromNode(block('noteAnchorBlock', 1)), '引用');
  assert.equal(getBlockLabelFromNode(block('unknownBlock', 1)), 'Block');
});

test('top-level block ranges use ProseMirror document offsets', () => {
  const first = block('paragraph', 3);
  const second = block('heading', 5, { level: 1 });
  const third = block('table', 7);
  const editor = editorWithBlocks([first, second, third]);

  assert.deepEqual(
    getTopLevelBlocks(editor).map((range) => [range.node.type.name, range.from, range.to]),
    [
      ['paragraph', 0, 3],
      ['heading', 3, 8],
      ['table', 8, 15],
    ],
  );
  assert.equal(getTopLevelBlockRangeAtPos(editor, 0)?.node, first);
  assert.equal(getTopLevelBlockRangeAtPos(editor, 4)?.node, second);
  assert.equal(getTopLevelBlockRangeAtPos(editor, 99)?.node, third);
});

test('editor context clamps positions and detects table contexts', () => {
  const paragraph = block('paragraph', 3);
  const table = block('table', 5);
  const editor = editorWithBlocks([paragraph, table], { resolvedNodeNames: ['paragraph'] });

  assert.equal(clampDocPosition(editor, -5), 0);
  assert.equal(clampDocPosition(editor, 99), 8);

  const context = getEditorContextAtPosition(editor, 99);
  assert.equal(context?.position, 8);
  assert.equal(context?.block.node, table);
  assert.equal(context?.inTable, true);

  const nestedTableEditor = editorWithBlocks([paragraph], { resolvedNodeNames: ['paragraph', 'table'] });
  const paragraphRange = getTopLevelBlockRangeAtPos(nestedTableEditor, 1) as NoteBlockRange;
  assert.equal(isEditorPositionInTable(nestedTableEditor, 1, paragraphRange), true);
});

test('editor context at point falls back to the current selection', () => {
  const first = block('paragraph', 3);
  const second = block('heading', 5, { level: 1 });
  const editor = editorWithBlocks([first, second], { selectionFrom: 4, posAtCoords: null });

  const context = getEditorContextAtPoint(editor, 10, 20);
  assert.equal(context?.position, 4);
  assert.equal(context?.block.node, second);
});

test('active block resolution and move flags stay in sync with current document ranges', () => {
  const first = block('paragraph', 3);
  const second = block('heading', 5, { level: 2 });
  const third = block('codeBlock', 4);
  const editor = editorWithBlocks([first, second, third], { selectionFrom: 4 });
  const secondRange = getTopLevelBlockRangeAtPos(editor, 4) as NoteBlockRange;

  assert.deepEqual(toActiveNoteBlock(editor, secondRange), {
    node: second,
    from: 3,
    to: 8,
    label: 'Heading 2',
    canMoveUp: true,
    canMoveDown: true,
  });

  assert.deepEqual(resolveActiveBlock(editor, { ...secondRange, from: 30, to: 40 }), secondRange);
  assert.equal(toActiveNoteBlock(editor, getTopLevelBlockRangeAtPos(editor, 0) as NoteBlockRange).canMoveUp, false);
  assert.equal(toActiveNoteBlock(editor, getTopLevelBlockRangeAtPos(editor, 12) as NoteBlockRange).canMoveDown, false);
});

test('text position lookup prefers the first textblock descendant', () => {
  const component = block('noteComponentBlock', 10, {}, [
    { name: 'image', pos: 1 },
    { name: 'paragraph', pos: 3, isTextblock: true },
  ]);
  const editor = editorWithBlocks([block('heading', 4), component]);
  const range = getTopLevelBlockRangeAtPos(editor, 5) as NoteBlockRange;

  assert.equal(getTextPositionInsideBlock(editor, range), 8);
});
