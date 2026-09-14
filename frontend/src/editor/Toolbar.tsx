import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  FORMAT_ELEMENT_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalNode,
  type RangeSelection,
  type TextNode,
  type ElementNode,
} from 'lexical';
import { $patchStyleText, $setBlocksType, getStyleObjectFromCSS } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { PARAGRAPH_STYLES, FONT_FAMILIES, FONT_SIZES, ZOOM_LEVELS } from '../utils/constants';
import { setFindOpen, setZoom } from '../store/uiSlice';
import { setAlign, setFileLang } from '../store/workspaceSlice';
import { setDeviceKeyboardMode } from '../store/keyboardSlice';

interface ToolbarProps {
  font: string;
  size: number;
  align: string;
  isAmharicDoc: boolean;
  deviceKeyboardMode: boolean;
  fileId: string | null;
}

type InlineFormat = 'bold' | 'italic' | 'underline' | 'strikethrough';

const SUPPORTED_STYLES = PARAGRAPH_STYLES.filter(style =>
  ['body', 'heading1', 'heading2', 'heading3', 'blockquote'].includes(style.value)
);

function getBlockType(anchorNode: LexicalNode | null): string {
  let node: LexicalNode | null = anchorNode;
  if ($isTextNode(node)) node = node.getParent();
  while (node) {
    if ($isElementNode(node)) {
      if ($isHeadingNode(node)) return `heading${String(node.getTag()).replace('h', '')}`;
      if ($isQuoteNode(node)) return 'blockquote';
      if ($isListNode(node)) return 'list';
      if (node.getType() === 'paragraph') return 'paragraph';
    }
    node = node.getParent();
  }
  return 'paragraph';
}

function collectTextNodes(block: ElementNode, out: TextNode[]) {
  for (const child of block.getChildren()) {
    if (child.getType() === 'text') out.push(child as unknown as TextNode);
    else if ($isElementNode(child)) collectTextNodes(child, out);
  }
}

/**
 * Expand a collapsed selection to a RangeSelection covering the whole
 * paragraph (top-level block) under the cursor. Returns null for an empty
 * paragraph, so the caller can keep styling whatever the user types next.
 */
function paragraphRange(selection: RangeSelection): RangeSelection | null {
  let node: LexicalNode = selection.anchor.getNode();
  if (node.getType() === 'text') node = node.getParentOrThrow();
  if (!$isElementNode(node)) return null;

  let block = node;
  while (true) {
    const parent = block.getParent();
    if (!parent || parent.getType() === 'root') break;
    block = parent;
  }

  const texts: TextNode[] = [];
  collectTextNodes(block, texts);
  if (texts.length === 0) return null;

  const range = $createRangeSelection();
  const last = texts[texts.length - 1];
  range.setTextNodeRange(texts[0], 0, last, last.getTextContent().length);
  return range;
}

export function Toolbar({ font, size, align, isAmharicDoc, deviceKeyboardMode, fileId }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch<AppDispatch>();
  const zoom = useSelector((state: RootState) => state.ui.zoom);
  const [blockType, setBlockType] = useState('paragraph');
  const [textFont, setTextFont] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<number | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const current = getBlockType(selection.anchor.getNode());
        setBlockType(prev => (prev === current ? prev : current));
        const node = selection.anchor.getNode();
        if (node.getType() === 'text') {
          const style = getStyleObjectFromCSS((node as TextNode).getStyle());
          const family = style ? style['font-family'] : undefined;
          const familyValue = typeof family === 'string' ? family : null;
          setTextFont(prev => (prev === familyValue ? prev : familyValue));
          const rawSize = style ? style['font-size'] : undefined;
          const sizeValue = rawSize ? parseInt(String(rawSize), 10) : null;
          setTextSize(prev => (prev === sizeValue ? prev : sizeValue));
        } else {
          setTextFont(null);
          setTextSize(null);
        }
      });
    });
  }, [editor]);

  /** Apply a text style to the current selection, or the whole paragraph under the cursor. */
  const applyTextStyle = useCallback((patch: Record<string, string>) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const target = selection.isCollapsed() ? paragraphRange(selection) : null;
      $patchStyleText(target || selection, patch);
    });
  }, [editor]);

  const applyFont = useCallback((value: string) => {
    applyTextStyle({ 'font-family': value });
  }, [applyTextStyle]);

  const applySize = useCallback((value: number) => {
    applyTextStyle({ 'font-size': `${value}px` });
  }, [applyTextStyle]);

  /** Toggle bold/italic/etc. — collapse the cursor to the paragraph the same way. */
  const format = useCallback((value: InlineFormat) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const target = selection.isCollapsed() ? paragraphRange(selection) : null;
      (target || selection).formatText(value);
    });
  }, [editor]);

  const alignment = useCallback((value: 'left' | 'center' | 'right' | 'justify') => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value);
    dispatch(setAlign(value));
  }, [editor, dispatch]);

  const changeStyle = useCallback((value: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!selection) return;
      if (value === 'paragraph') {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (value === 'blockquote') {
        $setBlocksType(selection, () => $createQuoteNode());
      } else if (value.startsWith('heading')) {
        $setBlocksType(selection, () => $createHeadingNode(`h${value.replace('heading', '')}` as 'h1' | 'h2' | 'h3'));
      }
    });
  }, [editor]);

  const toggleFormatList = useCallback((ordered: boolean) => {
    editor.dispatchCommand(ordered ? INSERT_ORDERED_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const setDocLang = useCallback((lang: 'am' | 'en') => {
    if (fileId) dispatch(setFileLang({ id: fileId, lang }));
  }, [dispatch, fileId]);

  const styleValue = blockType === 'list' ? 'paragraph' : blockType;

  return (
    <section className="editor-toolbar" aria-label="Editor toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" title="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>↶</button>
        <button className="toolbar-btn" title="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>↷</button>
        <div className="toolbar-divider" />
        <select
          className="toolbar-select"
          value={SUPPORTED_STYLES.some(s => s.value === styleValue) ? styleValue : 'paragraph'}
          onChange={event => changeStyle(event.target.value)}
          aria-label="Paragraph style"
        >
          {SUPPORTED_STYLES.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}
        </select>
        <select className="toolbar-select" value={textFont ?? font} onInput={event => applyFont(event.currentTarget.value)} aria-label="Font">
          {FONT_FAMILIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="toolbar-select" value={textSize ?? size} onInput={event => applySize(Number(event.currentTarget.value))} aria-label="Font size">
          {FONT_SIZES.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="toolbar-btn" title="Bold" onMouseDown={e => { e.preventDefault(); format('bold'); }}><b>B</b></button>
        <button className="toolbar-btn" title="Italic" onMouseDown={e => { e.preventDefault(); format('italic'); }}><i>I</i></button>
        <button className="toolbar-btn" title="Underline" onMouseDown={e => { e.preventDefault(); format('underline'); }}><u>U</u></button>
        <button className="toolbar-btn" title="Strikethrough" onMouseDown={e => { e.preventDefault(); format('strikethrough'); }}>S</button>
        <button className="toolbar-btn" title="Bulleted list" onClick={() => toggleFormatList(false)}>•</button>
        <button className="toolbar-btn" title="Numbered list" onClick={() => toggleFormatList(true)}>1.</button>
        <button
          className={`toolbar-btn ${blockType === 'blockquote' ? 'active' : ''}`}
          title="Blockquote"
          onClick={() => changeStyle('blockquote')}
        >❝</button>
      </div>
      <div className="toolbar-center" />
      <div className="toolbar-right">
        <div className="lang-toggle" role="group" aria-label="Document language">
          <button
            className={`lang-toggle-btn ${isAmharicDoc ? 'active' : ''}`}
            title="Write in Amharic (phonetic)"
            onClick={() => setDocLang('am')}
          >አማ</button>
          <button
            className={`lang-toggle-btn ${!isAmharicDoc ? 'active' : ''}`}
            title="Write in English"
            onClick={() => setDocLang('en')}
          >EN</button>
        </div>
        {(['left', 'center', 'right', 'justify'] as const).map(value => (
          <button
            key={value}
            className={`toolbar-btn ${align === value ? 'active' : ''}`}
            onClick={() => alignment(value)}
          >{value === 'left' ? '⫷' : value === 'center' ? '☰' : value === 'right' ? '⫸' : '⫹'}</button>
        ))}
        <select
          className="toolbar-select"
          value={zoom}
          onChange={event => dispatch(setZoom(Number(event.target.value)))}
          aria-label="Zoom"
        >
          {ZOOM_LEVELS.map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
        </select>
        {isAmharicDoc && (
          <button
            className={`toolbar-btn ${deviceKeyboardMode ? '' : 'active'}`}
            title={deviceKeyboardMode ? 'Use custom Amharic keyboard' : 'Use device keyboard'}
            onClick={() => dispatch(setDeviceKeyboardMode(!deviceKeyboardMode))}
          >⌨</button>
        )}
        <button className="toolbar-btn" title="Find" onClick={() => dispatch(setFindOpen(true))}>🔍</button>
        <button
          className="toolbar-btn"
          title="New paragraph"
          onClick={() => editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)}
        >↵</button>
      </div>
    </section>
  );
}