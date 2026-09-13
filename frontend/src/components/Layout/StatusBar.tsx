import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { toggleKeyboard } from '../../store/uiSlice';

export const StatusBar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { files, activeId } = useSelector((state: RootState) => state.workspace);
  const { html } = useSelector((state: RootState) => state.editor);
  const { checking } = useSelector((state: RootState) => state.spell);
  const { open: keyboardOpen } = useSelector((state: RootState) => state.keyboard);

  const activeFile = files.find(f => f.id === activeId);
  const wordCount = html.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = html.length;

  return (
    <div className="editor-status">
      <span id="fileStatus">
        {activeFile ? `${activeFile.lang === 'am' ? 'አማርኛ' : 'English'} · UTF-8` : 'Plain text · UTF-8'}
      </span>
      <span id="editorStats">
        {wordCount} words · {charCount} characters
      </span>
      <button
        className={`tool ${keyboardOpen ? 'active' : ''}`}
        id="keyboardBtn"
        title="Show keyboard"
        onClick={() => dispatch(toggleKeyboard())}
      >
        ⌃
      </button>
    </div>
  );
};

export default StatusBar;