import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Editor from './Editor';
import { PAPER_SIZES, DEFAULT_MARGINS } from '../../utils/constants';

interface DocumentPaperProps {
  zoom?: number;
}

export const DocumentPaper: React.FC<DocumentPaperProps> = ({ zoom = 1 }) => {
  const { font, size, align } = useSelector((state: RootState) => state.workspace);
  const paperSize = PAPER_SIZES.a4;
  const margins = DEFAULT_MARGINS;

  // Responsive: use full width on mobile, fixed width on desktop
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const paperWidth = isDesktop ? paperSize.w : '100%';
  const maxWidth = isDesktop ? paperSize.w : '100%';

  const paperStyle: React.CSSProperties = useMemo(
    () => ({
      width: paperWidth,
      maxWidth: isDesktop ? `calc(${paperWidth} - ${margins.left}px - ${margins.right}px)` : 'none',
      minHeight: isDesktop ? `${paperSize.h}px` : 'auto',
      background: 'var(--paper)',
      borderRadius: '3px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.08)',
      marginBottom: '40px',
      padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
      fontFamily: `"${font}", "Noto Sans Ethiopic", "Abyssinica SIL", Georgia, serif`,
      fontSize: typeof size === 'number' ? `${size}px` : size,
      textAlign: align,
      lineHeight: '1.6',
      color: 'var(--ink)',
      transform: `scale(${zoom})`,
      transformOrigin: 'top center',
      '@media (max-width: 768px)': {
        padding: '20px',
      },
    }),
    [font, size, align, zoom, paperSize, margins, isDesktop],
  );

  const wrapperStyle: React.CSSProperties = useMemo(
    () => ({
      minHeight: '100%',
      padding: '20px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#e8e8e8',
      overflow: 'auto',
      '@media (max-width: 768px)': {
        padding: '10px',
      },
    }),
    [],
  );

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
