import type { Editor, Range } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { Suggestion } from '@tiptap/suggestion';
import { createSuggestionMenu, type NoteSuggestionItem } from './suggestionMenu';

export interface SlashCommandItem extends NoteSuggestionItem {
  aliases?: string[];
}

export interface SlashCommandOptions {
  items: (query: string) => SlashCommandItem[];
  command: (props: { editor: Editor; range: Range; item: SlashCommandItem }) => void;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',
  priority: 120,

  addOptions() {
    return {
      items: () => [],
      command: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    const suggestion: SuggestionOptions<SlashCommandItem, SlashCommandItem> = {
      editor: this.editor,
      char: '/',
      pluginKey: new PluginKey('slashCommandSuggestion'),
      startOfLine: false,
      allowSpaces: false,
      allowedPrefixes: null,
      decorationClass: 'pq-tiptap-slash-command',
      items: ({ query }) => {
        const items = this.options.items(query);
        return items.length > 0 ? items : this.options.items('');
      },
      allow: ({ editor }) => !editor.isActive('codeBlock'),
      command: ({ editor, range, props }) => {
        this.options.command({ editor, range, item: props });
      },
      render: createSuggestionMenu,
    };

    return [Suggestion(suggestion)];
  },
});
