import { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_TAB_COMMAND,
} from 'lexical';
import { initializeNlp, suggestText } from '../nlp';

/**
 * Amharic word / next-word predictions.
 *
 * Reads the Ethiopic word fragment before the caret, asks the dictionary API
 * for completions (and the model for likely next words), and shows them as
 * chips. Clicking a chip inserts it; Tab accepts the first completion.
 */
export function PredictionStrip({ isAmharicDoc }: { isAmharicDoc: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [words, setWords] = useState<string[]>([]);
  const [next, setNext] = useState<string[]>([]);
  const timerRef = useRef<number | undefined>(undefined);
  const firstWordRef = useRef<string | null>(null);

  const insert = useCallback((text: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
    editor.focus();
  }, [editor]);

  useEffect(() => {
    firstWordRef.current = words[0] ?? null;
  }, [words]);

  useEffect(() => {
    if (!isAmharicDoc) {
      setWords([]);
      setNext([]);
      return;
    }

    // Warm the offline dictionary in the background.
    void initializeNlp();

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setWords([]);
          setNext([]);
          return;
        }
        const text = selection.anchor.getNode().getTextContent();
        const before = text.slice(0, selection.anchor.offset);
        const match = before.match(/[\u1200-\u137F]+$/);
        const fragment = match ? match[0] : '';
        if (fragment.length < 2) {
          setWords([]);
          setNext([]);
          return;
        }
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(async () => {
          try {
            const res = await suggestText(fragment);
            setWords((res.words || []).slice(0, 5));
            setNext((res.next || []).slice(0, 3));
          } catch {
            setWords([]);
            setNext([]);
          }
        }, 220);
      });
    });

    return () => {
      unregister();
      window.clearTimeout(timerRef.current);
    };
  }, [editor, isAmharicDoc]);

  useEffect(() => {
    if (!isAmharicDoc) return;
    const unregister = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent) => {
        const first = firstWordRef.current;
        if (first) {
          event?.preventDefault?.();
          insert(`${first} `);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
    return unregister;
  }, [editor, isAmharicDoc, insert]);

  if (!isAmharicDoc || (words.length === 0 && next.length === 0)) return null;

  return (
    <div className="prediction-strip" role="listbox" aria-label="Amharic predictions">
      {words.map(word => (
        <button
          key={`w-${word}`}
          className="prediction-chip"
          onPointerDown={e => { e.preventDefault(); insert(`${word} `); }}
        >
          {word}
        </button>
      ))}
      {next.length > 0 && <span className="prediction-sep" aria-hidden="true" />}
      {next.map(word => (
        <button
          key={`n-${word}`}
          className="prediction-chip next"
          onPointerDown={e => { e.preventDefault(); insert(`${word} `); }}
        >
          {word}
        </button>
      ))}
      {words.length > 0 && <span className="prediction-hint">Tab ↹</span>}
    </div>
  );
}

export default PredictionStrip;
