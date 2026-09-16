import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { workspaceApi } from '../api/workspace';
import type { WorkspaceState, File, WorkspaceData, DeletedFile } from '../types/workspace';
import { loadWorkspace, saveWorkspace, snapshotWorkspace, readLocalMirror } from '../storage/workspaceStore';

const initialWorkspace = (): WorkspaceState => {
  const saved = readLocalMirror();
  if (saved) {
    return {
      projectName: saved.projectName || 'My documents',
      files: saved.files,
      deletedFiles: saved.deletedFiles || [],
      openIds: saved.openIds || [saved.files[0]?.id].filter(Boolean),
      activeId: saved.activeId || saved.files[0]?.id || null,
      font: saved.font || 'Noto Sans Ethiopic',
      size: saved.size || 18,
      align: saved.align || 'left',
      lang: saved.lang || 'en',
      loading: false,
      saving: false,
      lastSynced: null,
      syncError: null,
    };
  }
  const firstFile: File = {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Untitled.md',
    text: '',
    folder: '',
    lang: 'en',
    updated: Date.now(),
  };
  return {
    projectName: 'My documents',
    files: [firstFile],
    deletedFiles: [],
    openIds: [firstFile.id],
    activeId: firstFile.id,
    font: 'Noto Sans Ethiopic',
    size: 18,
    align: 'left',
    lang: 'en',
    loading: false,
    saving: false,
    lastSynced: null,
    syncError: null,
  };
};

const initialState: WorkspaceState = {
  ...initialWorkspace(),
  loading: false,
  saving: false,
  lastSynced: null,
  syncError: null,
};

// Persist to IndexedDB (with a localStorage mirror) so documents survive
// offline and aren't limited by the ~5 MB localStorage quota.
const saveToLocal = (workspace: WorkspaceState) => {
  saveWorkspace(snapshotWorkspace(workspace));
};

const applyWorkspaceData = (state: WorkspaceState, data: WorkspaceData) => {
  state.projectName = data.projectName || state.projectName;
  state.files = data.files || state.files;
  state.deletedFiles = data.deletedFiles || state.deletedFiles;
  state.openIds = data.openIds || state.openIds;
  state.activeId = data.activeId || state.activeId;
  state.font = data.font || state.font;
  state.size = data.size || state.size;
  state.align = data.align || state.align;
  if (data.lang) state.lang = data.lang;
};

const generateId = () => `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const loadFromCloud = createAsyncThunk<WorkspaceData, void, { rejectValue: string }>(
  'workspace/loadFromCloud',
  async (_, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.get();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load from cloud');
    }
  }
);

export const saveToCloud = createAsyncThunk<void, void, { rejectValue: string }>(
  'workspace/saveToCloud',
  async (_, { getState, rejectWithValue }) => {
    const { workspace } = getState() as { workspace: WorkspaceState };
    try {
      await workspaceApi.save({
        projectName: workspace.projectName,
        files: workspace.files,
        deletedFiles: workspace.deletedFiles,
        openIds: workspace.openIds,
        activeId: workspace.activeId,
        font: workspace.font,
        size: workspace.size,
        align: workspace.align,
        lang: workspace.lang,
      });
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to save to cloud');
    }
  }
);

export const hydrateWorkspace = createAsyncThunk<WorkspaceData | null, void>(
  'workspace/hydrate',
  async () => loadWorkspace()
);

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setProjectName: (state, action: PayloadAction<string>) => {
      state.projectName = action.payload;
      saveToLocal(state);
    },
    setFont: (state, action: PayloadAction<string>) => {
      state.font = action.payload;
      saveToLocal(state);
    },
    setSize: (state, action: PayloadAction<number>) => {
      state.size = action.payload;
      saveToLocal(state);
    },
    setAlign: (state, action: PayloadAction<'left' | 'center' | 'right' | 'justify'>) => {
      state.align = action.payload;
      saveToLocal(state);
    },
    setLang: (state, action: PayloadAction<'am' | 'en'>) => {
      state.lang = action.payload;
      saveToLocal(state);
    },
    addFile: (state, action: PayloadAction<Partial<File>>) => {
      const file: File = {
        id: generateId(),
        name: action.payload.name || 'Untitled.md',
        text: action.payload.text || '',
        folder: action.payload.folder || '',
        lang: action.payload.lang || state.lang,
        updated: Date.now(),
      };
      state.files.push(file);
      state.openIds.push(file.id);
      state.activeId = file.id;
      saveToLocal(state);
    },
    updateFile: (state, action: PayloadAction<{ id: string; text: string }>) => {
      const file = state.files.find(f => f.id === action.payload.id);
      if (file) {
        file.text = action.payload.text;
        file.updated = Date.now();
        saveToLocal(state);
      }
    },
    updateFileName: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const file = state.files.find(f => f.id === action.payload.id);
      if (file) {
        file.name = action.payload.name;
        file.updated = Date.now();
        saveToLocal(state);
      }
    },
    setFileLang: (state, action: PayloadAction<{ id: string; lang: 'am' | 'en' }>) => {
      const file = state.files.find(f => f.id === action.payload.id);
      if (file) {
        file.lang = action.payload.lang;
        file.updated = Date.now();
        saveToLocal(state);
      }
    },
    deleteFile: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const fileIndex = state.files.findIndex(f => f.id === id);
      if (fileIndex !== -1) {
        const file = state.files[fileIndex];
        const deletedFile: DeletedFile = {
          ...file,
          deletedAt: Date.now(),
          originalFolder: file.folder,
        };
        state.deletedFiles.unshift(deletedFile);
        state.files.splice(fileIndex, 1);
        state.openIds = state.openIds.filter(openId => openId !== id);
        if (state.activeId === id) {
          state.activeId = state.openIds[0] || state.files[0]?.id || null;
        }
        // Keep only last 50 deleted files
        if (state.deletedFiles.length > 50) {
          state.deletedFiles = state.deletedFiles.slice(0, 50);
        }
      }
      saveToLocal(state);
    },
    restoreFile: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const deletedIndex = state.deletedFiles.findIndex(f => f.id === id);
      if (deletedIndex !== -1) {
        const deletedFile = state.deletedFiles[deletedIndex];
        const { originalFolder, ...restoredFile } = deletedFile;
        restoredFile.folder = originalFolder || '';
        restoredFile.updated = Date.now();
        state.files.push(restoredFile);
        state.openIds.push(restoredFile.id);
        state.activeId = restoredFile.id;
        state.deletedFiles.splice(deletedIndex, 1);
      }
      saveToLocal(state);
    },
    permanentlyDeleteFile: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.deletedFiles = state.deletedFiles.filter(f => f.id !== id);
      saveToLocal(state);
    },
    emptyTrash: (state) => {
      state.deletedFiles = [];
      saveToLocal(state);
    },
    duplicateFile: (state, action: PayloadAction<string>) => {
      const original = state.files.find(f => f.id === action.payload);
      if (original) {
        const duplicate: File = {
          id: generateId(),
          name: original.name.replace(/(\.[^.]+)$/, ' copy$1') || original.name + ' copy',
          text: original.text,
          folder: original.folder,
          lang: original.lang,
          updated: Date.now(),
        };
        state.files.push(duplicate);
        state.openIds.push(duplicate.id);
        state.activeId = duplicate.id;
        saveToLocal(state);
      }
    },
    setActiveFile: (state, action: PayloadAction<string>) => {
      if (!state.openIds.includes(action.payload)) {
        state.openIds.push(action.payload);
      }
      state.activeId = action.payload;
      saveToLocal(state);
    },
    closeTab: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.openIds = state.openIds.filter(openId => openId !== id);
      if (state.activeId === id) {
        state.activeId = state.openIds[0] || state.files[0]?.id || null;
      }
      saveToLocal(state);
    },
    reorderTabs: (state, action: PayloadAction<string[]>) => {
      state.openIds = action.payload;
      saveToLocal(state);
    },
    applyCloudWorkspace: (state, action: PayloadAction<WorkspaceData>) => {
      applyWorkspaceData(state, action.payload);
      saveToLocal(state);
    },
    createFileFromTemplate: (state, action: PayloadAction<{ name: string; text: string; lang?: 'am' | 'en' }>) => {
      const file: File = {
        id: generateId(),
        name: action.payload.name,
        text: action.payload.text,
        folder: '',
        lang: action.payload.lang || state.lang,
        updated: Date.now(),
      };
      state.files.push(file);
      state.openIds.push(file.id);
      state.activeId = file.id;
      saveToLocal(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadFromCloud.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadFromCloud.fulfilled, (state, action) => {
        state.loading = false;
        applyWorkspaceData(state, action.payload);
        state.lastSynced = Date.now();
        state.syncError = null;
        saveToLocal(state);
      })
      .addCase(hydrateWorkspace.fulfilled, (state, action) => {
        if (action.payload) {
          applyWorkspaceData(state, action.payload);
          saveToLocal(state);
        }
      })
      .addCase(loadFromCloud.rejected, (state, action) => {
        state.loading = false;
        state.syncError = action.payload || 'Failed to load from cloud';
      })
      .addCase(saveToCloud.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveToCloud.fulfilled, (state) => {
        state.saving = false;
        state.lastSynced = Date.now();
        state.syncError = null;
      })
      .addCase(saveToCloud.rejected, (state, action) => {
        state.saving = false;
        state.syncError = action.payload || 'Failed to save to cloud';
      });
  },
});

export const {
  setProjectName,
  setFont,
  setSize,
  setAlign,
  setLang,
  addFile,
  updateFile,
  updateFileName,
  setFileLang,
  deleteFile,
  restoreFile,
  permanentlyDeleteFile,
  emptyTrash,
  duplicateFile,
  setActiveFile,
  closeTab,
  reorderTabs,
  applyCloudWorkspace,
  createFileFromTemplate,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;