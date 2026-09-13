import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';
import { checkSession } from './store/authSlice';
import { loadFromCloud } from './store/workspaceSlice';
import { setTheme, setHomeOpen } from './store/uiSlice';
import { Topbar } from './components/Layout';
import { DocumentPaper, EditorToolbar, FindBar } from './components/Editor';
import { PdfViewer } from './components/Editor/PdfViewer';
import { FidelKeyboard } from './components/Keyboard';
import { FileTree } from './components/FileTree/FileTree';
import { InspectorSidebar } from './components/Inspector';
import { AuthDialog } from './components/Dialogs/AuthDialog';
import { TemplateDialog } from './components/Dialogs/TemplateDialog';
import { NewDocDialog } from './components/Dialogs/NewDocDialog';
import { ExportDialog } from './components/Dialogs/ExportDialog';
import { ContextMenu } from './components/common/ContextMenu';
import { ToastContainer } from './components/common/ToastContainer';
import { Home } from './components/Home/Home';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, sidebarOpen, keyboardOpen, pdfViewerOpen, homeOpen } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const savedTheme = localStorage.getItem('werket-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      dispatch(setTheme(savedTheme));
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      dispatch(setTheme('dark'));
    }
    dispatch(checkSession());
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      dispatch({ type: 'ui/setInstallPromptAvailable', payload: true });
      (e as any).prompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme, dispatch]);

  useEffect(() => {
    if (user) {
      dispatch(loadFromCloud());
    }
  }, [user, dispatch]);

  const handleOpenEditor = useCallback(() => {
    dispatch(setHomeOpen(false));
  }, [dispatch]);

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''} ${keyboardOpen ? 'osk-open' : ''}`}>
      <Topbar />
      {homeOpen ? (
        <Home onOpenEditor={handleOpenEditor} />
      ) : (
        <>
          <FileTree />
          <main className="editor-area">
            <EditorToolbar />
            <FindBar />
            <DocumentPaper />
            <InspectorSidebar />
          </main>
        </>
      )}
      <FidelKeyboard />
      <ContextMenu />
      <AuthDialog />
      <TemplateDialog />
      <NewDocDialog />
      <ExportDialog />
      <ToastContainer />
      {pdfViewerOpen && <PdfViewer />}
    </div>
  );
}

export default App;
