import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
  setContent,
  setSelection,
  pushUndo,
  undo,
  redo,
} from '../store/editorSlice';
import { updateFile } from '../store/workspaceSlice';
import { addToast } from '../store/uiSlice';
import { processPhoneticKey, flushPhoneticBuffer, initialPhoneticState, type PhoneticState } from '../utils/phonetic';

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

function insertAtCursor(html: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const frag = document.createRange().createContextualFragment(html);
  range.insertNode(frag);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function wrapSelection(tag: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const wrapper = document.createElement(tag);
  try {
    range.surroundContents(wrapper);
  } catch {
    const frag = range.extractContents();
    wrapper.appendChild(frag);
    range.insertNode(wrapper);
  }
  range.selectNodeContents(wrapper);
  sel.removeAllRanges();
  sel.addRange(range);
}

function toggleInlineStyle(style: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const parent = range.startContainer.parentElement;
  if (parent && parent.tagName === 'SPAN' && parent.getAttribute('style')?.includes(style)) {
    const text = parent.textContent || '';
    const textNode = document.createTextNode(text);
    parent.parentNode?.replaceChild(textNode, parent);
  } else {
    const span = document.createElement('span');
    span.style.cssText = style;
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
  }
}

function formatBlock(tag: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  while (node && node !== document.getElementById('editor')) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'BLOCKQUOTE'];
      if (blockTags.includes(el.tagName)) {
        const newEl = document.createElement(tag);
        newEl.innerHTML = el.innerHTML;
        el.parentNode?.replaceChild(newEl, el);
        return;
      }
    }
    node = node.parentNode;
  }
  const p = document.createElement(tag);
  p.innerHTML = range.toString() || '<br>';
  range.deleteContents();
  range.insertNode(p);
}

function setAlignmentValue(align: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  while (node && node !== document.getElementById('editor')) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (['P', 'H1', 'H2', 'H3', 'H4', 'DIV'].includes(el.tagName)) {
        el.style.textAlign = align;
        return;
      }
    }
    node = node.parentNode;
  }
}

function insertTable(rows: number, cols: number) {
  let html = '<table style="border-collapse:collapse;width:100%;margin:1em 0">';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const tag = r === 0 ? 'th' : 'td';
      html += `<${tag} style="border:1px solid var(--line);padding:8px;min-width:60px"><br></${tag}>`;
    }
    html += '</tr>';
  }
  html += '</table><p><br></p>';
  insertAtCursor(html);
}

function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function insertImage(src: string, alt = '') {
  const html = `<div style="text-align:center;margin:1em 0"><img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border-radius:4px" /></div><p><br></p>`;
  insertAtCursor(html);
}

export function useEditor() {
  const dispatch = useDispatch<AppDispatch>();
  const editorRef = useRef<HTMLDivElement>(null);
  const [phoneticState, setPhoneticState] = useState<PhoneticState>(initialPhoneticState);
  const [spellCheckTimer, setSpellCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { applyingHistory } = useSelector((state: RootState) => state.editor);
  const { activeId, files } = useSelector((state: RootState) => state.workspace);
  const { phoneticMode, deviceKeyboardMode } = useSelector((state: RootState) => state.keyboard);

  const activeFile = files.find(f => f.id === activeId);

  const getEditorText = useCallback((): string => {
    if (!editorRef.current) return '';
    const blocks = editorRef.current.querySelectorAll('p,h1,h2,h3,h4,div,li,blockquote,td,th');
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

  const handleInput = useCallback((_e: React.FormEvent<HTMLDivElement>) => {
    if (applyingHistory) return;
    const html = getEditorHtml();
    const text = getEditorText();
    dispatch(setContent({ html, text }));
    saveToWorkspace();

    if (spellCheckTimer) clearTimeout(spellCheckTimer);
    const timer = setTimeout(() => {}, 800);
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

    if (isMod) {
      switch (key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          wrapSelection('strong');
          break;
        case 'i':
          e.preventDefault();
          wrapSelection('em');
          break;
        case 'u':
          e.preventDefault();
          wrapSelection('u');
          break;
        case 'z':
          e.preventDefault();
          if (shiftKey) dispatch(redo()); else dispatch(undo());
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
      }
    }
  }, [phoneticMode, deviceKeyboardMode, phoneticState, dispatch, saveToWorkspace]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const dataUrl = await imageToDataUrl(file);
          insertImage(dataUrl, file.name);
          editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
      }
    }

    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      insertAtCursor(html);
    } else {
      insertAtCursor(text.replace(/\n/g, '<br>'));
    }
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const executeCommand = useCallback((_command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    dispatch(pushUndo({ html: getEditorHtml(), selection: selectionOffsets(editorRef.current) }));

    switch (_command) {
      case 'bold': wrapSelection('strong'); break;
      case 'italic': wrapSelection('em'); break;
      case 'underline': wrapSelection('u'); break;
      case 'strikethrough': wrapSelection('s'); break;
      case 'formatBlock': formatBlock(value || 'p'); break;
      case 'justifyLeft': setAlignmentValue('left'); break;
      case 'justifyCenter': setAlignmentValue('center'); break;
      case 'justifyRight': setAlignmentValue('right'); break;
      case 'justifyFull': setAlignmentValue('justify'); break;
      case 'insertUnorderedList': insertAtCursor('<ul><li><br></li></ul><p><br></p>'); break;
      case 'insertOrderedList': insertAtCursor('<ol><li><br></li></ol><p><br></p>'); break;
      case 'fontName':
        if (value) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) {
            const span = document.createElement('span');
            span.style.fontFamily = value;
            const range = sel.getRangeAt(0);
            try { range.surroundContents(span); } catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
          }
        }
        break;
      case 'insertHTML': insertAtCursor(value || ''); break;
    }

    editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }, [dispatch, getEditorHtml]);

  const setBlockType = useCallback((type: string) => {
    executeCommand('formatBlock', type);
  }, [executeCommand]);

  const setFont = useCallback((font: string) => {
    executeCommand('fontName', font);
  }, [executeCommand]);

  const setFontSize = useCallback((_size: string) => {
  }, []);

  const setAlignment = useCallback((align: string) => {
    executeCommand('justify' + align.charAt(0).toUpperCase() + align.slice(1));
  }, [executeCommand]);

  const insertTableHandler = useCallback((rows: number, cols: number) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    dispatch(pushUndo({ html: getEditorHtml(), selection: selectionOffsets(editorRef.current) }));
    insertTable(rows, cols);
    editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }, [dispatch, getEditorHtml]);

  const insertImageFromUpload = useCallback(async (file: File) => {
    if (!editorRef.current) return;
    const dataUrl = await imageToDataUrl(file);
    editorRef.current.focus();
    dispatch(pushUndo({ html: getEditorHtml(), selection: selectionOffsets(editorRef.current) }));
    insertImage(dataUrl, file.name);
    editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }, [dispatch, getEditorHtml]);

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
    insertTable: insertTableHandler,
    insertImage: insertImageFromUpload,
    phoneticState,
    setPhoneticState,
  };
}
