/**
 * Revert With Draft Modal Component
 *
 * Shows options when reverting to a message with draft pre-population:
 * 1. Keep current model - Continue with your currently selected model
 * 2. Switch to original model - Use the model that was active when this message was sent
 *
 * After selection, reverts to the selected message and pre-populates the message composer
 * with the original AI response content as a draft.
 */

"use client";

import React from "react";
import type { AIModel } from "@/lib/apiKeyStorage";
import { AVAILABLE_MODELS } from "@/lib/apiKeyStorage";

type RevertWithDraftModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRevertWithCurrentModel: () => void;
  onRevertWithOriginalModel: () => void;
  currentModel: AIModel;
  originalModel: string | null;
  messagesCount: number;
};

const RevertWithDraftModal: React.FC<RevertWithDraftModalProps> = ({
  isOpen,
  onClose,
  onRevertWithCurrentModel,
  onRevertWithOriginalModel,
  currentModel,
  originalModel,
  messagesCount,
}) => {
  if (!isOpen) return null;

  // Get model info for display
  const currentModelInfo = AVAILABLE_MODELS.find((m) => m.value === currentModel);
  const originalModelInfo = originalModel
    ? AVAILABLE_MODELS.find((m) => m.value === originalModel)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Revert with Draft
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              This will delete {messagesCount} message{messagesCount !== 1 ? "s" : ""} after this point
              and pre-populate the message composer with the original AI response.
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-300">
              Choose which model to use for the draft:
            </p>

            {/* Option 1: Keep Current Model */}
            <button
              onClick={() => {
                onRevertWithCurrentModel();
                onClose();
              }}
              className="w-full rounded-lg border border-blue-500/30 bg-blue-600/10 px-4 py-4 text-left transition-all hover:bg-blue-600/20 hover:border-blue-500/50"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                  <svg
                    className="h-3 w-3 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-medium text-slate-100">
                    Use Current Model
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Draft with your currently selected model
                  </div>
                  {currentModelInfo && (
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        currentModelInfo.provider === "openai"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-orange-500/20 text-orange-300"
                      }`}>
                        {currentModelInfo.provider === "openai" ? "OpenAI" : "Claude"}
                      </span>
                      <span className="text-xs font-medium text-slate-300">
                        {currentModelInfo.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Option 2: Switch to Original Model */}
            {originalModelInfo ? (
              <button
                onClick={() => {
                  onRevertWithOriginalModel();
                  onClose();
                }}
                className="w-full rounded-lg border border-purple-500/30 bg-purple-600/10 px-4 py-4 text-left transition-all hover:bg-purple-600/20 hover:border-purple-500/50"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                    <svg
                      className="h-3 w-3 text-purple-400"
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
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 font-medium text-slate-100">
                      Use Original Model
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      Draft with the model that was active at this message
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        originalModelInfo.provider === "openai"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-orange-500/20 text-orange-300"
                      }`}>
                        {originalModelInfo.provider === "openai" ? "OpenAI" : "Claude"}
                      </span>
                      <span className="text-xs font-medium text-slate-300">
                        {originalModelInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-700">
                    <svg
                      className="h-3 w-3 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 text-sm text-slate-400">
                      Original model information not available
                    </div>
                    <div className="text-xs text-slate-500">
                      This message was sent before model tracking was enabled
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RevertWithDraftModal;
