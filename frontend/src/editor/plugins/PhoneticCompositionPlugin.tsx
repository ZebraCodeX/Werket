/**
 * Phonetic Composition Plugin for Amharic (Ethiopic) input
 * Uses Lexical's beforeinput handling to intercept keystrokes and compose Fidel characters.
 * Reuses the shared phonetic engine from utils/phonetic.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLayoutEffect, useRef, useCallback } from 'react';
import { $getSelection, $isRangeSelection } from 'lexical';
import {
  processPhoneticKey,
  flushPhoneticBuffer,
  initialPhoneticState,
  type PhoneticState,
} from '../../utils/phonetic';

export function PhoneticCompositionPlugin({
  isAmharicDoc,
  phoneticMode,
}: {
  isAmharicDoc: boolean;
  phoneticMode: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const phoneticStateRef = useRef<PhoneticState>(initialPhoneticState);
  const configRef = useRef({ isAmharicDoc, phoneticMode });

  useLayoutEffect(() => {
    configRef.current = { isAmharicDoc, phoneticMode };
  }, [isAmharicDoc, phoneticMode]);

  const insertText = useCallback((text: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
  }, [editor]);

  useLayoutEffect(() => {
    const { isAmharicDoc, phoneticMode } = configRef.current;
    if (!isAmharicDoc || !phoneticMode) {
      if (phoneticStateRef.current.buffer.length > 0) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) insertText(flushed);
        phoneticStateRef.current = initialPhoneticState;
      }
      return;
    }

    const handleBeforeInput = (event: InputEvent) => {
      const { isAmharicDoc, phoneticMode } = configRef.current;
      if (!isAmharicDoc || !phoneticMode) return;

      if (event.inputType !== 'insertText' || !event.data) {
        return;
      }

      const text = event.data;

      if (/[\u1200-\u137f]/u.test(text)) return;

      if (text.length !== 1) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) insertText(flushed);
        phoneticStateRef.current = initialPhoneticState;
        return;
      }

      const result = processPhoneticKey(phoneticStateRef.current, text, false);

      if (result.consumed) {
        event.preventDefault();
        phoneticStateRef.current = result.newState;

        if (result.output) {
          insertText(result.output);
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const { isAmharicDoc, phoneticMode } = configRef.current;
      if (!isAmharicDoc || !phoneticMode) return;

      const { key, ctrlKey, metaKey } = event;
      const isMod = ctrlKey || metaKey;

      if (isMod) return;

      if (key === 'Backspace') {
        if (phoneticStateRef.current.buffer.length > 0) {
          event.preventDefault();
          const result = processPhoneticKey(phoneticStateRef.current, '', true);
          phoneticStateRef.current = result.newState;
        }
        return;
      }

      if (['Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(key)) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) insertText(flushed);
        phoneticStateRef.current = initialPhoneticState;
        return;
      }
    };

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener('beforeinput', handleBeforeInput as EventListener);
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rootElement) {
        rootElement.removeEventListener('beforeinput', handleBeforeInput as EventListener);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, isAmharicDoc, phoneticMode, insertText]);

  return null;
}