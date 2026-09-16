import React, { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setSidebarWidth } from '../../store/uiSlice';

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;

export function ResizeHandle() {
  const dispatch = useDispatch<AppDispatch>();
  const { sidebarCollapsed, sidebarWidth } = useSelector((state: RootState) => state.ui);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const clamp = (value: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarCollapsed, sidebarWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    dispatch(setSidebarWidth(clamp(startWidthRef.current + (e.clientX - startXRef.current))));
  }, [dispatch]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  if (sidebarCollapsed) return null;

  return (
    <div
      className="sidebar-resize-handle"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => dispatch(setSidebarWidth(320))}
      aria-label="Resize sidebar"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          dispatch(setSidebarWidth(clamp(sidebarWidth + (e.key === 'ArrowLeft' ? -20 : 20))));
        }
      }}
    />
  );
}

export default ResizeHandle;
