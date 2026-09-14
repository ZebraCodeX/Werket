/**
 * Phonetic composition for real-time typing.
 * Handles the phonetic buffer and composition state.
 */

import { compose, DIGRAPHS, PHONETIC } from './fidel';

export interface PhoneticState {
  buffer: string;
  start: number;
  rendered: string;
  composing: boolean;
}

export const initialPhoneticState: PhoneticState = {
  buffer: '',
  start: 0,
  rendered: '',
  composing: false,
};

/**
 * Process a key press for phonetic composition.
 * Returns the composed character(s) and updated state.
 */
export function processPhoneticKey(
  state: PhoneticState,
  key: string,
  isBackspace: boolean
): { output: string; newState: PhoneticState; consumed: boolean } {
  if (isBackspace) {
    if (state.buffer.length > 0) {
      const newBuffer = state.buffer.slice(0, -1);
      return {
        output: '',
        newState: { ...state, buffer: newBuffer, composing: newBuffer.length > 0 },
        consumed: true,
      };
    }
    return { output: '', newState: state, consumed: false };
  }

  // Check if key is a printable character
  if (key.length !== 1 || key === ' ' || key === '\t' || key === '\n') {
    // Non-composable key - flush buffer
    if (state.buffer.length > 0) {
      const composed = compose(state.buffer);
      return {
        output: composed + key,
        newState: initialPhoneticState,
        consumed: true,
      };
    }
    return { output: key, newState: state, consumed: false };
  }

  // Try to compose with the new character
  const testBuffer = state.buffer + key;
  const composed = compose(testBuffer);

  // Check if the last character changed (meaning composition happened)
  const prevComposed = compose(state.buffer);
  if (composed !== prevComposed + key) {
    // Composition happened - update buffer
    return {
      output: '',
      newState: { ...state, buffer: testBuffer, composing: true },
      consumed: true,
    };
  }

  // No composition - check if this key starts a new composition
  const lowerKey = key.toLowerCase();
  const isDigraphStart = Object.keys(DIGRAPHS).some(d => d.startsWith(lowerKey));
  const isPhoneticKey = key in PHONETIC;

  if (isDigraphStart || isPhoneticKey) {
    return {
      output: '',
      newState: { ...state, buffer: testBuffer, composing: true },
      consumed: true,
    };
  }

  // Not a composition key - flush buffer and output key
  if (state.buffer.length > 0) {
    const flushed = compose(state.buffer);
    return {
      output: flushed + key,
      newState: initialPhoneticState,
      consumed: true,
    };
  }

  return { output: key, newState: state, consumed: false };
}

/**
 * Flush the phonetic buffer and return the composed text.
 */
export function flushPhoneticBuffer(state: PhoneticState): string {
  if (state.buffer.length === 0) return '';
  return compose(state.buffer);
}

/**
 * Get the current preview of what the buffer would compose to.
 */
export function getPhoneticPreview(state: PhoneticState): string {
  if (state.buffer.length === 0) return '';
  return compose(state.buffer);
}

/**
 * Check if we're currently in a composition sequence.
 */
export function isComposing(state: PhoneticState): boolean {
  return state.composing && state.buffer.length > 0;
}

/**
 * Get the current buffer as display text (for showing in a preview).
 */
export function getBufferDisplay(state: PhoneticState): string {
  return state.buffer;
}