import React, { useCallback } from 'react';
import { useEditor } from '../../hooks/useEditor';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setOpen as setKeyboardOpen } from '../../store/keyboardSlice';

export const Editor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { font, size, align } = useSelector((state: RootState) => state.workspace);
  const {
    editorRef,
    handleInput,
    handleSelectionChange,
    handleKeyDown,
    handlePaste,
  } = useEditor();

  const handleEditorPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      dispatch(setKeyboardOpen(true));
    }
  }, [dispatch]);

  // Responsive font size: smaller on mobile, larger on desktop
  const fontSize = size || 18;
  const effectiveFontSize = window.matchMedia('(hover: hover) and (pointer: fine)') 
    ? fontSize 
    : Math.max(14, fontSize - 4);

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
      onPointerDown={handleEditorPointerDown}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onKeyUp={handleSelectionChange}
      onPaste={handlePaste}
      onClick={handleSelectionChange}
      onFocus={handleSelectionChange}
      style={{
        fontFamily: `"${font}", "Noto Sans Ethiopic", "Abyssinica SIL", Georgia, serif`,
        fontSize: `${effectiveFontSize}px`,
        textAlign: align,
      }}
    />
  );
};

export default Editor;
