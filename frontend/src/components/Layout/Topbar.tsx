import React, { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import {
  setSidebarOpen,
  toggleSidebarCollapsed,
  openExportDialog,
  openNewDocDialog,
  openPdfViewer,
  addToast,
  toggleTheme,
  openAuthDialog,
} from '../../store/uiSlice';
import { setProjectName, addFile, saveToCloud } from '../../store/workspaceSlice';
import { toggleDocked } from '../../store/keyboardSlice';
import { useOnline } from '../../hooks/useOnline';
import { isTokenAuth } from '../../platform';

export const Topbar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { projectName, saving, lastSynced, activeId, files } = useSelector((state: RootState) => state.workspace);
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const { sidebarOpen } = useSelector((state: RootState) => state.ui);
  const { docked: keyboardDocked, deviceKeyboardMode } = useSelector((state: RootState) => state.keyboard);
  const isAmharicDoc = files.find(f => f.id === activeId)?.lang === 'am';
  const online = useOnline();
  const projectNameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleSidebar = useCallback(() => {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (isMobile) {
      dispatch(setSidebarOpen(!sidebarOpen));
    } else {
      dispatch(toggleSidebarCollapsed());
    }
  }, [dispatch, sidebarOpen]);

  const handleSave = useCallback(() => {
    dispatch(saveToCloud());
  }, [dispatch]);

  const saveStatus = saving ? 'Saving…' : lastSynced ? 'Synced' : 'Ready';

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

  const handleHomeClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" id="sidebarToggle" title="Toggle sidebar" onClick={handleToggleSidebar}>☰</button>
        <button className="icon-btn" id="brandHome" title="Home" onClick={handleHomeClick}>🏠</button>
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
          <button className="icon-btn" id="exportBtn" title="Export" onClick={() => dispatch(openExportDialog('pdf'))}>📤</button>
        </div>
        <button className="icon-btn" id="printBtn" title="Print" onClick={() => window.print()}>🖨️</button>
        {isAmharicDoc && !deviceKeyboardMode && (
          <button
            className={`icon-btn keyboard-toggle-topbar ${keyboardDocked ? 'primary' : ''}`}
            title={keyboardDocked ? 'Hide Amharic keyboard' : 'Show Amharic keyboard'}
            aria-label={keyboardDocked ? 'Hide Amharic keyboard' : 'Show Amharic keyboard'}
            aria-pressed={keyboardDocked}
            onClick={() => dispatch(toggleDocked())}
          >⌨</button>
        )}
        <div className="menu-wrap">
          <button className="icon-btn primary" id="saveBtn" title="Save" onClick={handleSave}>💾</button>
        </div>
        <span id="saveStatus" className="save-status">{saveStatus}</span>
        {!online && (
          <span className="offline-badge" title="Offline - changes are saved on this device">
            Offline
          </span>
        )}
        <button className="icon-btn" id="themeBtn" title="Toggle theme" onClick={() => dispatch(toggleTheme())}>
          🌙
        </button>
        {currentUser ? (
          <button className="avatar" id="avatarBtn" title={`${currentUser.name} (${currentUser.email})`}>
            {(currentUser.name || currentUser.email || 'U')[0].toUpperCase()}
          </button>
        ) : isTokenAuth ? (
          <div className="auth-links">
            <button className="auth-link" onClick={() => dispatch(openAuthDialog('login'))}>Sign In</button>
            <button className="auth-link primary" onClick={() => dispatch(openAuthDialog('signup'))}>Sign Up</button>
          </div>
        ) : (
          <div className="auth-links">
            <a href="/login/" className="auth-link">Sign In</a>
            <a href="/signup/" className="auth-link primary">Sign Up</a>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
