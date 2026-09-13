import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setBlockType, setFont, setFontSize, setAlignment } from '../../store/editorSlice';
import { PARAGRAPH_STYLES, FONT_FAMILIES, FONT_SIZES, ZOOM_LEVELS } from '../../utils/constants';
import { toggleInspector, setFindOpen } from '../../store/uiSlice';

export const EditorToolbar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { font, size, align } = useSelector((state: RootState) => state.workspace);
  const { inspectorOpen } = useSelector((state: RootState) => state.ui);

  const handleParagraphStyle = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setBlockType(e.target.value));
  }, [dispatch]);

  const handleFontFamily = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setFont(e.target.value));
  }, [dispatch]);

  const handleFontSize = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setFontSize(parseInt(e.target.value, 10)));
  }, [dispatch]);

  const handleAlignment = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    dispatch(setAlignment(align));
  }, [dispatch]);

  const handleFormat = useCallback((command: string) => {
    document.execCommand(command);
  }, []);

  const handleInsertList = useCallback((type: 'unordered' | 'ordered') => {
    document.execCommand(type === 'unordered' ? 'insertUnorderedList' : 'insertOrderedList');
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

  return (
    <section className="editor-toolbar" aria-label="Editor toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" title="Undo (Ctrl+Z)" onClick={() => document.execCommand('undo')}>↶</button>
        <button className="toolbar-btn" title="Redo (Ctrl+Shift+Z)" onClick={() => document.execCommand('redo')}>↷</button>
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
        <button className="toolbar-btn" title="Bullet list (Ctrl+Shift+8)" onClick={() => handleInsertList('unordered')}>•</button>
        <button className="toolbar-btn" title="Numbered list (Ctrl+Shift+7)" onClick={() => handleInsertList('ordered')}>1.</button>
        <button className="toolbar-btn" id="pageBreakBtn" title="Page Break (Ctrl+Enter)" onClick={handlePageBreak}>⎐</button>
      </div>
      <div className="toolbar-center">
        <button className="toolbar-btn" id="tocBtn" title="Table of Contents">☰</button>
        <button className="toolbar-btn" id="thumbnailsBtn" title="Page Thumbnails">⧉</button>
        <button className={`toolbar-btn ${inspectorOpen ? 'active' : ''}`} id="inspectorBtn" title="Format Inspector" onClick={() => dispatch(toggleInspector())}>⚙</button>
      </div>
      <div className="toolbar-right">
        <button className={`toolbar-btn ${align === 'left' ? 'active' : ''}`} data-align="left" title="Align Left (Ctrl+L)" onClick={() => handleAlignment('left')}>⫷</button>
        <button className={`toolbar-btn ${align === 'center' ? 'active' : ''}`} data-align="center" title="Center (Ctrl+E)" onClick={() => handleAlignment('center')}>☰</button>
        <button className={`toolbar-btn ${align === 'right' ? 'active' : ''}`} data-align="right" title="Align Right (Ctrl+R)" onClick={() => handleAlignment('right')}>⫸</button>
        <button className={`toolbar-btn ${align === 'justify' ? 'active' : ''}`} data-align="justify" title="Justify (Ctrl+J)" onClick={() => handleAlignment('justify')}>⫹</button>
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