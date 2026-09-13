import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { dictionaryApi } from '../api/dictionary';

export function useSpellCheck() {
  const dispatch = useDispatch<AppDispatch>();
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const checkSpelling = useCallback(async (text: string) => {
    if (!text.trim()) {
      dispatch({ type: 'spell/setSpellStatus', payload: 'clean' });
      dispatch({ type: 'spell/setSpellSummary', payload: 'All words checked' });
      return;
    }
    dispatch({ type: 'spell/setSpellStatus', payload: 'checking' });
    try {
      const response = await dictionaryApi.check(text);
      const words = response.data.words;
      const errors = words.filter(w => !w.known);
      dispatch({ type: 'spell/setSpellStatus', payload: errors.length > 0 ? 'errors' : 'clean' });
      dispatch({ type: 'spell/setSpellSummary', payload: errors.length > 0 ? `${errors.length} word${errors.length !== 1 ? 's' : ''} flagged` : 'All words checked' });
    } catch {
      dispatch({ type: 'spell/setSpellStatus', payload: 'clean' });
      dispatch({ type: 'spell/setSpellSummary', payload: 'Spell check unavailable' });
    }
  }, [dispatch]);

  const debouncedCheck = useCallback((text: string) => {
    if (timer) clearTimeout(timer);
    const newTimer = setTimeout(() => checkSpelling(text), 800);
    setTimer(newTimer);
  }, [timer, checkSpelling]);

  return { debouncedCheck, checkSpelling };
}
