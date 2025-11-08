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

    setSelection({
      text: selectedText,
      x: rect.left + rect.width / 2, // Center of selection
      y: rect.top - 10, // Slightly above selection
    });
  }, [containerRef]);

  useEffect(() => {
    // Listen for selection changes
    document.addEventListener("selectionchange", handleSelectionChange);

    // Also listen for mouseup to catch selections
    document.addEventListener("mouseup", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, clearSelection };
}
