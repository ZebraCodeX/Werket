import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { 
  nextLayer, 
  setPhoneticMode, 
  setDeviceKeyboardMode, 
  setSuggestions, 
  setNextWords,
} from '../store/keyboardSlice';
import { dictionaryApi } from '../api/dictionary';
import { compose } from '../utils/fidel';

export function useKeyboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { layer, phoneticMode, deviceKeyboardMode, suggestions, nextWords } = useSelector((state: RootState) => state.keyboard);
  const { keyboardOpen } = useSelector((state: RootState) => state.ui);

  const handleKeyClick = useCallback((key: string) => {
    const editor = document.getElementById('editor') as HTMLElement | null;
    if (!editor) return;

    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(key));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const handleFunctionKey = useCallback((key: string) => {
    switch (key) {
      case 'backspace':
        document.execCommand('delete');
        break;
      case 'layer':
        dispatch(nextLayer());
        break;
      case ' ':
        handleKeyClick(' ');
        break;
      case '\n':
        document.execCommand('insertHTML', false, '<br>');
        break;
    }
  }, [dispatch, handleKeyClick]);

  const handleFamilyClick = useCallback((family: string) => {
    const defaultChar = compose(family + '፡');
    handleKeyClick(defaultChar);
  }, [handleKeyClick]);

  const handleFamilyLongPress = useCallback(async (family: string) => {
    try {
      const response = await dictionaryApi.suggest(family);
      dispatch(setSuggestions(response.data.words));
      dispatch(setNextWords(response.data.next));
    } catch {
      // Ignore
    }
  }, [dispatch]);

  const handlePhoneticToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPhoneticMode(e.target.checked));
  }, [dispatch]);

  const handleDeviceKeyboard = useCallback(() => {
    dispatch(setDeviceKeyboardMode(true));
    const editor = document.getElementById('editor') as HTMLElement | null;
    if (editor) editor.focus();
  }, [dispatch]);

  const toggleKeyboard = useCallback(() => {
    dispatch({ type: 'ui/toggleKeyboard' });
  }, [dispatch]);

  const closeKeyboard = useCallback(() => {
    dispatch({ type: 'ui/setKeyboardOpen', payload: false });
  }, [dispatch]);

  return {
    layer,
    phoneticMode,
    deviceKeyboardMode,
    suggestions,
    nextWords,
    open: keyboardOpen,
    handleKeyClick,
    handleFunctionKey,
    handleFamilyClick,
    handleFamilyLongPress,
    handlePhoneticToggle,
    handleDeviceKeyboard,
    toggleKeyboard,
    closeKeyboard,
  };
}

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

export function useWorkspace() {
  const dispatch = useDispatch<AppDispatch>();
  const { files, openIds, activeId, font, size, align, lang } = useSelector((state: RootState) => state.workspace);

  const activeFile = files.find(f => f.id === activeId);

  return {
    files,
    openIds,
    activeId,
    activeFile,
    font,
    size,
    align,
    lang,
    addFile: (file: any) => dispatch({ type: 'workspace/addFile', payload: file }),
    updateFile: (id: string, text: string) => dispatch({ type: 'workspace/updateFile', payload: { id, text } }),
    deleteFile: (id: string) => dispatch({ type: 'workspace/deleteFile', payload: id }),
    duplicateFile: (id: string) => dispatch({ type: 'workspace/duplicateFile', payload: id }),
    setActiveFile: (id: string) => dispatch({ type: 'workspace/setActiveFile', payload: id }),
    closeTab: (id: string) => dispatch({ type: 'workspace/closeTab', payload: id }),
  };
}

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, loading, error, mode } = useSelector((state: RootState) => state.auth);

  return {
    user,
    loading,
    error,
    mode,
    login: (email: string, password: string) => dispatch({ type: 'auth/login', payload: { email, password } }),
    register: (name: string, email: string, password: string) => dispatch({ type: 'auth/register', payload: { name, email, password } }),
    logout: () => dispatch({ type: 'auth/logout' }),
    checkSession: () => dispatch({ type: 'auth/checkSession' }),
    setMode: (mode: 'login' | 'signup') => dispatch({ type: 'auth/setMode', payload: mode }),
  };
}

export function useResponsive() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  return { width, height, isMobile, isTablet, isDesktop, isTouch };
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
}