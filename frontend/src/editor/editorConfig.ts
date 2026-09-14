import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';

export const initialConfig = {
  namespace: 'WerketEditor',
  nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
  theme: {
    paragraph: 'editor-paragraph',
    heading: {
      h1: 'editor-heading-h1', h2: 'editor-heading-h2', h3: 'editor-heading-h3',
      h4: 'editor-heading-h4', h5: 'editor-heading-h5', h6: 'editor-heading-h6',
    },
    quote: 'editor-blockquote',
    list: { listitem: 'editor-list-item', nested: { listitem: 'editor-nested-list-item' }, ol: 'editor-ordered-list', ul: 'editor-unordered-list' },
    text: {
      bold: 'editor-text-bold', italic: 'editor-text-italic', underline: 'editor-text-underline',
      strikethrough: 'editor-text-strikethrough', code: 'editor-text-code',
    },
  },
  onError(error: Error) {
    console.error('Lexical editor error:', error);
  },
};
