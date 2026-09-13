import React, { useCallback } from 'react';
import { useEditor } from '../../hooks/useEditor';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setSpellStatus, setSpellSummary } from '../../store/spellSlice';
import type { CheckWordResponse } from '../../types/api';
import { dictionaryApi } from '../../api/dictionary';
import { useSpellCheck } from '../../hooks';

export const Editor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { files, activeId } = useSelector((state: RootState) => state.workspace);
  const activeFile = files.find(f => f.id === activeId);
  const { debouncedCheck } = useSpellCheck();
  const {
    editorRef,
    getEditorText,
    getEditorHtml,
    saveToWorkspace,
    handleInput,
    handleSelectionChange,
    handleKeyDown,
    handlePaste,
  } = useEditor();

  // Debounced spell check
  const checkSpelling = useCallback(async () => {
    if (!editorRef.current) return;
    const text = getEditorText();
    if (!text.trim()) {
      dispatch(setSpellStatus('clean'));
      dispatch(setSpellSummary('All words checked'));
      return;
    }
    dispatch(setSpellStatus('checking'));
    try {
      const response = await dictionaryApi.check(text);
      const words = response.data.words;
      const errors = words.filter(w => !w.known);
      dispatch(setSpellStatus(errors.length > 0 ? 'errors' : 'clean'));
      dispatch(setSpellSummary(
        errors.length > 0
          ? `${errors.length} word${errors.length !== 1 ? 's' : ''} flagged`
          : 'All words checked'
      ));
      // Mark errors in editor
      markSpellErrors(words);
    } catch {
      dispatch(setSpellStatus('clean'));
      dispatch(setSpellSummary('Spell check unavailable'));
    }
  }, [getEditorText, dispatch]);

  const markSpellErrors = useCallback((words: CheckWordResponse[]) => {
    if (!editorRef.current) return;
    // Remove existing spell error marks
    editorRef.current.querySelectorAll('.spell-error').forEach(el => {
      el.parentNode?.replaceChild(document.createTextNode(el.textContent || ''), el);
    });
    editorRef.current.normalize();

    const text = getEditorText();
    let charIndex = 0;
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    const textNodes: { node: Node; start: number; end: number }[] = [];
    while ((node = walker.nextNode())) {
      const len = node.nodeValue?.length || 0;
      textNodes.push({ node, start: charIndex, end: charIndex + len });
      charIndex += len;
    }

    words.forEach(w => {
      if (w.known) return;
      const errorNodes = textNodes.filter(tn => tn.end > w.start && tn.start < w.end);
      if (errorNodes.length === 0) return;
      const tn = errorNodes[0];
      const nodeText = tn.node.nodeValue || '';
      const startInNode = Math.max(0, w.start - tn.start);
      const endInNode = Math.min(nodeText.length, w.end - tn.start);
      if (startInNode < endInNode) {
        const before = nodeText.slice(0, startInNode);
        const errorText = nodeText.slice(startInNode, endInNode);
        const after = nodeText.slice(endInNode);
        const parent = tn.node.parentNode!;
        if (before) parent.insertBefore(document.createTextNode(before), tn.node);
        const errorSpan = document.createElement('span');
        errorSpan.className = 'spell-error';
        errorSpan.dataset.word = w.word;
        errorSpan.dataset.suggestions = w.suggestions.map((s: any) => s.word).join('|');
        errorSpan.textContent = errorText;
        parent.insertBefore(errorSpan, tn.node);
        if (after) parent.insertBefore(document.createTextNode(after), tn.node);
        parent.removeChild(tn.node);
      }
    });
    editorRef.current.normalize();
  }, [getEditorText]);

  // Handle input with spell check
  const handleInputWithSpellCheck = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    handleInput(e);
    debouncedCheck(getEditorText());
  }, [handleInput, debouncedCheck, getEditorText]);

  return (
    <div
      ref={editorRef}
      id="editor"
      className="document-editor"
      contentEditable={true}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      data-placeholder="Start writing in Amharic..."
      onInput={handleInputWithSpellCheck}
      onKeyDown={handleKeyDown}
      onKeyUp={handleSelectionChange}
      onPaste={handlePaste}
      onClick={handleSelectionChange}
      onFocus={handleSelectionChange}
      style={{
        fontFamily: activeFile ? `var(--font-family, "${activeFile.font}")` : 'inherit',
        fontSize: activeFile ? `${activeFile.size}px` : 'inherit',
        textAlign: activeFile ? activeFile.align : 'inherit',
      }}
    />
  );
};

export default Editor;