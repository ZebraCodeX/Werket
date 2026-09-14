/**
 * Phonetic Composition Plugin for Amharic (Ethiopic) input
 * Real-time composition with visual feedback (gray background like macOS/iOS IME)
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLayoutEffect, useRef, useCallback } from 'react';
import { $getSelection, $isRangeSelection, $createTextNode, TextNode } from 'lexical';
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
  const compositionNodeRef = useRef<TextNode | null>(null);
  const configRef = useRef({ isAmharicDoc, phoneticMode });

  useLayoutEffect(() => {
    configRef.current = { isAmharicDoc, phoneticMode };
  }, [isAmharicDoc, phoneticMode]);

  const removeCompositionNode = useCallback(() => {
    if (compositionNodeRef.current) {
      editor.update(() => {
        const node = compositionNodeRef.current;
        if (node && node.getParent()) {
          node.remove();
        }
        compositionNodeRef.current = null;
      });
    }
  }, [editor]);

  const replaceComposition = useCallback((composedText: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // Remove previous composition node
      if (compositionNodeRef.current) {
        const node = compositionNodeRef.current;
        if (node && node.getParent()) {
          node.remove();
        }
      }

      // Insert new composition text with gray background
      if (composedText) {
        const textNode = $createTextNode(composedText);
        // Apply gray background style for composing text (like macOS/iOS IME)
        textNode.setStyle('background-color: var(--composing-bg, #e8e8ed); border-radius: 2px; padding: 0 2px;');
        compositionNodeRef.current = textNode;
        selection.insertNodes([textNode]);
      } else {
        compositionNodeRef.current = null;
      }
    });
  }, [editor]);

  const commitComposition = useCallback(() => {
    editor.update(() => {
      if (compositionNodeRef.current) {
        const node = compositionNodeRef.current;
        if (node && node.getParent()) {
          // Remove composition style
          node.setStyle('');
        }
        compositionNodeRef.current = null;
      }
    });
  }, [editor]);

  const cancelComposition = useCallback(() => {
    removeCompositionNode();
    phoneticStateRef.current = initialPhoneticState;
  }, [removeCompositionNode]);

  useLayoutEffect(() => {
    const { isAmharicDoc, phoneticMode } = configRef.current;
    if (!isAmharicDoc || !phoneticMode) {
      if (phoneticStateRef.current.buffer.length > 0) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(flushed);
            }
          });
        }
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

      // Allow direct Ethiopic input
      if (/[\u1200-\u137f]/u.test(text)) return;

      // Handle multi-character input (paste, etc.)
      if (text.length !== 1) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(flushed + text);
            }
          });
        } else {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(text);
            }
          });
        }
        phoneticStateRef.current = initialPhoneticState;
        return;
      }

      const result = processPhoneticKey(phoneticStateRef.current, text, false);

      if (result.consumed) {
        event.preventDefault();
        phoneticStateRef.current = result.newState;

        // Show real-time composition
        if (result.newState.buffer.length > 0) {
          const composed = flushPhoneticBuffer(result.newState);
          if (composed) {
            replaceComposition(composed);
          }
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
          
          if (result.newState.buffer.length > 0) {
            const composed = flushPhoneticBuffer(result.newState);
            if (composed) {
              replaceComposition(composed);
            }
          } else {
            cancelComposition();
          }
        }
        return;
      }

      // Commit keys: Space, Enter, Tab, punctuation, arrows, Escape
      const commitKeys = [' ', 'Enter', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', '.', ',', '?', '!', ';', ':', '(', ')', '[', ']', '{', '}'];
      if (commitKeys.includes(key)) {
        const flushed = flushPhoneticBuffer(phoneticStateRef.current);
        if (flushed) {
          commitComposition();
          // Let the key through for space/enter
          if (key === ' ' || key === 'Enter') {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertText(key);
              }
            });
            event.preventDefault();
          }
        } else {
          commitComposition();
        }
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
  }, [editor, isAmharicDoc, phoneticMode, replaceComposition, commitComposition, cancelComposition]);

  return null;
}

export default PhoneticCompositionPlugin;