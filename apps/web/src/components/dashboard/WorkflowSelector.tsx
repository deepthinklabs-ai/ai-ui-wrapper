/**
 * Canvas Selector Component
 *
 * Dropdown to select an exposed Canvas to route messages to.
 * When a canvas is selected, messages go through the canvas workflow instead of direct chat.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ExposedWorkflow } from "@/app/canvas/features/master-trigger/types";

type WorkflowSelectorProps = {
  workflows: ExposedWorkflow[];
  selectedWorkflow: ExposedWorkflow | null;
  onWorkflowChange: (workflow: ExposedWorkflow | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  workflows,
  selectedWorkflow,
  onWorkflowChange,
  isLoading = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleWorkflowSelect = (workflow: ExposedWorkflow | null) => {
    onWorkflowChange(workflow);
    setIsOpen(false);
  };

  // Always render when the component is called - visibility is controlled by parent via feature flag

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
          selectedWorkflow
            ? "border-lavender/50 bg-lavender/30 text-foreground hover:bg-lavender/40"
            : "border-foreground/30 bg-white/60 text-foreground hover:bg-white/80"
        } disabled:opacity-60`}
        title={selectedWorkflow ? `Canvas: ${selectedWorkflow.displayName}` : "Select a canvas"}
      >
        {/* Canvas Icon */}
        <span className={`flex h-4 w-4 items-center justify-center rounded text-[10px] ${
          selectedWorkflow
            ? "bg-lavender/50 text-purple-700"
            : "bg-foreground/10 text-foreground/60"
        }`}>
          {isLoading ? (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <span>C</span>
          )}
        </span>

        {/* Label */}
        <span className="font-medium max-w-[120px] truncate">
          {isLoading
            ? "Loading..."
            : selectedWorkflow
              ? selectedWorkflow.displayName
              : "Canvas"
          }
        </span>

        {/* Chevron */}
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-foreground/20 bg-white/90 backdrop-blur-md shadow-xl z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            {/* Default Chat Option */}
            <button
              onClick={() => handleWorkflowSelect(null)}
              className={`w-full rounded-md px-3 py-2 text-left transition-colors mb-2 ${
                !selectedWorkflow
                  ? "bg-white/60 border border-foreground/20"
                  : "hover:bg-white/60 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-foreground/10 text-foreground/60 text-xs">
                  D
                </span>
                <span className="text-xs font-medium text-foreground">
                  Default Chat
                </span>
                {!selectedWorkflow && (
                  <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] text-foreground/60">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[10px] text-foreground/50 leading-tight pl-7">
                Standard chat - messages sent directly to AI
              </div>
            </button>

            {/* Divider */}
            {workflows.length > 0 && (
              <div className="border-t border-foreground/10 my-2" />
            )}

            {/* Canvases Header */}
            {workflows.length > 0 && (
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                Connected Canvases ({workflows.length})
              </div>
            )}

            {/* Canvas Options */}
            <div className="space-y-1">
              {workflows.map((workflow) => (
                <button
                  key={`${workflow.canvasId}-${workflow.triggerNodeId}`}
                  onClick={() => handleWorkflowSelect(workflow)}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    selectedWorkflow?.triggerNodeId === workflow.triggerNodeId
                      ? "bg-lavender/30 border border-lavender/50"
                      : "hover:bg-white/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-lavender/30 text-purple-700 text-xs">
                      C
                    </span>
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {workflow.displayName}
                    </span>
                    {selectedWorkflow?.triggerNodeId === workflow.triggerNodeId && (
                      <span className="rounded-full bg-lavender/30 px-1.5 py-0.5 text-[9px] text-purple-700">
                        Active
                      </span>
                    )}
                  </div>
                  {workflow.description && (
                    <div className="text-[10px] text-foreground/50 leading-tight pl-7 truncate">
                      {workflow.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 pl-7 text-[9px] text-foreground/40">
                    <span>Canvas: {workflow.canvasName}</span>
                    {workflow.triggerCount !== undefined && workflow.triggerCount > 0 && (
                      <span>Used {workflow.triggerCount}x</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Empty State */}
            {workflows.length === 0 && !isLoading && (
              <div className="text-center py-4 text-xs text-foreground/50">
                No canvases available.
                <br />
                <span className="text-[10px]">
                  Enable Master Trigger nodes in your canvases to use them here.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowSelector;
