import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { hideContextMenu } from '../../store/uiSlice';

export const ContextMenu: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { contextMenu } = useSelector((state: RootState) => state.ui);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contextMenu.open && menuRef.current) {
      const { offsetWidth, offsetHeight } = menuRef.current;
      const x = Math.min(contextMenu.x, window.innerWidth - offsetWidth - 8);
      const y = Math.min(contextMenu.y, window.innerHeight - offsetHeight - 8);
      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [contextMenu.open, contextMenu.x, contextMenu.y]);

  useEffect(() => {
    const handleClick = () => dispatch(hideContextMenu());
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(hideContextMenu());
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch]);

  if (!contextMenu.open) return null;

  const handleAction = (action: string) => {
    if (action === 'cut') document.execCommand('cut');
    else if (action === 'copy') document.execCommand('copy');
    else if (action === 'paste') document.execCommand('paste');
    else if (action === 'new') dispatch({ type: 'ui/openNewDocDialog' });
    else if (action === 'open') document.getElementById('importFile')?.click();
    else if (action === 'rename') {
      // TODO: Implement rename
    }
    else if (action === 'duplicate') {
      if (contextMenu.fileId) dispatch({ type: 'workspace/duplicateFile', payload: contextMenu.fileId });
    }
    else if (action === 'close') {
      if (contextMenu.fileId) dispatch({ type: 'workspace/closeTab', payload: contextMenu.fileId });
    }
    else if (action === 'delete') {
      if (contextMenu.fileId) dispatch({ type: 'workspace/deleteFile', payload: contextMenu.fileId });
    }
    dispatch(hideContextMenu());
  };

  return (
    <div ref={menuRef} id="contextMenu" className="context-menu" role="menu">
      {!contextMenu.isSpellError && (
        <>
          <button data-context="cut" role="menuitem" onClick={() => handleAction('cut')}>✂ Cut</button>
          <button data-context="copy" role="menuitem" onClick={() => handleAction('copy')}>⎘ Copy</button>
          <button data-context="paste" role="menuitem" onClick={() => handleAction('paste')}>📋 Paste</button>
          <div className="context-sep" />
          <button data-context="new" role="menuitem" onClick={() => handleAction('new')}>＋ New document</button>
          <button data-context="open" role="menuitem" onClick={() => handleAction('open')}>Open</button>
          {contextMenu.fileId && (
            <>
              <button data-context="rename" role="menuitem" onClick={() => handleAction('rename')}>Rename</button>
              <button data-context="duplicate" role="menuitem" onClick={() => handleAction('duplicate')}>Duplicate</button>
              <button data-context="close" role="menuitem" onClick={() => handleAction('close')}>Close tab</button>
              <button data-context="delete" role="menuitem" className="danger-action" onClick={() => handleAction('delete')}>Delete</button>
            </>
          )}
        </>
      )}
      {contextMenu.isSpellError && contextMenu.spellErrorData && (
        <div className="spell-fix-row">
          <div className="spell-fix-title">"{contextMenu.spellErrorData.word}" — suggestions</div>
          {contextMenu.spellErrorData.suggestions.length === 0 ? (
            <div className="spell-fix-none">No close match</div>
          ) : (
            contextMenu.spellErrorData.suggestions.map((s, i) => (
              <button
                key={i}
                className="spell-fix-item"
                onClick={() => {
                  // TODO: Replace spell error with suggestion
                  dispatch(hideContextMenu());
                }}
              >
                ✓ {s.word}
              </button>
            ))
          )}
          <button className="spell-fix-item spell-fix-ignore" onClick={() => dispatch(hideContextMenu())}>
            Ignore once
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;