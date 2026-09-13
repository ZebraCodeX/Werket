import React, { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { 
  toggleSidebar, 
  openAuthDialog, 
  showSaveMenu, 
  showExportMenu, 
  openNewDocDialog,
  openPdfViewer,
  addToast,
} from '../../store/uiSlice';
import { setProjectName, addFile } from '../../store/workspaceSlice';

export const Topbar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { projectName } = useSelector((state: RootState) => state.workspace);
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProjectNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setProjectName(e.target.value));
  }, [dispatch]);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (ext === 'pdf') {
        const url = URL.createObjectURL(file);
        dispatch(openPdfViewer({ url, fileName: file.name }));
      } else if (['txt', 'md', 'markdown', 'text', 'html', 'htm', 'json', 'csv', 'xml', 'log', 'css', 'js', 'mjs', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'rtf'].includes(ext)) {
        try {
          const text = await file.text();
          let content = text;
          if (ext === 'html' || ext === 'htm') {
            content = text;
          }
          dispatch(addFile({
            name: file.name,
            text: content,
          }));
          dispatch(addToast({ message: `Opened ${file.name}`, type: 'success' }));
        } catch {
          dispatch(addToast({ message: `Failed to read ${file.name}`, type: 'error' }));
        }
      } else {
        dispatch(addToast({ message: `Unsupported file type: .${ext}`, type: 'warning' }));
      }
    }

    // Reset input so same file can be selected again
    e.target.value = '';
  }, [dispatch]);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" id="sidebarToggle" title="Toggle sidebar" onClick={() => dispatch(toggleSidebar())}>☰</button>
        <button className="icon-btn" id="brandHome" title="Home" onClick={() => dispatch(openNewDocDialog())}>🏠</button>
      </div>
      <div className="topbar-center">
        <input
          ref={projectNameRef}
          id="projectName"
          value={projectName}
          onChange={handleProjectNameChange}
          className="doc-title"
          aria-label="Document title"
        />
      </div>
      <div className="topbar-right">
        <div className="menu-wrap">
          <button className="icon-btn" id="newBtn" title="New document" onClick={() => dispatch(openNewDocDialog())}>＋</button>
        </div>
        <button className="icon-btn" id="importBtn" title="Open file" onClick={() => fileInputRef.current?.click()}>📂</button>
        <input
          ref={fileInputRef}
          id="importFile"
          type="file"
          accept=".txt,.md,.markdown,.text,.html,.htm,.pdf,.docx,.doc,.odt,.epub,.rtf,.json,.csv,.xml,.log,.css,.js,.mjs,.ts,.jsx,.tsx,.py,.rb,.go,.rs,.java,.c,.h,.cpp,.yml,.yaml,.toml,.ini,.cfg"
          multiple
          hidden
          onChange={handleFilesSelected}
        />
        <div className="menu-wrap">
          <button className="icon-btn" id="exportBtn" title="Export" onClick={() => dispatch(showExportMenu())}>📤</button>
        </div>
        <button className="icon-btn" id="printBtn" title="Print" onClick={() => window.print()}>🖨️</button>
        <div className="menu-wrap">
          <button className="icon-btn primary" id="saveBtn" title="Save" onClick={() => dispatch(showSaveMenu())}>💾</button>
        </div>
        <span id="saveStatus" className="save-status">Ready</span>
        <button className="icon-btn" id="themeBtn" title="Toggle theme" onClick={() => dispatch({ type: 'ui/toggleTheme' })}>
          🌙
        </button>
        <button className="avatar" id="avatarBtn" title={currentUser ? `${currentUser.name} (${currentUser.email})` : 'Sign in to save across devices'} onClick={() => dispatch(openAuthDialog('login'))}>
          {currentUser ? (currentUser.name || currentUser.email || 'U')[0].toUpperCase() : 'Z'}
        </button>
      </div>
    </header>
  );
};

export default Topbar;
