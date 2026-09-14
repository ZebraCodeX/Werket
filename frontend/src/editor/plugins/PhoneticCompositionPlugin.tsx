/**
 * Phonetic Composition Plugin for Amharic (Ethiopic) input
 * Uses Lexical's beforeinput handling to intercept keystrokes and compose Fidel characters.
 * Reuses the shared phonetic engine from utils/phonetic.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
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
  deviceKeyboardMode,
}: {
  isAmharicDoc: boolean;
  phoneticMode: boolean;
  deviceKeyboardMode: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const phoneticStateRef = useRef<PhoneticState>(initialPhoneticState);

  // Insert text at the current selection (outside of a user-event update)
  const insertText = (text: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
  };

  useEffect(() => {
    if (!isAmharicDoc || !phoneticMode || deviceKeyboardMode) {
      // Flush buffer when leaving Amharic/phonetic mode
      if (phoneticStateRef.current.buffer.length > 0) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) insertText(flushed);
        phoneticStateRef.current = initialPhoneticState;
      }
      return;
    }

    // Register beforeinput listener for phonetic composition
    const handleBeforeInput = (event: InputEvent) => {
      // Only handle direct text input (not composition events)
      if (event.inputType !== 'insertText' || !event.data) {
        return;
      }

      const text = event.data;

      // Native Amharic keyboards already emit Ethiopic characters. Leave
      // those events untouched and only compose Latin phonetic input.
      if (/[\u1200-\u137f]/u.test(text)) return;

      // Only process single characters for phonetic composition
      if (text.length !== 1) {
        // Multi-character input (paste, etc.) - flush buffer first
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

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener('beforeinput', handleBeforeInput as EventListener);
    }

    // Also handle keydown for backspace and other control keys
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isAmharicDoc || !phoneticMode || deviceKeyboardMode) return;

      const { key, ctrlKey, metaKey } = event;
      const isMod = ctrlKey || metaKey;

      // Don't intercept modifier keys
      if (isMod) return;

      // Handle backspace by popping the phonetic buffer first
      if (key === 'Backspace') {
        if (phoneticStateRef.current.buffer.length > 0) {
          event.preventDefault();
          const result = processPhoneticKey(phoneticStateRef.current, '', true);
          phoneticStateRef.current = result.newState;
        }
        return;
      }

      // Flush buffer on Enter, Tab, Arrow keys, etc.
      if (['Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(key)) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) insertText(flushed);
        phoneticStateRef.current = initialPhoneticState;
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rootElement) {
        rootElement.removeEventListener('beforeinput', handleBeforeInput as EventListener);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAmharicDoc, phoneticMode, deviceKeyboardMode, editor]);

  return null;
}