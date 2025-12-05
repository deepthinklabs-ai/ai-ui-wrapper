/**
 * Resizable Sidebar Hook
 *
 * Manages sidebar width with drag-to-resize functionality.
 * Persists width to localStorage for user preference.
 * Uses CSS variables and requestAnimationFrame for smooth performance.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "sidebar_width";
const CSS_VAR_NAME = "--sidebar-width";
const DEFAULT_WIDTH = 256; // 16rem = 256px (w-64)
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

type UseResizableSidebarResult = {
  width: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  sidebarStyle: React.CSSProperties;
};

export function useResizableSidebar(): UseResizableSidebarResult {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const currentWidthRef = useRef(DEFAULT_WIDTH);

  // Load saved width from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsedWidth = parseInt(saved, 10);
      if (!isNaN(parsedWidth) && parsedWidth >= MIN_WIDTH && parsedWidth <= MAX_WIDTH) {
        setWidth(parsedWidth);
        currentWidthRef.current = parsedWidth;
        // Set CSS variable immediately
        document.documentElement.style.setProperty(CSS_VAR_NAME, `${parsedWidth}px`);
      }
    }
  }, []);

  // Save width to localStorage when it changes (debounced by only saving on mouseup)
  const saveWidth = useCallback((w: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(w));
  }, []);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidthRef.current;
    setIsResizing(true);
  }, []);

  // Handle mouse move during resize - uses RAF for smooth updates
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Schedule update on next animation frame
      rafRef.current = requestAnimationFrame(() => {
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));

        // Update CSS variable directly for smooth visual update (bypasses React)
        document.documentElement.style.setProperty(CSS_VAR_NAME, `${newWidth}px`);
        currentWidthRef.current = newWidth;
      });
    };

    const handleMouseUp = () => {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Sync React state with final width
      setWidth(currentWidthRef.current);
      saveWidth(currentWidthRef.current);
      setIsResizing(false);
    };

    // Add listeners to document to capture mouse events outside the handle
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);

    // Add styles to body to prevent text selection during resize
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    // Prevent pointer events on iframes during drag
    document.body.style.pointerEvents = "none";
    // Re-enable pointer events on the resize handle
    const style = document.createElement("style");
    style.textContent = `* { pointer-events: auto !important; }`;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.pointerEvents = "";
      style.remove();

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isResizing, saveWidth]);

  // Style object that uses CSS variable for smooth updates during drag
  const sidebarStyle: React.CSSProperties = {
    width: isResizing ? `var(${CSS_VAR_NAME}, ${width}px)` : width,
    // GPU acceleration hints
    willChange: isResizing ? "width" : "auto",
    contain: "layout",
  };

  return {
    width,
    isResizing,
    handleMouseDown,
    sidebarStyle,
  };
}
