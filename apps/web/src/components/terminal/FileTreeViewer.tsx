/**
 * File Tree Viewer Component
 *
 * Displays the project file structure in a collapsible tree view.
 */

"use client";

import React, { useState } from "react";
import type { FileNode } from "@/hooks/useFileSystemAccess";

type FileTreeViewerProps = {
  fileTree: FileNode | null;
  onClearDirectory: () => void;
};

function TreeNode({ node, level = 0 }: { node: FileNode; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren && (
          <span className="text-slate-500 text-xs">
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}

        {node.type === "directory" ? (
          <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}

        <span className="text-sm text-slate-200 font-mono">{node.name}</span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, index) => (
            <TreeNode key={`${child.path}-${index}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTreeViewer({ fileTree, onClearDirectory }: FileTreeViewerProps) {
  if (!fileTree) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-200">Project Files</h3>
        </div>
        <button
          onClick={onClearDirectory}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          title="Disconnect directory"
        >
          Disconnect
        </button>
      </div>

      {/* Tree */}
      <div className="max-h-96 overflow-y-auto">
        <TreeNode node={fileTree} />
      </div>

      {/* Footer info */}
      <div className="mt-3 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          Connected to: <span className="text-green-400 font-mono">{fileTree.name}</span>
        </p>
      </div>
    </div>
  );
}
