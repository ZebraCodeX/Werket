import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { workspaceApi } from '../api/workspace';
import type { WorkspaceState, File, WorkspaceData } from '../types/workspace';

const WORKSPACE_KEY = 'werket-workspace-v2';

const initialWorkspace = (): WorkspaceState => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(WORKSPACE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.files && Array.isArray(parsed.files)) {
          return {
            projectName: parsed.projectName || 'My documents',
            files: parsed.files,
            openIds: parsed.openIds || [parsed.files[0]?.id].filter(Boolean),
            activeId: parsed.activeId || parsed.files[0]?.id || null,
            font: parsed.font || 'Noto Sans Ethiopic',
            size: parsed.size || 18,
            align: parsed.align || 'left',
            lang: parsed.lang || 'am',
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
  const firstFile: File = {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Untitled.md',
    text: '',
    folder: '',
    lang: 'am',
    updated: Date.now(),
  };
  return {
    projectName: 'My documents',
    files: [firstFile],
    openIds: [firstFile.id],
    activeId: firstFile.id,
    font: 'Noto Sans Ethiopic',
    size: 18,
    align: 'left',
    lang: 'am',
  };
};

interface WorkspaceSliceState extends WorkspaceState {
  loading: boolean;
  saving: boolean;
  lastSynced: number | null;
  syncError: string | null;
}

const initialState: WorkspaceSliceState = {
  ...initialWorkspace(),
  loading: false,
  saving: false,
  lastSynced: null,
  syncError: null,
};

const saveToLocal = (workspace: WorkspaceState) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({
      projectName: workspace.projectName,
      files: workspace.files,
      openIds: workspace.openIds,
      activeId: workspace.activeId,
      font: workspace.font,
      size: workspace.size,
      align: workspace.align,
      lang: workspace.lang,
    }));
  }
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
    const { workspace } = getState() as { workspace: WorkspaceSliceState };
    try {
      await workspaceApi.save({
        projectName: workspace.projectName,
        files: workspace.files,
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
    deleteFile: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.files = state.files.filter(f => f.id !== id);
      state.openIds = state.openIds.filter(openId => openId !== id);
      if (state.activeId === id) {
        state.activeId = state.openIds[0] || state.files[0]?.id || null;
      }
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
      const data = action.payload;
      state.projectName = data.projectName || state.projectName;
      state.files = data.files || state.files;
      state.openIds = data.openIds || state.openIds;
      state.activeId = data.activeId || state.activeId;
      state.font = data.font || state.font;
      state.size = data.size || state.size;
      state.align = data.align || state.align;
      if (data.lang) state.lang = data.lang;
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
        const data = action.payload;
        state.projectName = data.projectName || state.projectName;
        state.files = data.files || state.files;
        state.openIds = data.openIds || state.openIds;
        state.activeId = data.activeId || state.activeId;
        state.font = data.font || state.font;
        state.size = data.size || state.size;
        state.align = data.align || state.align;
        if (data.lang) state.lang = data.lang;
        state.lastSynced = Date.now();
        state.syncError = null;
        saveToLocal(state);
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
  deleteFile,
  duplicateFile,
  setActiveFile,
  closeTab,
  reorderTabs,
  applyCloudWorkspace,
  createFileFromTemplate,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;