/**
 * Text Selection Hook
 *
 * Detects when user selects text within a specific container and provides
 * the selected text along with position information for displaying a popup.
 */

import { useState, useEffect, useCallback, RefObject } from "react";

type SelectionInfo = {
  text: string;
  x: number;
  y: number;
};

export function useTextSelection(containerRef: RefObject<HTMLElement>) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  const handleSelectionChange = useCallback(() => {
    const selectedText = window.getSelection()?.toString().trim();

    if (!selectedText || !containerRef.current) {
      setSelection(null);
      return;
    }

    // Check if the selection is within our container
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef.current;

    // Verify the selection is within our target container
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    // Get the bounding rectangle of the selection
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate position, but clamp to visible container bounds
    let x = rect.left + rect.width / 2; // Center of selection
    let y = rect.top - 10; // Slightly above selection

    // Clamp Y position to stay within the visible container
    const minY = containerRect.top + 50; // Stay at least 50px from top of container
    const maxY = containerRect.bottom - 100; // Stay at least 100px from bottom

    if (y < minY) {
      y = minY;
    } else if (y > maxY) {
      y = maxY;
    }

    // Clamp X position to stay within viewport
    const minX = 100; // Stay at least 100px from left edge
    const maxX = window.innerWidth - 100; // Stay at least 100px from right edge

    if (x < minX) {
      x = minX;
    } else if (x > maxX) {
      x = maxX;
    }

    setSelection({
      text: selectedText,
      x,
      y,
    });
  }, [containerRef]);

  useEffect(() => {
    // Listen for selection changes
    document.addEventListener("selectionchange", handleSelectionChange);

    // Also listen for mouseup to catch selections
    document.addEventListener("mouseup", handleSelectionChange);

    // Update popup position on scroll (keep it visible and in bounds)
    // This allows users to continue highlighting while scrolling
    const handleScroll = () => {
      // Re-calculate position immediately to keep popup visible and in bounds
      handleSelectionChange();
    };

    // Listen for scroll events on the container
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleSelectionChange);
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleSelectionChange, containerRef]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, clearSelection };
}
