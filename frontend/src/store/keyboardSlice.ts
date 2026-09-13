import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { KeyboardState, KeyboardLayer } from '../types/keyboard';

const initialState: KeyboardState = {
  open: false,
  layer: 'fidel',
  phoneticMode: true,
  deviceKeyboardMode: false,
  suggestions: [],
  nextWords: [],
  spellStatus: 'clean',
  spellSummary: 'All words checked',
};

const keyboardSlice = createSlice({
  name: 'keyboard',
  initialState,
  reducers: {
    setOpen: (state, action: PayloadAction<boolean>) => {
      state.open = action.payload;
    },
    toggleOpen: (state) => {
      state.open = !state.open;
    },
    setLayer: (state, action: PayloadAction<KeyboardLayer>) => {
      state.layer = action.payload;
    },
    nextLayer: (state) => {
      const layers: KeyboardLayer[] = ['fidel', 'numbers', 'symbols'];
      const currentIndex = layers.indexOf(state.layer);
      state.layer = layers[(currentIndex + 1) % layers.length];
    },
    setPhoneticMode: (state, action: PayloadAction<boolean>) => {
      state.phoneticMode = action.payload;
    },
    setDeviceKeyboardMode: (state, action: PayloadAction<boolean>) => {
      state.deviceKeyboardMode = action.payload;
    },
    setSuggestions: (state, action: PayloadAction<string[]>) => {
      state.suggestions = action.payload;
    },
    setNextWords: (state, action: PayloadAction<string[]>) => {
      state.nextWords = action.payload;
    },
    setSpellStatus: (state, action: PayloadAction<'clean' | 'checking' | 'errors'>) => {
      state.spellStatus = action.payload;
    },
    setSpellSummary: (state, action: PayloadAction<string>) => {
      state.spellSummary = action.payload;
    },
    clearSuggestions: (state) => {
      state.suggestions = [];
      state.nextWords = [];
    },
  },
});

export const {
  setOpen,
  toggleOpen,
  setLayer,
  nextLayer,
  setPhoneticMode,
  setDeviceKeyboardMode,
  setSuggestions,
  setNextWords,
  setSpellStatus,
  setSpellSummary,
  clearSuggestions,
} = keyboardSlice.actions;

export default keyboardSlice.reducer;