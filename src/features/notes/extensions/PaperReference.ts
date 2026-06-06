import type { Range } from '@tiptap/core';
import { mergeAttributes, Node } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { Suggestion } from '@tiptap/suggestion';
import { createSuggestionMenu, type NoteSuggestionItem } from './suggestionMenu';

export interface PaperReferenceOptions {
  HTMLAttributes: Record<string, unknown>;
  items: (query: string) => NoteSuggestionItem[];
  onClick: (paperId: string) => void;
}

export const PaperReference = Node.create<PaperReferenceOptions>({
  name: 'paperReference',
  priority: 100,
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      items: () => [],
      onClick: () => undefined,
    };
  },

  addAttributes() {
    return {
      paperId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-paper-id'),
        renderHTML: (attributes) => attributes.paperId ? { 'data-paper-id': attributes.paperId } : {},
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => attributes.label ? { 'data-label': attributes.label } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }): DOMOutputSpec {
    const paperId = node.attrs.paperId || '';
    const label = node.attrs.label || paperId;

    return [
      'span',
      mergeAttributes(
        { 'data-type': this.name, 'data-paper-id': paperId, 'data-label': label },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `@${label}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.paperId || node.attrs.label || ''}`;
  },

  addProseMirrorPlugins() {
    const suggestion: SuggestionOptions<NoteSuggestionItem, NoteSuggestionItem> = {
      editor: this.editor,
      char: '@',
      pluginKey: new PluginKey('paperReferenceSuggestion'),
      allowSpaces: false,
      allowedPrefixes: null,
      items: ({ query }) => this.options.items(query),
      command: ({ editor, range, props }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range as Range, [
            {
              type: this.name,
              attrs: {
                paperId: props.id,
                label: props.label,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();
      },
      render: createSuggestionMenu,
    };

    return [
      Suggestion(suggestion),
      new Plugin({
        key: new PluginKey('paperReferenceClick'),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target as HTMLElement | null;
            const element = target?.closest?.('span[data-type="paperReference"]') as HTMLElement | null;
            const paperId = element?.getAttribute('data-paper-id');

            if (!paperId) return false;
            this.options.onClick(paperId);
            return true;
          },
        },
      }),
    ];
  },
});
