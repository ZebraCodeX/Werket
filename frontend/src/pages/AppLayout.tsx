import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { checkSession } from '../store/authSlice';
import { loadFromCloud } from '../store/workspaceSlice';
import { setSidebarOpen, setTheme, setInstallPromptAvailable } from '../store/uiSlice';
import { Topbar } from '../components/Layout';
import { ContextMenu } from '../components/common/ContextMenu';
import { ToastContainer } from '../components/common/ToastContainer';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { TemplateDialog } from '../components/Dialogs/TemplateDialog';
import { NewDocDialog } from '../components/Dialogs/NewDocDialog';
import { ExportDialog } from '../components/Dialogs/ExportDialog';

const PdfViewer = React.lazy(() => import('../components/Editor/PdfViewer').then(m => ({ default: m.PdfViewer })));

export function AppLayout() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, sidebarOpen, sidebarCollapsed, pdfViewerOpen } = useSelector((state: RootState) => state.ui);
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
      dispatch(setInstallPromptAvailable(true));
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (user) {
      dispatch(loadFromCloud());
    }
  }, [user, dispatch]);

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-backdrop" onClick={() => dispatch(setSidebarOpen(false))} />
      <Topbar />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <ContextMenu />
      <TemplateDialog />
      <NewDocDialog />
      <ExportDialog />
      <ToastContainer />
      {pdfViewerOpen &&
        <React.Suspense fallback={null}>
          <PdfViewer />
        </React.Suspense>
      }
    </div>
  );
}