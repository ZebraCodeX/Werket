import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setFindOpen, setFindQuery } from '../../store/uiSlice';

export const FindBar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { findOpen, findQuery } = useSelector((state: RootState) => state.ui);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (findOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [findOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      dispatch(setFindOpen(false));
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Find previous
        console.log('Find previous:', findQuery);
      } else {
        // Find next
        console.log('Find next:', findQuery);
      }
    }
  };

  if (!findOpen) return null;

  return (
    <div className="find-bar open" role="search">
      <input
        ref={inputRef}
        id="findInput"
        type="text"
        placeholder="Find in document..."
        value={findQuery}
        onChange={e => dispatch(setFindQuery(e.target.value))}
        onKeyDown={handleKeyDown}
      />
      <span id="findCount">0 matches</span>
      <button id="findPrev" title="Previous" onClick={() => console.log('Find previous')}>↑</button>
      <button id="findNext" title="Next" onClick={() => console.log('Find next')}>↓</button>
      <button id="closeFind" onClick={() => dispatch(setFindOpen(false))}>×</button>
    </div>
  );
};

export default FindBar;