import type { Range } from '@tiptap/core';
import { mergeAttributes, Node } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { Suggestion } from '@tiptap/suggestion';
import { createSuggestionMenu, type NoteSuggestionItem } from './suggestionMenu';

export interface HashTagOptions {
  HTMLAttributes: Record<string, unknown>;
  items: (query: string) => NoteSuggestionItem[];
  onClick: (tag: string) => void;
}

export const HashTag = Node.create<HashTagOptions>({
  name: 'hashTag',
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
      tag: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag'),
        renderHTML: (attributes) => attributes.tag ? { 'data-tag': attributes.tag } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }): DOMOutputSpec {
    const tag = node.attrs.tag || '';
    return [
      'span',
      mergeAttributes(
        { 'data-type': this.name, 'data-tag': tag },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `#${tag}`,
    ];
  },

  renderText({ node }) {
    return `#${node.attrs.tag || ''}`;
  },

  addProseMirrorPlugins() {
    const suggestion: SuggestionOptions<NoteSuggestionItem, NoteSuggestionItem> = {
      editor: this.editor,
      char: '#',
      pluginKey: new PluginKey('hashTagSuggestion'),
      allowSpaces: false,
      allowedPrefixes: null,
      items: ({ query }) => this.options.items(query),
      command: ({ editor, range, props }) => {
        const tag = props.label.replace(/^#/, '');

        editor
          .chain()
          .focus()
          .insertContentAt(range as Range, [
            { type: this.name, attrs: { tag } },
            { type: 'text', text: ' ' },
          ])
          .run();
      },
      render: createSuggestionMenu,
    };

    return [
      Suggestion(suggestion),
      new Plugin({
        key: new PluginKey('hashTagClick'),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target as HTMLElement | null;
            const element = target?.closest?.('span[data-type="hashTag"]') as HTMLElement | null;
            const tag = element?.getAttribute('data-tag');

            if (!tag) return false;
            this.options.onClick(tag);
            return true;
          },
        },
      }),
    ];
  },
});
