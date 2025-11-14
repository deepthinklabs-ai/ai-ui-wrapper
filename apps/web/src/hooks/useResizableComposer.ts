/**
 * useResizableComposer Hook
 *
 * Provides drag-to-resize functionality for the message composer.
 * Allows users to click and drag to adjust the height of the textarea.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

type UseResizableComposerOptions = {
  minHeight?: number; // Minimum height in pixels
  maxHeight?: number; // Maximum height in pixels
  initialHeight?: number; // Initial height in pixels
};

export function useResizableComposer({
  minHeight = 80, // Default minimum (matches current 2-row textarea)
  maxHeight = 600, // Maximum height
  initialHeight = 80, // Start at minimum
}: UseResizableComposerOptions = {}) {
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
  }, [height]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    // Calculate the delta (negative because dragging up should increase height)
    const deltaY = dragStartY.current - e.clientY;
    const newHeight = dragStartHeight.current + deltaY;

    // Clamp between min and max
    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    setHeight(clampedHeight);
  }, [isDragging, minHeight, maxHeight]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);

      // Change cursor globally while dragging
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  return {
    height,
    isDragging,
    handleDragStart,
  };
}
