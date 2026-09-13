import { useEffect, useRef, useCallback } from 'react';

interface SwipeOptions {
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  threshold?: number;
}

export function useSwipeGesture(ref: React.RefObject<HTMLElement | null>, options: SwipeOptions) {
  const startY = useRef(0);
  const startX = useRef(0);
  const { onSwipeDown, onSwipeUp, threshold = 60 } = options;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - startY.current;
    const deltaX = Math.abs(e.changedTouches[0].clientX - startX.current);

    if (deltaX > Math.abs(deltaY)) return;

    if (deltaY > threshold && onSwipeDown) {
      onSwipeDown();
    } else if (deltaY < -threshold && onSwipeUp) {
      onSwipeUp();
    }
  }, [onSwipeDown, onSwipeUp, threshold]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, handleTouchStart, handleTouchEnd]);
}
