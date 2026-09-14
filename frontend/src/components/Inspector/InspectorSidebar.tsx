import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setInspectorOpen, setInspectorTab } from '../../store/uiSlice';
import { PARAGRAPH_STYLES } from '../../utils/constants';

export const InspectorSidebar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { inspectorOpen, inspectorTab } = useSelector((state: RootState) => state.ui);

  if (!inspectorOpen) return null;

  return (
    <aside id="inspectorSidebar" className="inspector-sidebar">
      <div className="inspector-header">
        <div className="inspector-tabs">
          <button
            className={`inspector-tab ${inspectorTab === 'style' ? 'active' : ''}`}
            onClick={() => dispatch(setInspectorTab('style'))}
          >
            Style
          </button>
          <button
            className={`inspector-tab ${inspectorTab === 'text' ? 'active' : ''}`}
            onClick={() => dispatch(setInspectorTab('text'))}
          >
            Text
          </button>
          <button
            className={`inspector-tab ${inspectorTab === 'layout' ? 'active' : ''}`}
            onClick={() => dispatch(setInspectorTab('layout'))}
          >
            Layout
          </button>
        </div>
        <button id="closeInspector" className="inspector-close" onClick={() => dispatch(setInspectorOpen(false))}>×</button>
      </div>
      <div className="inspector-content">
        {inspectorTab === 'style' && (
          <div id="inspectorStyle" className="inspector-panel">
            <div className="inspector-section">
              <label>Paragraph Style</label>
              <select className="inspector-select" value="" onChange={e => document.execCommand('formatBlock', false, e.target.value)}>
                {PARAGRAPH_STYLES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="inspector-section">
              <label>Character Style</label>
              <select className="inspector-select">
                <option value="none">None</option>
                <option value="emphasis">Emphasis</option>
                <option value="strong">Strong</option>
                <option value="link">Link</option>
              </select>
            </div>
            <div className="inspector-section">
              <label>List Style</label>
              <select className="inspector-select">
                <option value="none">None</option>
                <option value="bullet">Bullet</option>
                <option value="number">Numbered</option>
                <option value="letter">Lettered</option>
                <option value="roman">Roman</option>
              </select>
            </div>
          </div>
        )}
        {inspectorTab === 'text' && (
          <div id="inspectorText" className="inspector-panel">
            <div className="inspector-row">
              <div>
                <label>Color</label>
                <input type="color" className="inspector-color" />
              </div>
            </div>
            <div className="inspector-row">
              <div>
                <label>Line Spacing</label>
                <select className="inspector-select">
                  <option value="1">Single</option>
                  <option value="1.15">1.15</option>
                  <option value="1.5" selected>1.5</option>
                  <option value="2">Double</option>
                  <option value="2.5">2.5</option>
                  <option value="3">Triple</option>
                </select>
              </div>
              <div>
                <label>Paragraph Spacing</label>
                <select className="inspector-select">
                  <option value="0">None</option>
                  <option value="6">6 pt</option>
                  <option value="12" selected>12 pt</option>
                  <option value="18">18 pt</option>
                  <option value="24">24 pt</option>
                </select>
              </div>
            </div>
            <div className="inspector-section">
              <label>Text Effects</label>
              <div className="inspector-toggles">
                <label className="switch-label"><input type="checkbox" id="inspectorBold"/><span>Bold</span></label>
                <label className="switch-label"><input type="checkbox" id="inspectorItalic"/><span>Italic</span></label>
                <label className="switch-label"><input type="checkbox" id="inspectorUnderline"/><span>Underline</span></label>
                <label className="switch-label"><input type="checkbox" id="inspectorStrike"/><span>Strikethrough</span></label>
              </div>
            </div>
          </div>
        )}
        {inspectorTab === 'layout' && (
          <div id="inspectorLayout" className="inspector-panel">
            <div className="inspector-section">
              <label>Paper Size</label>
              <select className="inspector-select">
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
                <option value="legal">US Legal (8.5 × 14 in)</option>
                <option value="a5">A5 (148 × 210 mm)</option>
                <option value="a3">A3 (297 × 420 mm)</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
            <div className="inspector-row">
              <div><label>Width (mm)</label><input type="number" className="inspector-input" min="50" max="1000" step="1"/></div>
              <div><label>Height (mm)</label><input type="number" className="inspector-input" min="50" max="1000" step="1"/></div>
            </div>
            <div className="inspector-section">
              <label>Margins (mm)</label>
              <div className="inspector-row">
                <div><label>Top</label><input type="number" className="inspector-input" min="0" max="100" step="1"/></div>
                <div><label>Bottom</label><input type="number" className="inspector-input" min="0" max="100" step="1"/></div>
                <div><label>Left</label><input type="number" className="inspector-input" min="0" max="100" step="1"/></div>
                <div><label>Right</label><input type="number" className="inspector-input" min="0" max="100" step="1"/></div>
              </div>
            </div>
            <div className="inspector-section">
              <label>Header / Footer</label>
              <div className="inspector-toggles">
                <label className="switch-label"><input type="checkbox" id="inspectorHeader"/><span>Header</span></label>
                <label className="switch-label"><input type="checkbox" id="inspectorFooter"/><span>Footer</span></label>
                <label className="switch-label"><input type="checkbox" id="inspectorPageNumbers"/><span>Page Numbers</span></label>
              </div>
              <div className="inspector-row">
                <div><label>Header Height</label><input type="number" className="inspector-input" min="10" max="100" step="1"/></div>
                <div><label>Footer Height</label><input type="number" className="inspector-input" min="10" max="100" step="1"/></div>
              </div>
            </div>
            <div className="inspector-section">
              <label>Columns</label>
              <select className="inspector-select">
                <option value="1">1 Column</option>
                <option value="2">2 Columns</option>
                <option value="3">3 Columns</option>
              </select>
              <div className="inspector-row" style={{ marginTop: '8px' }}>
                <div><label>Column Gap</label><input type="number" className="inspector-input" min="0" max="50" step="1"/></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default InspectorSidebar;