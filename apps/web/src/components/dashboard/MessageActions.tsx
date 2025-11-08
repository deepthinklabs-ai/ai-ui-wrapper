/**
 * Message Actions Component
 *
 * Displays action buttons for version control on individual messages:
 * - Revert to this point (delete all messages after)
 * - Fork from this point (create new thread up to this message)
 */

"use client";

import React from "react";

type MessageActionsProps = {
  messageId: string;
  isLastMessage: boolean;
  isUserMessage: boolean;
  onRevert: (messageId: string) => void;
  onForkFrom: (messageId: string) => void;
  disabled?: boolean;
};

const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  isLastMessage,
  isUserMessage,
  onRevert,
  onForkFrom,
  disabled = false,
}) => {
  // Don't show revert button on the last message (nothing to revert)
  const showRevert = !isLastMessage;

  return (
    <div
      className={`flex gap-1.5 mb-1 ${
        isUserMessage ? "justify-end" : "justify-start"
      }`}
    >
      {/* Fork from this message */}
      <button
        onClick={() => onForkFrom(messageId)}
        disabled={disabled}
        className="rounded-md bg-purple-600/90 hover:bg-purple-500 px-2 py-1 text-[10px] font-medium text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        title="Fork thread from this message - create a new thread with messages up to this point"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        Fork
      </button>

      {/* Revert to this message */}
      {showRevert && (
        <button
          onClick={() => onRevert(messageId)}
          disabled={disabled}
          className="rounded-md bg-amber-600/90 hover:bg-amber-500 px-2 py-1 text-[10px] font-medium text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          title="Revert to this message - delete all messages after this point"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
          Revert
        </button>
      )}
    </div>
  );
};

export default MessageActions;
