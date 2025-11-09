/**
 * Revert Undo Button Component
 *
 * Displays an undo button after a revert operation.
 * Allows users to restore deleted messages and return to the previous state.
 */

"use client";

import React from "react";

type RevertUndoButtonProps = {
  canUndo: boolean;
  undoInFlight: boolean;
  onUndo: () => void;
};

const RevertUndoButton: React.FC<RevertUndoButtonProps> = ({
  canUndo,
  undoInFlight,
  onUndo,
}) => {
  if (!canUndo) {
    return null;
  }

  return (
    <div className="flex justify-center py-2">
      <button
        onClick={onUndo}
        disabled={undoInFlight}
        className="group flex items-center gap-2 rounded-lg border border-amber-600/50 bg-amber-600/10 px-4 py-2 text-sm font-medium text-amber-300 shadow-md transition-all hover:bg-amber-600/20 hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Undo the last revert operation and restore deleted messages"
      >
        <svg
          className={`h-4 w-4 ${undoInFlight ? 'animate-spin' : 'group-hover:-rotate-45 transition-transform'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            transform="scale(-1, 1) translate(-24, 0)"
          />
        </svg>
        {undoInFlight ? 'Undoing Revert...' : 'Undo Revert'}
      </button>
    </div>
  );
};

export default RevertUndoButton;
