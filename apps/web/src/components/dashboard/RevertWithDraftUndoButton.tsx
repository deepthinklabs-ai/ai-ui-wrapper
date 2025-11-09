/**
 * Revert With Draft Undo Button Component
 *
 * Displays an undo button after a revert+draft operation.
 * Allows users to restore deleted messages and clear the draft.
 */

"use client";

import React from "react";

type RevertWithDraftUndoButtonProps = {
  canUndo: boolean;
  undoInFlight: boolean;
  onUndo: () => void;
};

const RevertWithDraftUndoButton: React.FC<RevertWithDraftUndoButtonProps> = ({
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
        className="group flex items-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-300 shadow-md transition-all hover:bg-emerald-600/20 hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Undo the last revert+draft operation, restore deleted messages and clear draft"
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
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            transform="scale(-1, 1) translate(-24, 0)"
          />
        </svg>
        {undoInFlight ? 'Undoing Revert+Draft...' : 'Undo Revert+Draft'}
      </button>
    </div>
  );
};

export default RevertWithDraftUndoButton;
