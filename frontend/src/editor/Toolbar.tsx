import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalNode,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { PARAGRAPH_STYLES, FONT_FAMILIES, FONT_SIZES, ZOOM_LEVELS } from '../utils/constants';
import { toggleInspector, setFindOpen, setZoom } from '../store/uiSlice';
import { setFont, setSize, setAlign } from '../store/workspaceSlice';
import { setDeviceKeyboardMode } from '../store/keyboardSlice';

interface ToolbarProps {
  font: string;
  size: number;
  align: string;
  isAmharicDoc: boolean;
  deviceKeyboardMode: boolean;
}

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

export function Toolbar({ font, size, align, isAmharicDoc, deviceKeyboardMode }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch<AppDispatch>();
  const inspectorOpen = useSelector((state: RootState) => state.ui.inspectorOpen);
  const zoom = useSelector((state: RootState) => state.ui.zoom);
  const [blockType, setBlockType] = useState('paragraph');

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const current = getBlockType(selection.anchor.getNode());
        setBlockType(prev => (prev === current ? prev : current));
      });
    });
  }, [editor]);

  const format = useCallback((value: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, value);
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
        <select className="toolbar-select" value={font} onChange={event => dispatch(setFont(event.target.value))} aria-label="Font">
          {FONT_FAMILIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="toolbar-select" value={size} onChange={event => dispatch(setSize(Number(event.target.value)))} aria-label="Font size">
          {FONT_SIZES.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="toolbar-btn" title="Bold" onClick={() => format('bold')}><b>B</b></button>
        <button className="toolbar-btn" title="Italic" onClick={() => format('italic')}><i>I</i></button>
        <button className="toolbar-btn" title="Underline" onClick={() => format('underline')}><u>U</u></button>
        <button className="toolbar-btn" title="Strikethrough" onClick={() => format('strikethrough')}>S</button>
        <button className="toolbar-btn" title="Bulleted list" onClick={() => toggleFormatList(false)}>•</button>
        <button className="toolbar-btn" title="Numbered list" onClick={() => toggleFormatList(true)}>1.</button>
        <button
          className={`toolbar-btn ${blockType === 'blockquote' ? 'active' : ''}`}
          title="Blockquote"
          onClick={() => changeStyle('blockquote')}
        >❝</button>
      </div>
      <div className="toolbar-center">
        <button className={`toolbar-btn ${inspectorOpen ? 'active' : ''}`} onClick={() => dispatch(toggleInspector())}>⚙</button>
      </div>
      <div className="toolbar-right">
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
          >አማ</button>
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