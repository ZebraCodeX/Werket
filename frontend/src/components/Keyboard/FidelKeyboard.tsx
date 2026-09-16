import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  INSERT_PARAGRAPH_COMMAND,
} from 'lexical';
import {
  nextLayer,
  setPhoneticMode,
  setDeviceKeyboardMode,
  setDocked,
} from '../../store/keyboardSlice';
import { FUNCTION_KEYS, ordersFor } from '../../utils/fidel';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';

const KEY_LAYOUTS = {
  fidel: [
    ['ሀ','ለ','ሐ','መ','ሠ','ረ','ሰ','ሸ'],
    ['ቀ','በ','ተ','ቸ','ኀ','ነ','ኘ','አ'],
    ['ከ','ኸ','ወ','ዐ','ዘ','ዠ','የ','ደ'],
    ['ጀ','ገ','ጠ','ጨ','ጰ','ጸ','ፀ'],
  ],
  numbers: [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['-','/',';',':','(',')','$','&','@','"'],
  ],
  symbols: [
    ['.','?','!',',','\'','-','_','+','='],
    ['[',']','{','}','#','%','*','^','|'],
    ['~','`','<','>','€','£','¥','•','§'],
  ],
};

const ORDER_LABELS = ['e', 'u', 'i', 'a', 'ie', '', 'o'];

export const FidelKeyboard: React.FC = React.memo(() => {
  const [editor] = useLexicalComposerContext();
  const dispatch = useDispatch<AppDispatch>();
  const { docked, layer, phoneticMode, deviceKeyboardMode } = useSelector((state: RootState) => state.keyboard);
  const { activeId, files } = useSelector((state: RootState) => state.workspace);
  const grabRef = useRef<HTMLDivElement>(null);
  const [ordersFamily, setOrdersFamily] = useState<string | null>(null);

  const activeFile = files.find(f => f.id === activeId);
  const isAmharicDoc = activeFile?.lang === 'am';

  // The custom keyboard is "active" only when it is docked for an Amharic doc
  // and the user has not switched to the device keyboard.
  const customKeyboardActive = docked && !!isAmharicDoc && !deviceKeyboardMode;

  useSwipeGesture(grabRef, {
    onSwipeDown: () => dispatch(setDocked(false)),
    onSwipeUp: () => {},
    threshold: 50,
  });

  // Suppress the OS soft keyboard while the custom keyboard is showing, and
  // give the editor room to scroll above the docked panel. This is purely
  // manual: the keyboard never opens on its own.
  useEffect(() => {
    const root = editor.getRootElement();
    if (root) {
      if (customKeyboardActive) {
        root.setAttribute('inputmode', 'none');
      } else {
        root.removeAttribute('inputmode');
      }
    }
    document.documentElement.classList.toggle('osk-open', customKeyboardActive);
    return () => {
      document.documentElement.classList.remove('osk-open');
    };
  }, [editor, customKeyboardActive]);

  const functionKeys = useMemo(() => FUNCTION_KEYS[layer], [layer]);

  const handleKeyClick = useCallback((key: string) => {
    const rootElement = editor.getRootElement();
    if (rootElement) rootElement.focus();
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(key);
      }
    });
  }, [editor]);

  const handleDelete = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.deleteCharacter(selection.isCollapsed());
      }
    });
  }, [editor]);

  const handleEnter = useCallback(() => {
    editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  }, [editor]);

  const handleFunctionKey = useCallback((key: string) => {
    switch (key) {
      case 'backspace':
        handleDelete();
        break;
      case 'layer':
        dispatch(nextLayer());
        break;
      case ' ':
        handleKeyClick(' ');
        break;
      case '\n':
        handleEnter();
        break;
      default:
        break;
    }
  }, [handleDelete, handleKeyClick, handleEnter, dispatch]);

  // A family key opens its seven vowel orders; picking one inserts it.
  const handleFamilyKey = useCallback((family: string) => {
    setOrdersFamily(current => (current === family ? null : family));
  }, []);

  const insertOrder = useCallback((char: string) => {
    handleKeyClick(char);
    setOrdersFamily(null);
  }, [handleKeyClick]);

  const handlePhoneticToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPhoneticMode(e.target.checked));
  }, [dispatch]);

  const handleDeviceKeyboard = useCallback(() => {
    dispatch(setDeviceKeyboardMode(true));
    const rootElement = editor.getRootElement();
    if (rootElement) rootElement.focus();
  }, [dispatch, editor]);

  const closeKeyboard = useCallback(() => {
    dispatch(setDocked(false));
  }, [dispatch]);

  if (deviceKeyboardMode) return null;
  if (!isAmharicDoc) return null;

  const currentLayout = KEY_LAYOUTS[layer as keyof typeof KEY_LAYOUTS] || [];

  return (
    <section
      id="keyboardPanel"
      className={`keyboard-panel${docked ? ' open' : ''}`}
      data-layer={layer}
      role="region"
      aria-label="Amharic keyboard"
    >
      <div ref={grabRef} className="keyboard-grab" aria-hidden="true" />
      <button className="keyboard-hide-btn" onClick={closeKeyboard}>Hide keyboard</button>

      {ordersFamily && layer === 'fidel' && (
        <div className="keyboard-orders" role="group" aria-label={`${ordersFamily} vowel orders`}>
          {ordersFor(ordersFamily).map((char, index) => (
            <button
              key={char}
              className="order-key"
              onPointerDown={e => { e.preventDefault(); insertOrder(char); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); insertOrder(char); } }}
            >
              <span className="order-char">{char}</span>
              <span className="order-label">{ORDER_LABELS[index]}</span>
            </button>
          ))}
          <button
            className="order-key order-close"
            aria-label="Close order picker"
            onPointerDown={e => { e.preventDefault(); setOrdersFamily(null); }}
          >
            <span className="order-char">✕</span>
          </button>
        </div>
      )}

      <div id="keyboard" className="keyboard" role="application" aria-label="Amharic keyboard">
        <div className="keyboard-rows">
          {currentLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="keyboard-row">
              {row.map((keyChar, keyIndex) => (
                <span key={`${rowIndex}-${keyIndex}`} className="fidel-key-wrapper">
                  <button
                    className={`key key-char${ordersFamily === keyChar ? ' active' : ''}`}
                    onPointerDown={e => {
                      e.preventDefault();
                      if (layer === 'fidel') handleFamilyKey(keyChar);
                      else handleKeyClick(keyChar);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (layer === 'fidel') handleFamilyKey(keyChar);
                        else handleKeyClick(keyChar);
                      }
                    }}
                    aria-haspopup={layer === 'fidel' ? 'true' : undefined}
                    aria-expanded={layer === 'fidel' ? ordersFamily === keyChar : undefined}
                  >
                    <span className="key-label">{keyChar}</span>
                    {layer === 'fidel' && <span className="key-sub-label">⌄</span>}
                  </button>
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="keyboard-row function-row">
          {functionKeys.map((k, i) => (
            <button
              key={i}
              className={`key key-fn key-fn-${k.type}`}
              onPointerDown={e => { e.preventDefault(); handleFunctionKey(k.value); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFunctionKey(k.value); } }}
              aria-label={k.label}
            >
              <span className="fn-label">{k.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="keyboard-info-row">
        <div className="keyboard-info-section">
          <label className="switch-label">
            <input
              id="phoneticToggle"
              type="checkbox"
              checked={phoneticMode}
              onChange={handlePhoneticToggle}
            />
            <span>Phonetic</span>
          </label>
          <button id="deviceKbBtn" className="small-btn" onClick={handleDeviceKeyboard}>
            Device keyboard
          </button>
          <button id="closeKeyboard" className="small-btn" onClick={closeKeyboard}>
            Hide
          </button>
        </div>
      </div>
    </section>
  );
});

export default FidelKeyboard;
