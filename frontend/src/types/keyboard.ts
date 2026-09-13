export type KeyboardLayer = 'fidel' | 'numbers' | 'symbols';

export interface KeyboardKey {
  label: string;
  value: string;
  type?: 'char' | 'fn' | 'space' | 'enter' | 'layer' | 'backspace';
  order?: number;
}

export interface KeyboardState {
  open: boolean;
  layer: KeyboardLayer;
  phoneticMode: boolean;
  deviceKeyboardMode: boolean;
  suggestions: string[];
  nextWords: string[];
  spellStatus: 'clean' | 'checking' | 'errors';
  spellSummary: string;
}

export interface SuggestionItem {
  word: string;
  distance?: number;
  frequency?: number;
}

export interface NextWordItem {
  word: string;
  count: number;
}