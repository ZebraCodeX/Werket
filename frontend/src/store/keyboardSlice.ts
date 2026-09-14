import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { KeyboardState, KeyboardLayer } from '../types/keyboard';

const initialState: KeyboardState = {
  open: false,
  docked: false,
  layer: 'fidel',
  phoneticMode: true,
  deviceKeyboardMode: false,
};

const keyboardSlice = createSlice({
  name: 'keyboard',
  initialState,
  reducers: {
    setOpen: (state, action: PayloadAction<boolean>) => {
      state.open = action.payload;
    },
    setDocked: (state, action: PayloadAction<boolean>) => {
      state.docked = action.payload;
    },
    toggleDocked: (state) => {
      state.docked = !state.docked;
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
  },
});

export const {
  setOpen,
  setDocked,
  toggleDocked,
  nextLayer,
  setPhoneticMode,
  setDeviceKeyboardMode,
} = keyboardSlice.actions;

export default keyboardSlice.reducer;