import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Editor from './Editor';
import { PAPER_SIZES, DEFAULT_MARGINS } from '../../utils/constants';

interface DocumentPaperProps {
  zoom?: number;
}

export const DocumentPaper: React.FC<DocumentPaperProps> = ({ zoom = 1 }) => {
  const { activeId, files, font, size, align } = useSelector((state: RootState) => state.workspace);
  const { theme } = useSelector((state: RootState) => state.ui);
  const activeFile = files.find(f => f.id === activeId);
  const paperSize = PAPER_SIZES.a4; // Default to A4, can be made configurable
  const margins = DEFAULT_MARGINS;

  const paperStyle: React.CSSProperties = {
    width: `${paperSize.w}px`,
    minHeight: `${paperSize.h}px`,
    background: theme === 'dark' ? 'var(--paper)' : 'var(--paper)',
    borderRadius: '3px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.08)',
    marginBottom: '40px',
    padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
    fontFamily: activeFile ? `"${activeFile.font}", "Noto Sans Ethiopic", "Abyssinica SIL", Georgia, serif` : 'inherit',
    fontSize: activeFile ? `${activeFile.size}px` : '18px',
    textAlign: activeFile ? activeFile.align : 'left',
    lineHeight: '1.6',
    color: 'var(--ink)',
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
  };

  const wrapperStyle: React.CSSProperties = {
    minHeight: '100%',
    padding: '40px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#e8e8e8',
    overflow: 'auto',
  };

  return (
    <div className="document-stage" style={wrapperStyle}>
      <div className="document-paper-wrapper">
        <div className="document-paper" style={paperStyle}>
          <Editor />
        </div>
      </div>
    </div>
  );
};

export default DocumentPaper;