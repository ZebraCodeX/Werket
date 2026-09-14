import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { setFindOpen, setFindQuery } from '../store/uiSlice';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createRangeSelection,
  $getRoot,
  $isTextNode,
  $setSelection,
} from 'lexical';

interface Match {
  key: string;
  start: number;
  end: number;
  text: string;
}

export function FindOverlay() {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch<AppDispatch>();
  const { findOpen, findQuery } = useSelector((state: RootState) => state.ui);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef(findQuery);
  const matchRef = useRef(0);
  const [result, setResult] = React.useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    queryRef.current = findQuery;
  }, [findQuery]);

  const collectMatches = useCallback((query: string): Match[] => {
    if (!query) return [];
    const lower = query.toLowerCase();
    const matches: Match[] = [];
    editor.getEditorState().read(() => {
      const nodes = $getRoot().getAllTextNodes();
      for (const node of nodes) {
        if (!$isTextNode(node)) continue;
        const text = node.getTextContent();
        if (!text) continue;
        let idx = text.toLowerCase().indexOf(lower);
        while (idx !== -1) {
          matches.push({ key: node.getKey(), start: idx, end: idx + query.length, text });
          idx = text.toLowerCase().indexOf(lower, idx + 1);
        }
      }
    });
    return matches;
  }, [editor]);

  const matchesRef = useRef<Match[]>([]);

  const goTo = useCallback((next: boolean) => {
    const query = queryRef.current;
    if (!query) return;
    if (matchesRef.current.length === 0) {
      matchesRef.current = collectMatches(query);
    }
    const total = matchesRef.current.length;
    if (total === 0) {
      setResult({ current: 0, total: 0 });
      return;
    }
    matchRef.current = ((matchRef.current + (next ? 1 : -1)) + total) % total;
    const m = matchesRef.current[matchRef.current];
    setResult({ current: matchRef.current + 1, total });
    editor.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(m.key, m.start, 'text');
      selection.focus.set(m.key, m.end, 'text');
      $setSelection(selection);
      const domNode = editor.getElementByKey(m.key);
      domNode?.scrollIntoView({ block: 'center' });
    });
  }, [collectMatches, editor]);

  // Re-run search as the query changes
  const runSearch = useCallback(() => {
    const query = queryRef.current;
    matchesRef.current = collectMatches(query);
    matchRef.current = -1;
    if (query) goTo(true);
    else setResult(null);
  }, [collectMatches, goTo]);

  useEffect(() => {
    if (findOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [findOpen]);

  useEffect(() => {
    if (!findOpen) return;
    runSearch();
    // Refresh match list if the document changes while the overlay is open
    return editor.registerUpdateListener(() => {
      if (!findOpen) return;
      matchesRef.current = collectMatches(queryRef.current);
    });
  }, [findOpen, findQuery, runSearch, collectMatches, editor]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      dispatch(setFindOpen(false));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goTo(!e.shiftKey);
    }
  };

  if (!findOpen) return null;

  return (
    <div className="find-bar open" role="search">
      <input
        ref={inputRef}
        id="findInput"
        type="text"
        placeholder="Find in document..."
        value={findQuery}
        onChange={e => dispatch(setFindQuery(e.target.value))}
        onKeyDown={handleKeyDown}
      />
      <span id="findCount">
        {findQuery
          ? `${result?.current ?? 0}/${result?.total ?? 0}`
          : ''}
      </span>
      <button id="findPrev" title="Previous" onClick={() => goTo(false)}>↑</button>
      <button id="findNext" title="Next" onClick={() => goTo(true)}>↓</button>
      <button id="closeFind" onClick={() => dispatch(setFindOpen(false))}>×</button>
    </div>
  );
}