import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  inspectorTab: 'style' | 'text' | 'layout';
  findOpen: boolean;
  findQuery: string;
  authDialogOpen: boolean;
  authMode: 'login' | 'signup';
  templateDialogOpen: boolean;
  newDocDialogOpen: boolean;
  newDocData: {
    lang: 'am' | 'en';
    name: string;
    templateId: string;
  };
  exportDialogOpen: boolean;
  exportFormat: string | null;
  contextMenu: {
    open: boolean;
    x: number;
    y: number;
    fileId: string | null;
    isSpellError: boolean;
    spellErrorData: {
      word: string;
      suggestions: Array<{ word: string; distance: number; frequency: number }>;
    } | null;
  };
  theme: 'light' | 'dark';
  installPrompt: {
    available: boolean;
    shown: boolean;
  };
  toasts: Array<{ id: number; message: string; type: 'info' | 'success' | 'error' | 'warning' }>;
  zoom: number;
  pdfViewerOpen: boolean;
  pdfUrl: string | null;
  pdfFileName: string | null;
  homeOpen: boolean;
}

const initialState: UIState = {
  sidebarOpen: false,
  sidebarCollapsed: true, // Start collapsed on desktop
  inspectorOpen: false,
  inspectorTab: 'style',
  findOpen: false,
  findQuery: '',
  authDialogOpen: false,
  authMode: 'login',
  templateDialogOpen: false,
  newDocDialogOpen: false,
  newDocData: {
    lang: 'am',
    name: 'Untitled.md',
    templateId: 'blank',
  },
  exportDialogOpen: false,
  exportFormat: null,
  contextMenu: {
    open: false,
    x: 0,
    y: 0,
    fileId: null,
    isSpellError: false,
    spellErrorData: null,
  },
  theme: (typeof window !== 'undefined' && localStorage.getItem('werket-theme') === 'dark') ? 'dark' : 'light',
  installPrompt: {
    available: false,
    shown: false,
  },
  toasts: [],
  zoom: 1,
  pdfViewerOpen: false,
  pdfUrl: null,
  pdfFileName: null,
  homeOpen: true,
};

let toastId = 0;

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    toggleInspector: (state) => {
      state.inspectorOpen = !state.inspectorOpen;
    },
    setInspectorOpen: (state, action: PayloadAction<boolean>) => {
      state.inspectorOpen = action.payload;
    },
    setInspectorTab: (state, action: PayloadAction<'style' | 'text' | 'layout'>) => {
      state.inspectorTab = action.payload;
    },
    setFindOpen: (state, action: PayloadAction<boolean>) => {
      state.findOpen = action.payload;
      if (!action.payload) state.findQuery = '';
    },
    setFindQuery: (state, action: PayloadAction<string>) => {
      state.findQuery = action.payload;
    },
    openAuthDialog: (state, action: PayloadAction<'login' | 'signup'>) => {
      state.authDialogOpen = true;
      state.authMode = action.payload;
    },
    closeAuthDialog: (state) => {
      state.authDialogOpen = false;
    },
    setAuthMode: (state, action: PayloadAction<'login' | 'signup'>) => {
      state.authMode = action.payload;
    },
    openTemplateDialog: (state) => {
      state.templateDialogOpen = true;
    },
    closeTemplateDialog: (state) => {
      state.templateDialogOpen = false;
    },
    openNewDocDialog: (state) => {
      state.newDocDialogOpen = true;
    },
    closeNewDocDialog: (state) => {
      state.newDocDialogOpen = false;
    },
    setNewDocLang: (state, action: PayloadAction<'am' | 'en'>) => {
      state.newDocData.lang = action.payload;
    },
    setNewDocName: (state, action: PayloadAction<string>) => {
      state.newDocData.name = action.payload;
    },
    setNewDocTemplate: (state, action: PayloadAction<string>) => {
      state.newDocData.templateId = action.payload;
    },
    openExportDialog: (state, action: PayloadAction<string>) => {
      state.exportDialogOpen = true;
      state.exportFormat = action.payload;
    },
    closeExportDialog: (state) => {
      state.exportDialogOpen = false;
      state.exportFormat = null;
    },
    showContextMenu: (state, action: PayloadAction<{ x: number; y: number; fileId: string | null }>) => {
      state.contextMenu = {
        open: true,
        x: action.payload.x,
        y: action.payload.y,
        fileId: action.payload.fileId,
        isSpellError: false,
        spellErrorData: null,
      };
    },
    showSpellErrorMenu: (state, action: PayloadAction<{ x: number; y: number; word: string; suggestions: Array<{ word: string; distance: number; frequency: number }> }>) => {
      state.contextMenu = {
        open: true,
        x: action.payload.x,
        y: action.payload.y,
        fileId: null,
        isSpellError: true,
        spellErrorData: {
          word: action.payload.word,
          suggestions: action.payload.suggestions,
        },
      };
    },
    hideContextMenu: (state) => {
      state.contextMenu = { ...initialState.contextMenu };
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('werket-theme', action.payload);
        document.documentElement.dataset.theme = action.payload;
      }
    },
    toggleTheme: (state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      state.theme = newTheme;
      if (typeof window !== 'undefined') {
        localStorage.setItem('werket-theme', newTheme);
        document.documentElement.dataset.theme = newTheme;
      }
    },
    setInstallPromptAvailable: (state, action: PayloadAction<boolean>) => {
      state.installPrompt.available = action.payload;
    },
    setInstallPromptShown: (state, action: PayloadAction<boolean>) => {
      state.installPrompt.shown = action.payload;
    },
    addToast: (state, action: PayloadAction<{ message: string; type: 'info' | 'success' | 'error' | 'warning' }>) => {
      state.toasts.push({
        id: ++toastId,
        message: action.payload.message,
        type: action.payload.type,
      });
    },
    removeToast: (state, action: PayloadAction<number>) => {
      state.toasts = state.toasts.filter(t => t.id !== action.payload);
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    openPdfViewer: (state, action: PayloadAction<{ url: string; fileName: string }>) => {
      state.pdfViewerOpen = true;
      state.pdfUrl = action.payload.url;
      state.pdfFileName = action.payload.fileName;
    },
    closePdfViewer: (state) => {
      state.pdfViewerOpen = false;
      if (state.pdfUrl && state.pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(state.pdfUrl);
      }
      state.pdfUrl = null;
      state.pdfFileName = null;
    },
    setHomeOpen: (state, action: PayloadAction<boolean>) => {
      state.homeOpen = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  toggleInspector,
  setInspectorOpen,
  setInspectorTab,
  setFindOpen,
  setFindQuery,
  openAuthDialog,
  closeAuthDialog,
  setAuthMode,
  openTemplateDialog,
  closeTemplateDialog,
  openNewDocDialog,
  closeNewDocDialog,
  setNewDocLang,
  setNewDocName,
  setNewDocTemplate,
  openExportDialog,
  closeExportDialog,
  showContextMenu,
  showSpellErrorMenu,
  hideContextMenu,
  setTheme,
  toggleTheme,
  setInstallPromptAvailable,
  setInstallPromptShown,
  addToast,
  removeToast,
  setZoom,
  openPdfViewer,
  closePdfViewer,
  setHomeOpen,
} = uiSlice.actions;

export default uiSlice.reducer;