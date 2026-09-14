import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
import { $getRoot } from 'lexical';
import { $generateNodesFromDOM } from '@lexical/html';
import type { File } from '../../types/workspace';

export function LoadContentPlugin({ file }: { file?: File }) {
  const [editor] = useLexicalComposerContext();
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (!file || loadedId.current === file.id) return;
    loadedId.current = file.id;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      if (file.text) {
        const container = document.createElement('div');
        container.innerHTML = file.text;
        root.append(...$generateNodesFromDOM(editor, container));
      }
    });
  }, [editor, file]);

  return null;
}
