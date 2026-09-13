import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
  setContent,
  setSelection,
  pushUndo,
  undo,
  redo,
  setApplyingHistory,
} from '../store/editorSlice';
import { updateFile } from '../store/workspaceSlice';
import { addToast } from '../store/uiSlice';
import { processPhoneticKey, flushPhoneticBuffer, initialPhoneticState, type PhoneticState } from '../utils/phonetic';

const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE'];

function getTextContent(node: Node): string {
  return (node.textContent || '').replace(/\u00a0/g, ' ');
}

function selectionOffsets(editor: HTMLElement): { start: number; end: number } {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return { start: 0, end: 0 };
  const range = sel.getRangeAt(0);
  let start = 0, end = 0;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === range.startContainer) start += range.startOffset;
    else if (node === range.endContainer) end += range.endOffset;
    else if (node.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) end += node.nodeValue?.length || 0;
    else start += node.nodeValue?.length || 0;
  }
  return { start, end };
}

export function useEditor() {
  const dispatch = useDispatch<AppDispatch>();
  const editorRef = useRef<HTMLDivElement>(null);
  const [phoneticState, setPhoneticState] = useState<PhoneticState>(initialPhoneticState);
  const [spellCheckTimer, setSpellCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { html, applyingHistory } = useSelector((state: RootState) => state.editor);
  const { activeId, files } = useSelector((state: RootState) => state.workspace);
  const { phoneticMode, deviceKeyboardMode } = useSelector((state: RootState) => state.keyboard);

  const activeFile = files.find(f => f.id === activeId);

  const getEditorText = useCallback((): string => {
    if (!editorRef.current) return '';
    const blocks = editorRef.current.querySelectorAll('p,h1,h2,h3,h4,div,li,blockquote');
    const parts = Array.from(blocks).map(b => getTextContent(b)).filter(p => p !== '');
    return parts.join('\n');
  }, []);

  const getEditorHtml = useCallback((): string => {
    if (!editorRef.current) return '';
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.spell-error').forEach(el => {
      el.parentNode?.replaceChild(document.createTextNode(el.textContent || ''), el);
    });
    return clone.innerHTML;
  }, []);

  const saveToWorkspace = useCallback(() => {
    if (!activeId) return;
    const html = getEditorHtml();
    const text = getEditorText();
    dispatch(updateFile({ id: activeId, text: html }));
    dispatch(setContent({ html, text }));
  }, [activeId, getEditorHtml, getEditorText, dispatch]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (applyingHistory) return;
    const html = getEditorHtml();
    const text = getEditorText();
    dispatch(setContent({ html, text }));
    saveToWorkspace();

    if (spellCheckTimer) clearTimeout(spellCheckTimer);
    const timer = setTimeout(() => {
      // Spell check would go here
    }, 800);
    setSpellCheckTimer(timer);
  }, [applyingHistory, getEditorHtml, getEditorText, dispatch, saveToWorkspace, spellCheckTimer]);

  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current) return;
    const offsets = selectionOffsets(editorRef.current);
    dispatch(setSelection(offsets));
  }, [dispatch]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { key, ctrlKey, metaKey, shiftKey } = e;
    const isMod = ctrlKey || metaKey;

    // Phonetic composition
    if (phoneticMode && !deviceKeyboardMode && !isMod && key.length === 1 && !['Tab', 'Enter', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      const result = processPhoneticKey(phoneticState, key, key === 'Backspace');
      if (result.consumed) {
        e.preventDefault();
        setPhoneticState(result.newState);
        if (result.output) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(result.output));
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Flush phonetic buffer on non-composition keys
    if (phoneticState.buffer.length > 0 && !['Backspace'].includes(key)) {
      const flushed = flushPhoneticBuffer(phoneticState);
      if (flushed) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(flushed));
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        setPhoneticState(initialPhoneticState);
        editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Formatting shortcuts
    if (isMod) {
      switch (key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          document.execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          document.execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          document.execCommand('underline');
          break;
        case 'z':
          if (shiftKey) {
            e.preventDefault();
            dispatch(redo());
          } else {
            e.preventDefault();
            dispatch(undo());
          }
          break;
        case 'y':
          e.preventDefault();
          dispatch(redo());
          break;
        case 's':
          e.preventDefault();
          saveToWorkspace();
          dispatch(addToast({ message: 'Saved', type: 'success' }));
          break;
        case 'f':
          e.preventDefault();
          break;
      }
    }
  }, [phoneticMode, deviceKeyboardMode, phoneticState, dispatch, saveToWorkspace]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    const content = html || text.replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, content);
  }, []);

  const executeCommand = useCallback((command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    dispatch(pushUndo({ html: getEditorHtml(), selection: selectionOffsets(editorRef.current) }));
    document.execCommand(command, false, value);
    editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }, [dispatch, getEditorHtml]);

  const setBlockType = useCallback((type: string) => {
    executeCommand('formatBlock', type);
  }, [executeCommand]);

  const setFont = useCallback((font: string) => {
    executeCommand('fontName', font);
  }, [executeCommand]);

  const setFontSize = useCallback((size: string) => {
    executeCommand('fontSize', size);
  }, [executeCommand]);

  const setAlignment = useCallback((align: string) => {
    executeCommand('justify' + align.charAt(0).toUpperCase() + align.slice(1));
  }, [executeCommand]);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && activeFile && !applyingHistory) {
      editorRef.current.innerHTML = activeFile.text || '<p><br></p>';
      normalizeBlocks();
    }
  }, [activeFile, applyingHistory]);

  const normalizeBlocks = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let changed = false;
    const nodes: Node[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(n => {
      if (n.parentNode === editor && n.nodeType === Node.TEXT_NODE && n.nodeValue?.trim()) {
        const p = document.createElement('p');
        n.parentNode.insertBefore(p, n);
        p.appendChild(n);
        changed = true;
      }
    });
    if (changed) editor.normalize();
  }, []);

  return {
    editorRef,
    getEditorText,
    getEditorHtml,
    saveToWorkspace,
    handleInput,
    handleSelectionChange,
    handleKeyDown,
    handlePaste,
    executeCommand,
    setBlockType,
    setFont,
    setFontSize,
    setAlignment,
    phoneticState,
    setPhoneticState,
  };
}