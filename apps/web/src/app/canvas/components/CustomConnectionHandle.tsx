'use client';

/**
 * Custom Connection Handle
 *
 * Provides drag-and-drop connection handles for modals that are outside
 * the React Flow context. Visually mimics React Flow handles (green/blue bubbles)
 * and uses the React Flow connection API to create edges.
 */

import React, { useRef, useState, useEffect } from 'react';
import type { NodeId } from '../types';

interface CustomConnectionHandleProps {
  nodeId: NodeId;
  type: 'input' | 'output';
  position: 'left' | 'right';
  onStartConnection?: () => void;
  onEndConnection?: (targetNodeId: NodeId | null) => void;
}

export default function CustomConnectionHandle({
  nodeId,
  type,
  position,
  onStartConnection,
  onEndConnection,
}: CustomConnectionHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [connectionLine, setConnectionLine] = useState<{ x: number; y: number } | null>(null);

  const isInput = type === 'input';
  const isOutput = type === 'output';

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('[CustomConnectionHandle] Mouse down on handle', { nodeId, type });
    e.stopPropagation();
    e.preventDefault();

    setIsDragging(true);
    onStartConnection?.();

    // Track mouse position for connection line
    const updatePosition = (moveEvent: MouseEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      setConnectionLine({ x: moveEvent.clientX, y: moveEvent.clientY });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      console.log('[CustomConnectionHandle] Mouse up', { x: upEvent.clientX, y: upEvent.clientY });
      upEvent.stopPropagation();
      upEvent.preventDefault();

      // IMPORTANT: Clear dragging state first to hide connection line
      // This ensures elementsFromPoint can see through to canvas nodes
      setIsDragging(false);
      setConnectionLine(null);

      // Small delay to ensure React has rendered the state change
      setTimeout(() => {
        // Check if mouse is over a valid target node
        const elements = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
        console.log('[CustomConnectionHandle] Elements at drop point:', elements.length, 'elements');
        console.log('[CustomConnectionHandle] First 10 elements:', Array.from(elements).slice(0, 10).map(el => ({
          tag: el.tagName,
          className: el.className,
          nodeId: el.getAttribute('data-node-id'),
          handleType: el.getAttribute('data-handle-type'),
        })));

        // Look for any element with data-node-id attribute
        let targetNodeId: NodeId | null = null;
        for (const element of elements) {
          const nodeIdAttr = element.getAttribute('data-node-id');
          if (nodeIdAttr && nodeIdAttr !== nodeId) {
            targetNodeId = nodeIdAttr as NodeId;
            console.log('[CustomConnectionHandle] Found target node:', targetNodeId);
            break;
          }
        }

        if (!targetNodeId) {
          console.warn('[CustomConnectionHandle] No target node found - elements checked:', elements.length);
        }

        console.log('[CustomConnectionHandle] Calling onEndConnection with:', targetNodeId);
        onEndConnection?.(targetNodeId);
      }, 10);

      document.removeEventListener('mousemove', updatePosition);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', updatePosition, { capture: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });
  };

  return (
    <>
      {/* Connection Handle */}
      <div
        ref={handleRef}
        data-node-id={nodeId}
        data-handle-type={type}
        onMouseDown={handleMouseDown}
        onClickCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        className={`
          absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-slate-900
          cursor-crosshair transition-transform hover:scale-125 z-[200]
          ${position === 'left' ? 'left-[-12px]' : 'right-[-12px]'}
          ${isInput ? 'bg-green-500' : 'bg-blue-500'}
          ${isDragging ? 'scale-150 ring-2 ring-white/50' : ''}
        `}
        style={{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}
        title={isInput ? 'Input (drag to connect from another node)' : 'Output (drag to connect to another node)'}
      />

      {/* Connection Line Preview */}
      {isDragging && connectionLine && handleRef.current && (
        <svg
          className="fixed inset-0 pointer-events-none z-[150]"
          style={{ width: '100vw', height: '100vh' }}
        >
          <line
            x1={handleRef.current.getBoundingClientRect().left + 12}
            y1={handleRef.current.getBoundingClientRect().top + 12}
            x2={connectionLine.x}
            y2={connectionLine.y}
            stroke={isInput ? '#10b981' : '#3b82f6'}
            strokeWidth="3"
            strokeDasharray="5,5"
            opacity="0.8"
          />
        </svg>
      )}
    </>
  );
}
