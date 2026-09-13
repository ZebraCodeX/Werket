import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EditorState, EditorSelection, UndoEntry } from '../types/editor';

const initialState: EditorState = {
  content: '',
  html: '<p><br></p>',
  selection: { start: 0, end: 0 },
  undoStack: [],
  redoStack: [],
  applyingHistory: false,
};

const MAX_HISTORY = 100;

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setContent: (state, action: PayloadAction<{ html: string; text?: string }>) => {
      state.html = action.payload.html;
      state.content = action.payload.text || '';
    },
    setSelection: (state, action: PayloadAction<EditorSelection>) => {
      if (!state.applyingHistory) {
        state.selection = action.payload;
      }
    },
    pushUndo: (state, action: PayloadAction<{ html: string; selection: EditorSelection }>) => {
      if (!state.applyingHistory) {
        const entry: UndoEntry = {
          html: action.payload.html,
          selection: action.payload.selection,
          timestamp: Date.now(),
        };
        state.undoStack.push(entry);
        if (state.undoStack.length > MAX_HISTORY) {
          state.undoStack.shift();
        }
        state.redoStack = [];
      }
    },
    undo: (state) => {
      if (state.undoStack.length > 0) {
        const currentEntry: UndoEntry = {
          html: state.html,
          selection: state.selection,
          timestamp: Date.now(),
        };
        state.redoStack.push(currentEntry);
        const prevEntry = state.undoStack.pop()!;
        state.applyingHistory = true;
        state.html = prevEntry.html;
        state.selection = prevEntry.selection;
        state.applyingHistory = false;
      }
    },
    redo: (state) => {
      if (state.redoStack.length > 0) {
        const currentEntry: UndoEntry = {
          html: state.html,
          selection: state.selection,
          timestamp: Date.now(),
        };
        state.undoStack.push(currentEntry);
        const nextEntry = state.redoStack.pop()!;
        state.applyingHistory = true;
        state.html = nextEntry.html;
        state.selection = nextEntry.selection;
        state.applyingHistory = false;
      }
    },
    },
});

export const {
  setContent,
  setSelection,
  pushUndo,
  undo,
  redo,
} = editorSlice.actions;

export default editorSlice.reducer;