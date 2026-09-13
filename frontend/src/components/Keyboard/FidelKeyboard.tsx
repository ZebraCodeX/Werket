import React, { useMemo, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import {
  nextLayer,
  setPhoneticMode,
  setDeviceKeyboardMode,
  setSuggestions,
  setNextWords,
  setOpen,
} from '../../store/keyboardSlice';
import { FAMILIES, ordersFor, charFor, KEYBOARD_LAYERS, FUNCTION_KEYS } from '../../utils/fidel';
import { dictionaryApi } from '../../api/dictionary';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';

interface FidelKeyProps {
  family: string;
  orders: string[];
  onSelect: (char: string) => void;
}

const FidelKey: React.FC<FidelKeyProps> = ({ family, orders, onSelect }) => {
  const [showOrders, setShowOrders] = useState(false);

  return (
    <div className="fidel-key-wrapper" onMouseEnter={() => setShowOrders(true)} onMouseLeave={() => setShowOrders(false)}>
      <button
        className="key fidel-family-key"
        onClick={() => onSelect(charFor(family, 'silent'))}
        onContextMenu={e => { e.preventDefault(); setShowOrders(true); }}
      >
        {family}
      </button>
      {showOrders && (
        <div className="orders-popover">
          {orders.map((char, index) => (
            <button
              key={index}
              className="order-key"
              onClick={() => { onSelect(char); setShowOrders(false); }}
            >
              {char}
              <span className="order-label">{['1st','2nd','3rd','4th','5th','6th','7th'][index]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const FidelKeyboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { layer, phoneticMode, deviceKeyboardMode, suggestions } = useSelector((state: RootState) => state.keyboard);
  const grabRef = useRef<HTMLDivElement>(null);

  useSwipeGesture(grabRef, {
    onSwipeDown: () => dispatch(setOpen(false)),
    onSwipeUp: () => {},
    threshold: 50,
  });

  const fidelKeys = useMemo(() => {
    return FAMILIES.map((family) => ({
      family,
      orders: ordersFor(family),
    }));
  }, []);

  const otherKeys = useMemo(() => {
    const layerKeys = KEYBOARD_LAYERS[layer];
    if (layer === 'fidel') return [];
    return layerKeys.map(k => ({ label: k, value: k }));
  }, [layer]);

  const functionKeys = useMemo(() => FUNCTION_KEYS[layer], [layer]);

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
    const editor = document.getElementById('editor') as HTMLElement | null;
    switch (key) {
      case 'backspace': {
        if (editor) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            if (range.collapsed && range.startOffset > 0) {
              range.setStart(range.startContainer, range.startOffset - 1);
              range.deleteContents();
            } else if (!range.collapsed) {
              range.deleteContents();
            }
          }
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;
      }
      case 'layer':
        dispatch(nextLayer());
        break;
      case ' ':
        handleKeyClick(' ');
        break;
      case '\n': {
        if (editor) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const br = document.createElement('br');
            range.insertNode(br);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;
      }
    }
  }, [dispatch, handleKeyClick]);

  const handleFamilyClick = useCallback((family: string) => {
    const defaultChar = charFor(family, 'silent');
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

  const closeKeyboard = useCallback(() => {
    dispatch(setOpen(false));
  }, [dispatch]);

  if (deviceKeyboardMode) return null;

  return (
    <section id="keyboardPanel" className="keyboard-panel open">
      <div ref={grabRef} className="keyboard-grab" aria-hidden="true" />
      
      <div id="keyboardSuggestions" className="keyboard-suggest-row">
        <span className="keyboard-suggest-label">Suggestions</span>
        {suggestions.length > 0 ? (
          suggestions.map((s, i) => (
            <button key={i} className="suggestion" onClick={() => handleKeyClick(s)}>
              {s}
            </button>
          ))
        ) : (
          <span className="empty">Type to see dictionary words</span>
        )}
      </div>

      <div id="keyboard" className="keyboard">
        {layer === 'fidel' ? (
          <>
            <div className="keys">
              {fidelKeys.slice(0, 10).map((k, i) => (
                <FidelKey
                  key={i}
                  family={k.family}
                  orders={k.orders}
                  onSelect={handleKeyClick}
                />
              ))}
            </div>
            <div className="keys">
              {fidelKeys.slice(10, 20).map((k, i) => (
                <FidelKey
                  key={i + 10}
                  family={k.family}
                  orders={k.orders}
                  onSelect={handleKeyClick}
                />
              ))}
            </div>
            <div className="keys">
              {fidelKeys.slice(20).map((k, i) => (
                <FidelKey
                  key={i + 20}
                  family={k.family}
                  orders={k.orders}
                  onSelect={handleKeyClick}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="keys">
              {otherKeys.slice(0, 6).map((k, i) => (
                <button key={i} className="key" onClick={() => handleKeyClick(k.value)}>{k.label}</button>
              ))}
            </div>
            <div className="keys">
              {otherKeys.slice(6, 12).map((k, i) => (
                <button key={i + 6} className="key" onClick={() => handleKeyClick(k.value)}>{k.label}</button>
              ))}
            </div>
          </>
        )}

        <div className="keys action-row">
          {functionKeys.map((k, i) => (
            <button
              key={i}
              className={`key fn ${k.type}`}
              onClick={() => handleFunctionKey(k.value)}
              style={{ flex: k.type === 'space' ? '2.6' : k.type === 'enter' ? '1.3' : undefined }}
            >
              {k.label}
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
};

export default FidelKeyboard;
