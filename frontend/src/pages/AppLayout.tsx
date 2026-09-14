import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { checkSession } from '../store/authSlice';
import { apiClient } from '../api/client';
import { loadFromCloud } from '../store/workspaceSlice';
import { setSidebarOpen, setTheme, setInstallPromptAvailable, setSidebarWidth } from '../store/uiSlice';
import { Topbar } from '../components/Layout';
import { ResizeHandle } from '../components/Layout/ResizeHandle';
import { FidelKeyboard } from '../components/Keyboard/FidelKeyboard';
import { ContextMenu } from '../components/common/ContextMenu';
import { ToastContainer } from '../components/common/ToastContainer';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { TemplateDialog } from '../components/Dialogs/TemplateDialog';
import { NewDocDialog } from '../components/Dialogs/NewDocDialog';
import { ExportDialog } from '../components/Dialogs/ExportDialog';

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
    dispatch(checkSession());
    apiClient.getCsrfTokenFromServer().catch(() => {});
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

  const sidebarStyle = { width: sidebarCollapsed ? '60px' : `${sidebarWidth}px` } as React.CSSProperties;

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={sidebarStyle as any}>
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
      <ToastContainer />
      <FidelKeyboard />
      {pdfViewerOpen &&
        <React.Suspense fallback={null}>
          <PdfViewer />
        </React.Suspense>
      }
    </div>
  );
}