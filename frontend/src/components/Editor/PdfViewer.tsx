import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { closePdfViewer } from '../../store/uiSlice';

// Use CDN worker for reliable loading in all environments
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const PdfViewer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { pdfUrl, pdfFileName } = useSelector((state: RootState) => state.ui);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1.5);
  const renderingRef = useRef(false);

  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, container: HTMLDivElement) => {
    if (renderingRef.current) return;
    renderingRef.current = true;

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto 12px';

      await page.render({ canvasContext: context, viewport, canvas } as any).promise;
      container.appendChild(canvas);
    } finally {
      renderingRef.current = false;
    }
  }, [scale]);

  useEffect(() => {
    if (!pdfUrl || !containerRef.current) return;

    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError('');
      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = '';

      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        // Render all pages
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          await renderPage(pdf, i, container);
        }

        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl, renderPage]);

  if (!pdfUrl) return null;

  return (
    <div className="pdf-viewer-overlay">
      <div className="pdf-viewer-header">
        <div className="pdf-viewer-title">
          <span className="pdf-icon">📄</span>
          <span>{pdfFileName || 'PDF Document'}</span>
        </div>
        <div className="pdf-viewer-controls">
          <button
            className="pdf-ctrl-btn"
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            title="Zoom out"
          >−</button>
          <span className="pdf-zoom-label">{Math.round(scale * 100)}%</span>
          <button
            className="pdf-ctrl-btn"
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            title="Zoom in"
          >+</button>
          <button
            className="pdf-ctrl-btn"
            onClick={() => setScale(1.5)}
            title="Reset zoom"
          >↺</button>
          <button
            className="pdf-ctrl-btn pdf-close-btn"
            onClick={() => dispatch(closePdfViewer())}
            title="Close"
          >×</button>
        </div>
      </div>
      <div className="pdf-viewer-body" ref={containerRef}>
        {loading && <div className="pdf-loading">Loading PDF...</div>}
        {error && <div className="pdf-error">{error}</div>}
      </div>
    </div>
  );
};

export default PdfViewer;
