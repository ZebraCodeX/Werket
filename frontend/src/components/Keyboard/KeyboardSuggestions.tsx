import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

interface KeyboardSuggestionsProps {
  onSelect?: (word: string) => void;
}

export const KeyboardSuggestions: React.FC<KeyboardSuggestionsProps> = ({ onSelect }) => {
  const { suggestions, nextWords } = useSelector((state: RootState) => state.keyboard);

  if (!suggestions.length && !nextWords.length) {
    return (
      <div className="keyboard-suggest-row">
        <span className="keyboard-suggest-label">Suggestions</span>
        <span className="empty">Type to see dictionary words</span>
      </div>
    );
  }

  return (
    <div className="keyboard-suggest-row">
      <span className="keyboard-suggest-label">Suggestions</span>
      {suggestions.map((word, i) => (
        <button key={i} className="suggestion" onClick={() => onSelect?.(word)}>
          {word}
        </button>
      ))}
      {nextWords.map((word, i) => (
        <button key={`next-${i}`} className="suggestion" onClick={() => onSelect?.(word)}>
          {word}
        </button>
      ))}
    </div>
  );
};

export default KeyboardSuggestions;