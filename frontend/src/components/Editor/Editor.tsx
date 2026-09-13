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
        fontSize: `${size}px`,
        textAlign: align,
      }}
    />
  );
};

export default Editor;