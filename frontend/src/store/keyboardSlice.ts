import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { KeyboardState, KeyboardLayer } from '../types/keyboard';

const initialState: KeyboardState = {
  open: false,
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
  nextLayer,
  setPhoneticMode,
  setDeviceKeyboardMode,
} = keyboardSlice.actions;

export default keyboardSlice.reducer;