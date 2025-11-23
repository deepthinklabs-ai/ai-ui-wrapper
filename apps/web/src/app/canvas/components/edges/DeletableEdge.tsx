'use client';

/**
 * Deletable Edge Component
 *
 * Custom edge that shows a delete button on selection
 */

import React from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  console.log('[DeletableEdge] Rendering edge:', { id, selected, labelX, labelY });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? '#3b82f6' : (style.stroke || '#64748b'),
        }}
      />
      <EdgeLabelRenderer>
        {selected && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="bg-red-500 text-white rounded px-2 py-1 text-xs font-bold shadow-lg border-2 border-white pointer-events-none">
              Press DELETE to remove connection
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
