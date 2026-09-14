export type KeyboardLayer = 'fidel' | 'numbers' | 'symbols';

export interface KeyboardKey {
  label: string;
  value: string;
  type?: 'char' | 'fn' | 'space' | 'enter' | 'layer' | 'backspace';
  order?: number;
}

export interface KeyboardState {
  open: boolean;
  docked: boolean;
  layer: KeyboardLayer;
  phoneticMode: boolean;
  deviceKeyboardMode: boolean;
}

export interface SuggestionItem {
  word: string;
  distance?: number;
  frequency?: number;
}