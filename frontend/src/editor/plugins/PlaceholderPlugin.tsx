/**
 * Placeholder Plugin - Shows placeholder text when editor is empty
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getRoot } from 'lexical';

export function PlaceholderPlugin({ 
  placeholder = 'Start writing...',
  isAmharicDoc
}: { 
  placeholder?: string;
  isAmharicDoc: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updatePlaceholder = () => {
      editor.update(() => {
        const root = $getRoot();
        const firstChild = root.getFirstChild();
        
        // Check if editor is empty (only empty paragraph)
        const isEmpty = !firstChild || (
          firstChild.getType() === 'paragraph' &&
          firstChild.getTextContentSize() === 0
        );

        if (isEmpty) {
          // Set placeholder via data attribute on root
          const rootElement = editor.getRootElement();
          if (rootElement) {
            rootElement.setAttribute('data-placeholder', isAmharicDoc ? 'በአማርኛ ይጀምሩ...' : placeholder);
          }
        } else {
          const rootElement = editor.getRootElement();
          if (rootElement) {
            rootElement.removeAttribute('data-placeholder');
          }
        }
      });
    };

    // Initial check
    updatePlaceholder();

    // Listen for changes
    const unregister = editor.registerUpdateListener(({ dirtyElements }) => {
      if (dirtyElements.size > 0) {
        updatePlaceholder();
      }
    });

    return unregister;
  }, [editor, placeholder, isAmharicDoc]);

  return null;
}
