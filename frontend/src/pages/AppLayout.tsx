import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { checkSession } from '../store/authSlice';
import { apiClient } from '../api/client';
import { loadFromCloud, hydrateWorkspace } from '../store/workspaceSlice';
import { flushWorkspace } from '../storage/workspaceStore';
import { initNative } from '../native';
import { setSidebarOpen, setTheme, setInstallPromptAvailable, setSidebarWidth } from '../store/uiSlice';
import { Topbar } from '../components/Layout';
import { ResizeHandle } from '../components/Layout/ResizeHandle';
import { ContextMenu } from '../components/common/ContextMenu';
import { ToastContainer } from '../components/common/ToastContainer';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { TemplateDialog } from '../components/Dialogs/TemplateDialog';
import { NewDocDialog } from '../components/Dialogs/NewDocDialog';
import { ExportDialog } from '../components/Dialogs/ExportDialog';
import { AuthDialog } from '../components/Dialogs/AuthDialog';

const PdfViewer = React.lazy(() => import('../components/Editor/PdfViewer').then(m => ({ default: m.PdfViewer })));

export function AppLayout() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, sidebarOpen, sidebarCollapsed, sidebarWidth, pdfViewerOpen } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const savedTheme = localStorage.getItem('werket-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      dispatch(setTheme(savedTheme));
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      dispatch(setTheme('dark'));
    }
    const savedWidth = localStorage.getItem('werket-sidebar-width');
    if (savedWidth) {
      dispatch(setSidebarWidth(parseInt(savedWidth, 10)));
    }
    void initNative();
    dispatch(hydrateWorkspace());
    dispatch(checkSession());
    apiClient.getCsrfTokenFromServer().catch(() => {});
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      dispatch(setInstallPromptAvailable(true));
    };
    const handleBeforeUnload = () => { void flushWorkspace(); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (user) {
      dispatch(loadFromCloud());
    }
  }, [user, dispatch]);

  // Drive the grid/sidebar width through CSS variables instead of setting a
  // width on the grid container (which squashed the whole app shell).
  const shellVars = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--sidebar-hover-width': `${sidebarWidth}px`,
  } as React.CSSProperties;

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={shellVars}>
      <div className="sidebar-backdrop" onClick={() => dispatch(setSidebarOpen(false))} />
      <ResizeHandle />
      <Topbar />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <ContextMenu />
      <TemplateDialog />
      <NewDocDialog />
      <ExportDialog />
      <AuthDialog />
      <ToastContainer />
      {pdfViewerOpen &&
        <React.Suspense fallback={null}>
          <PdfViewer />
        </React.Suspense>
      }
    </div>
  );
}