import React, { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { undo, redo } from '../../store/editorSlice';
import { PARAGRAPH_STYLES, FONT_FAMILIES, FONT_SIZES, ZOOM_LEVELS } from '../../utils/constants';
import { toggleInspector, setFindOpen } from '../../store/uiSlice';

function getEditor(): HTMLElement | null {
  return document.getElementById('editor');
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

function formatBlock(tag: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  while (node && node !== getEditor()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (['P', 'H1', 'H2', 'H3', 'H4', 'DIV', 'BLOCKQUOTE'].includes(el.tagName)) {
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
  while (node && node !== getEditor()) {
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

function applyInlineStyle(css: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.cssText = css;
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
}

function fireInput() {
  const editor = getEditor();
  if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export const EditorToolbar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { font, size, align } = useSelector((state: RootState) => state.workspace);
  const { inspectorOpen } = useSelector((state: RootState) => state.ui);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParagraphStyle = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const editor = getEditor();
    if (!editor) return;
    editor.focus();
    formatBlock(e.target.value);
    fireInput();
  }, []);

  const handleFontFamily = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const editor = getEditor();
    if (!editor) return;
    editor.focus();
    applyInlineStyle(`font-family: "${e.target.value}"`);
    fireInput();
  }, []);

  const handleFontSize = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const editor = getEditor();
    if (!editor) return;
    editor.focus();
    applyInlineStyle(`font-size: ${e.target.value}px`);
    fireInput();
  }, []);

  const handleAlignment = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    const editor = getEditor();
    if (!editor) return;
    editor.focus();
    setAlignmentValue(align);
    fireInput();
  }, []);

  const handleFormat = useCallback((command: string) => {
    const editor = getEditor();
    if (!editor) return;
    editor.focus();
    switch (command) {
      case 'bold': wrapSelection('strong'); break;
      case 'italic': wrapSelection('em'); break;
      case 'underline': wrapSelection('u'); break;
      case 'strikethrough': wrapSelection('s'); break;
      case 'formatBlock': formatBlock('p'); break;
      case 'justifyLeft': setAlignmentValue('left'); break;
      case 'justifyCenter': setAlignmentValue('center'); break;
      case 'justifyRight': setAlignmentValue('right'); break;
      case 'justifyFull': setAlignmentValue('justify'); break;
      case 'insertUnorderedList': insertAtCursor('<ul><li><br></li></ul><p><br></p>'); break;
      case 'insertOrderedList': insertAtCursor('<ol><li><br></li></ol><p><br></p>'); break;
    }
    fireInput();
  }, []);

  const handleInsertList = useCallback((type: 'unordered' | 'ordered') => {
    handleFormat(type === 'unordered' ? 'insertUnorderedList' : 'insertOrderedList');
  }, [handleFormat]);

  const handleInsertTable = useCallback(() => {
    const editor = getEditor();
    if (editor) editor.focus();
    insertTable(3, 3);
    fireInput();
  }, []);

  const handlePageBreak = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const br = document.createElement('br');
      br.className = 'page-break';
      br.style.cssText = 'page-break-after: always; content: ""; display: block;';
      range.insertNode(br);
      range.collapse(false);
    }
  }, []);

  const handleZoom = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    document.body.style.zoom = e.target.value;
  }, []);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const editor = getEditor();
        if (editor) editor.focus();
        const img = `<div style="text-align:center;margin:1em 0"><img src="${dataUrl}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:4px" /></div><p><br></p>`;
        insertAtCursor(img);
        fireInput();
      }
    }
    e.target.value = '';
  }, []);

  return (
    <section className="editor-toolbar" aria-label="Editor toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" title="Undo (Ctrl+Z)" onClick={() => dispatch(undo())}>↶</button>
        <button className="toolbar-btn" title="Redo (Ctrl+Shift+Z)" onClick={() => dispatch(redo())}>↷</button>
        <div className="toolbar-divider" />
        <select className="toolbar-select style-select" value="" onChange={handleParagraphStyle} title="Paragraph Style">
          {PARAGRAPH_STYLES.map(style => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
        <select className="toolbar-select font-select" value={font} onChange={handleFontFamily} title="Font">
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
          ))}
        </select>
        <select className="toolbar-select size-select" value={size} onChange={handleFontSize} title="Font Size">
          {FONT_SIZES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" data-command="bold" title="Bold (Ctrl+B)" onClick={() => handleFormat('bold')}>
          <b>B</b>
        </button>
        <button className="toolbar-btn" data-command="italic" title="Italic (Ctrl+I)" onClick={() => handleFormat('italic')}>
          <i>I</i>
        </button>
        <button className="toolbar-btn" data-command="underline" title="Underline (Ctrl+U)" onClick={() => handleFormat('underline')}>
          <u>U</u>
        </button>
        <button className="toolbar-btn" data-command="strikethrough" title="Strikethrough" onClick={() => handleFormat('strikethrough')}>
          <s>S</s>
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" title="Bullet list" onClick={() => handleInsertList('unordered')}>&bull;</button>
        <button className="toolbar-btn" title="Numbered list" onClick={() => handleInsertList('ordered')}>1.</button>
        <button className="toolbar-btn" title="Insert table" onClick={handleInsertTable}>⊞</button>
        <button className="toolbar-btn" title="Insert image" onClick={handleImageUpload}>🖼</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageFileChange}
          style={{ display: 'none' }}
        />
        <button className="toolbar-btn" id="pageBreakBtn" title="Page Break" onClick={handlePageBreak}>⎐</button>
      </div>
      <div className="toolbar-center">
        <button className={`toolbar-btn ${inspectorOpen ? 'active' : ''}`} id="inspectorBtn" title="Format Inspector" onClick={() => dispatch(toggleInspector())}>⚙</button>
      </div>
      <div className="toolbar-right">
        <button className={`toolbar-btn ${align === 'left' ? 'active' : ''}`} data-align="left" title="Align Left" onClick={() => handleAlignment('left')}>⫷</button>
        <button className={`toolbar-btn ${align === 'center' ? 'active' : ''}`} data-align="center" title="Center" onClick={() => handleAlignment('center')}>☰</button>
        <button className={`toolbar-btn ${align === 'right' ? 'active' : ''}`} data-align="right" title="Align Right" onClick={() => handleAlignment('right')}>⫸</button>
        <button className={`toolbar-btn ${align === 'justify' ? 'active' : ''}`} data-align="justify" title="Justify" onClick={() => handleAlignment('justify')}>⫹</button>
        <div className="toolbar-divider" />
        <select className="toolbar-select zoom-select" value="1" onChange={handleZoom} title="Zoom">
          {ZOOM_LEVELS.map(z => (
            <option key={z} value={z}>{Math.round(z * 100)}%</option>
          ))}
        </select>
        <button className="toolbar-btn" id="findBtn" title="Find (Ctrl+F)" onClick={() => dispatch(setFindOpen(true))}>🔍</button>
      </div>
    </section>
  );
};

export default EditorToolbar;
