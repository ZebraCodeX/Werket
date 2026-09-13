import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CheckWordResponse, SuggestionItem } from '../types/api';

interface SpellError {
  word: string;
  start: number;
  end: number;
  suggestions: SuggestionItem[];
}

interface SpellState {
  errors: SpellError[];
  checking: boolean;
  lastChecked: number;
  ignoreList: Set<string>;
  status: 'clean' | 'checking' | 'errors';
  summary: string;
}

const initialState: SpellState = {
  errors: [],
  checking: false,
  lastChecked: 0,
  ignoreList: new Set(),
  status: 'clean',
  summary: 'All words checked',
};

const spellSlice = createSlice({
  name: 'spell',
  initialState,
  reducers: {
    setErrors: (state, action: PayloadAction<CheckWordResponse[]>) => {
      state.errors = action.payload
        .filter(w => !w.known && !state.ignoreList.has(w.word))
        .map(w => ({
          word: w.word,
          start: w.start,
          end: w.end,
          suggestions: w.suggestions,
        }));
      state.checking = false;
      state.lastChecked = Date.now();
      state.status = state.errors.length > 0 ? 'errors' : 'clean';
      state.summary = state.errors.length > 0
        ? `${state.errors.length} word${state.errors.length !== 1 ? 's' : ''} flagged`
        : 'All words checked';
    },
    setChecking: (state, action: PayloadAction<boolean>) => {
      state.checking = action.payload;
    },
    setSpellStatus: (state, action: PayloadAction<'clean' | 'checking' | 'errors'>) => {
      state.status = action.payload;
    },
    setSpellSummary: (state, action: PayloadAction<string>) => {
      state.summary = action.payload;
    },
    ignoreWord: (state, action: PayloadAction<string>) => {
      state.ignoreList.add(action.payload);
      state.errors = state.errors.filter(e => e.word !== action.payload);
    },
    clearIgnoreList: (state) => {
      state.ignoreList.clear();
    },
    clearErrors: (state) => {
      state.errors = [];
      state.status = 'clean';
      state.summary = 'All words checked';
    },
  },
});

export const {
  setErrors,
  setChecking,
  setSpellStatus,
  setSpellSummary,
  ignoreWord,
  clearIgnoreList,
  clearErrors,
} = spellSlice.actions;

export default spellSlice.reducer;