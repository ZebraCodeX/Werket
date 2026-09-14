import React, { useCallback, useRef, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { setSidebarWidth } from '../../store/uiSlice';

export function ResizeHandle() {
  const dispatch = useDispatch<AppDispatch>();
  const { sidebarCollapsed, sidebarWidth } = useSelector((state: RootState) => state.ui);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleMouseUpRef = useRef<(() => void) | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const newWidth = Math.max(240, Math.min(600, startWidthRef.current + deltaX));
    dispatch(setSidebarWidth(newWidth));
  }, [dispatch]);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (handleMouseMoveRef.current) {
      document.removeEventListener('mousemove', handleMouseMoveRef.current);
    }
    if (handleMouseUpRef.current) {
      document.removeEventListener('mouseup', handleMouseUpRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;
  }, [handleMouseMove, handleMouseUp]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarCollapsed, sidebarWidth, handleMouseMove, handleMouseUp]);

  if (sidebarCollapsed) return null;

  return (
    <div
      className="sidebar-resize-handle"
      onMouseDown={handleMouseDown}
      aria-label="Resize sidebar"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const delta = e.key === 'ArrowLeft' ? -20 : 20;
          const newWidth = Math.max(240, Math.min(600, sidebarWidth + delta));
          dispatch(setSidebarWidth(newWidth));
        }
      }}
    />
  );
}

export default ResizeHandle;