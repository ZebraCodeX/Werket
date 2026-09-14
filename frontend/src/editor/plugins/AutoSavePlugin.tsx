/**
 * AutoSave Plugin - Debounced save to workspace
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { updateFile } from '../../store/workspaceSlice';
import { $generateHtmlFromNodes } from '@lexical/html';

export function AutoSavePlugin({ activeFileId }: { activeFileId: string | null }) {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch<AppDispatch>();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  useEffect(() => {
    if (!activeFileId) return;

    const handleChange = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        let html = '';
        editor.getEditorState().read(() => {
          html = $generateHtmlFromNodes(editor);
        });
        const isEmpty = html === '<p><br></p>' || html === '<br>';
        if (isEmpty && lastSavedContentRef.current === '') return;

        if (html !== lastSavedContentRef.current) {
          lastSavedContentRef.current = html;
          dispatch(updateFile({ id: activeFileId, text: html }));
        }
      }, 400);
    };

    const unregister = editor.registerUpdateListener(handleChange);

    return () => {
      unregister();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeFileId, editor, dispatch]);

  return null;
}