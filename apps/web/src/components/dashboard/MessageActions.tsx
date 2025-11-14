/**
 * Message Actions Component
 *
 * Displays action buttons for version control on individual messages:
 * - Revert to this point (delete all messages after)
 * - Revert with Draft (delete messages after and pre-populate composer with AI response)
 * - Fork from this point (create new thread up to this message)
 */

"use client";

import React, { useState } from "react";
import RevertOptionsModal from "./RevertOptionsModal";
import RevertWithDraftModal from "./RevertWithDraftModal";
import type { AIModel } from "@/lib/apiKeyStorage";
import type { FeatureId } from "@/types/features";

type MessageActionsProps = {
  messageId: string;
  messageModel: string | null;
  isLastMessage: boolean;
  isUserMessage: boolean;
  currentModel: AIModel;
  messagesAfterCount: number;
  onRevert: (messageId: string, switchToOriginalModel: boolean) => void;
  onRevertWithDraft: (messageId: string, switchToOriginalModel: boolean) => void;
  onForkFrom: (messageId: string) => void;
  hasAiResponseAfter: boolean;
  disabled?: boolean;
  isFeatureEnabled?: (featureId: FeatureId) => boolean;
};

const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  messageModel,
  isLastMessage,
  isUserMessage,
  currentModel,
  messagesAfterCount,
  onRevert,
  onRevertWithDraft,
  onForkFrom,
  hasAiResponseAfter,
  disabled = false,
  isFeatureEnabled,
}) => {
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showRevertWithDraftModal, setShowRevertWithDraftModal] = useState(false);

  // Check if features are enabled (defaults to true if not provided)
  const revertEnabled = isFeatureEnabled ? isFeatureEnabled('revert') : true;
  const revertWithDraftEnabled = isFeatureEnabled ? isFeatureEnabled('revert_with_draft') : true;
  const forkEnabled = isFeatureEnabled ? isFeatureEnabled('fork_thread') : true;

  // Only show revert button on AI messages (not on last message, not on user messages) AND if feature is enabled
  const showRevert = revertEnabled && !isUserMessage && !isLastMessage;

  // Show "Revert with Draft" on AI messages only when there are messages after it AND if feature is enabled
  const showRevertWithDraft = revertWithDraftEnabled && !isUserMessage && !isLastMessage && messagesAfterCount > 0;

  // Only show fork button on AI messages (not on user messages) AND if feature is enabled
  const showFork = forkEnabled && !isUserMessage;

  const handleRevertClick = () => {
    setShowRevertModal(true);
  };

  const handleRevertWithDraftClick = () => {
    setShowRevertWithDraftModal(true);
  };

  const handleRevertWithCurrentModel = () => {
    onRevert(messageId, false);
  };

  const handleRevertWithOriginalModel = () => {
    onRevert(messageId, true);
  };

  const handleRevertWithDraftCurrentModel = () => {
    onRevertWithDraft(messageId, false);
  };

  const handleRevertWithDraftOriginalModel = () => {
    onRevertWithDraft(messageId, true);
  };

  return (
    <>
      <div
        className={`flex gap-1.5 mb-1 ${
          isUserMessage ? "justify-end" : "justify-start"
        }`}
      >
        {/* Fork from this message - only show on AI messages */}
        {showFork && (
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
        )}

        {/* Revert to this message */}
        {showRevert && (
          <button
            onClick={handleRevertClick}
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

        {/* Revert with Draft - only show on user messages with AI responses after */}
        {showRevertWithDraft && (
          <button
            onClick={handleRevertWithDraftClick}
            disabled={disabled}
            className="rounded-md bg-emerald-600/90 hover:bg-emerald-500 px-2 py-1 text-[10px] font-medium text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            title="Revert and pre-populate message composer with the AI response as a draft"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Revert + Draft
          </button>
        )}
      </div>

      {/* Revert Options Modal */}
      <RevertOptionsModal
        isOpen={showRevertModal}
        onClose={() => setShowRevertModal(false)}
        onRevertWithCurrentModel={handleRevertWithCurrentModel}
        onRevertWithOriginalModel={handleRevertWithOriginalModel}
        currentModel={currentModel}
        originalModel={messageModel}
        messagesCount={messagesAfterCount}
      />

      {/* Revert With Draft Options Modal */}
      <RevertWithDraftModal
        isOpen={showRevertWithDraftModal}
        onClose={() => setShowRevertWithDraftModal(false)}
        onRevertWithCurrentModel={handleRevertWithDraftCurrentModel}
        onRevertWithOriginalModel={handleRevertWithDraftOriginalModel}
        currentModel={currentModel}
        originalModel={messageModel}
        messagesCount={messagesAfterCount}
      />
    </>
  );
};

export default MessageActions;
