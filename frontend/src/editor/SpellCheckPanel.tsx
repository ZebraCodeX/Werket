import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import type { AppDispatch } from '../store';
import { closeSpell } from '../store/uiSlice';
import { checkText, type CheckWord } from '../nlp';

/**
 * Dictionary-backed spell check for Amharic documents.
 *
 * Runs /api/dictionary/check over the current document text and lists the
 * unknown words with suggested replacements; clicking a suggestion swaps the
 * first occurrence in the editor.
 */
export function SpellCheckPanel({ isAmharicDoc }: { isAmharicDoc: boolean }) {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch<AppDispatch>();
  const [issues, setIssues] = useState<CheckWord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const text = editor.getEditorState().read(() => $getRoot().getTextContent());
      const found = await checkText(text);
      setIssues(found.filter(word => !word.known));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spell check failed');
    } finally {
      setBusy(false);
    }
  }, [editor]);

  useEffect(() => {
    run();
  }, [run]);

  const replace = useCallback((word: string, replacement: string) => {
    editor.update(() => {
      for (const node of $getRoot().getAllTextNodes()) {
        const text = node.getTextContent();
        const index = text.indexOf(word);
        if (index !== -1) {
          node.setTextContent(text.slice(0, index) + replacement + text.slice(index + word.length));
          return;
        }
      }
    });
    setIssues(prev => prev.filter(issue => issue.word !== word));
  }, [editor]);

  return (
    <div className="spell-panel" role="dialog" aria-label="Spell check">
      <div className="spell-panel-header">
        <b>{isAmharicDoc ? 'ፊደል ማረሚያ' : 'Spell check'}</b>
        <button className="spell-close" onClick={() => dispatch(closeSpell())} aria-label="Close">×</button>
      </div>
      <div className="spell-panel-body">
        {busy && <p className="spell-empty">Checking…</p>}
        {error && <p className="spell-error">{error}</p>}
        {!busy && !error && issues.length === 0 && (
          <p className="spell-empty">{isAmharicDoc ? 'ምንም ስህተት አልተገኘም' : 'No issues found'}</p>
        )}
        {issues.map(issue => (
          <div key={`${issue.word}-${issue.start}`} className="spell-item">
            <span className="spell-word">{issue.word}</span>
            <div className="spell-suggestions">
              {issue.suggestions.slice(0, 4).map(suggestion => (
                <button
                  key={suggestion.word}
                  className="spell-suggestion"
                  onPointerDown={e => { e.preventDefault(); replace(issue.word, suggestion.word); }}
                >
                  {suggestion.word}
                </button>
              ))}
              {issue.suggestions.length === 0 && <span className="spell-none">—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SpellCheckPanel;
