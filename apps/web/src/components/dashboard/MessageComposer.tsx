"use client";

import React, { KeyboardEvent, useRef, useCallback, useEffect } from "react";
import TextConversionButtons from "./TextConversionButtons";
import ModelDropdown from "./ModelDropdown";
import WorkflowSelector from "./WorkflowSelector";
import StepByStepToggle from "./StepByStepToggle";
import MicrophoneButton from "./MicrophoneButton";
import { ChatbotSelector } from "@/app/chatbots/components";
import type { AIModel } from "@/lib/apiKeyStorage";
import type { ExposedWorkflow } from "@/app/canvas/features/master-trigger/types";
import type { FeatureId } from "@/types/features";
import type { Chatbot } from "@/types/chatbot";
import { getFileUploadWarning } from "@/lib/modelCapabilities";
import { useResizableComposer } from "@/hooks/useResizableComposer";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useVoiceActivityDetection } from "@/hooks/useVoiceActivityDetection";
import { useAutoSendDetection } from "@/hooks/useAutoSendDetection";
import { usePushToTalk } from "@/hooks/usePushToTalk";

type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  selectedModel?: AIModel;
  onModelChange?: (model: AIModel) => void;
  onSummarize?: () => void;
  onSummarizeAndContinue?: () => void;
  onFork?: () => void;
  canSummarize?: boolean;
  summarizing?: boolean;
  summarizingAndContinuing?: boolean;
  forking?: boolean;
  attachedFiles?: File[];
  onFilesChange?: (files: File[]) => void;
  onConvertToMarkdown?: () => void;
  onConvertToJson?: () => void;
  convertingToMarkdown?: boolean;
  convertingToJson?: boolean;
  // Step-by-step mode props
  isStepByStepWithExplanation?: boolean;
  isStepByStepNoExplanation?: boolean;
  onToggleStepByStepWithExplanation?: () => void;
  onToggleStepByStepNoExplanation?: () => void;
  // Web search toggle
  enableWebSearch?: boolean;
  onToggleWebSearch?: () => void;
  userTier?: "trial" | "pro" | "expired" | "pending";
  isFeatureEnabled?: (featureId: FeatureId) => boolean;
  // Workflow selection props
  workflows?: ExposedWorkflow[];
  selectedWorkflow?: ExposedWorkflow | null;
  onWorkflowChange?: (workflow: ExposedWorkflow | null) => void;
  workflowsLoading?: boolean;
  workflowExecuting?: boolean;
  // Chatbot selection props
  chatbots?: Chatbot[];
  selectedChatbot?: Chatbot | null;
  onChatbotChange?: (chatbot: Chatbot | null) => void;
  chatbotsLoading?: boolean;
};

const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  selectedModel,
  onModelChange,
  onSummarize,
  onSummarizeAndContinue,
  onFork,
  canSummarize = false,
  summarizing = false,
  summarizingAndContinuing = false,
  forking = false,
  attachedFiles = [],
  onFilesChange,
  onConvertToMarkdown,
  onConvertToJson,
  convertingToMarkdown = false,
  convertingToJson = false,
  isStepByStepWithExplanation = false,
  isStepByStepNoExplanation = false,
  onToggleStepByStepWithExplanation,
  onToggleStepByStepNoExplanation,
  enableWebSearch = true,
  onToggleWebSearch,
  userTier,
  isFeatureEnabled,
  workflows = [],
  selectedWorkflow = null,
  onWorkflowChange,
  workflowsLoading = false,
  workflowExecuting = false,
  // Chatbot selection props
  chatbots = [],
  selectedChatbot = null,
  onChatbotChange,
  chatbotsLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if voice input feature is enabled (defaults to true if not provided)
  const voiceInputEnabled = isFeatureEnabled ? isFeatureEnabled('voice_input') : true;
  // Check if auto voice detection feature is enabled (defaults to false if not provided)
  const autoVoiceDetectionEnabled = isFeatureEnabled ? isFeatureEnabled('auto_voice_detection') : false;
  // Check if file attachments feature is enabled (defaults to true if not provided)
  const fileAttachmentsEnabled = isFeatureEnabled ? isFeatureEnabled('file_attachments') : true;
  // Check if model selection feature is enabled (defaults to true if not provided)
  const modelSelectionEnabled = isFeatureEnabled ? isFeatureEnabled('model_selection') : true;
  // Check if canvas selector feature is enabled (defaults to true if not provided)
  const canvasSelectorEnabled = isFeatureEnabled ? isFeatureEnabled('canvas_selector') : true;
  // Check if step-by-step mode feature is enabled (defaults to true if not provided)
  const stepByStepModeEnabled = isFeatureEnabled ? isFeatureEnabled('step_by_step_mode') : true;
  // Check if text conversion features are enabled (defaults to true if not provided)
  const convertToMarkdownEnabled = isFeatureEnabled ? isFeatureEnabled('convert_to_markdown') : true;
  const convertToJsonEnabled = isFeatureEnabled ? isFeatureEnabled('convert_to_json') : true;
  // Check if thread operation features are enabled (defaults to true if not provided)
  const summarizeThreadEnabled = isFeatureEnabled ? isFeatureEnabled('summarize_thread') : true;
  const summarizeAndContinueEnabled = isFeatureEnabled ? isFeatureEnabled('summarize_and_continue') : true;
  const forkThreadEnabled = isFeatureEnabled ? isFeatureEnabled('fork_thread') : true;

  // Resizable composer functionality
  const { height, isDragging, handleDragStart } = useResizableComposer({
    minHeight: 80, // Matches current 2-row textarea
    maxHeight: 600,
    initialHeight: 80,
  });

  // Speech recognition functionality
  // Use a ref to track the value so we don't recreate the callback on every render
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleTranscript = useCallback((text: string) => {
    // Append transcribed text to current value using the ref
    const currentValue = valueRef.current;
    const newValue = currentValue ? `${currentValue} ${text}` : text;
    onChange(newValue);
  }, [onChange]);

  const {
    isListening,
    isSupported,
    error: speechError,
    toggleListening,
    transcript,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onTranscript: handleTranscript,
    continuous: true,
    interimResults: true,
  });

  // Push-to-Talk functionality
  const { isPushing, isEnabled: isPushToTalkEnabled } = usePushToTalk({
    onPushStart: () => {
      console.log('[Push-to-Talk] Key pressed - starting voice input');
      if (!isListening && voiceInputEnabled) {
        startListening();
      }
    },
    onPushEnd: () => {
      console.log('[Push-to-Talk] Key released - stopping voice input');
      if (isListening) {
        stopListening();
      }
    },
    disabled: !voiceInputEnabled || autoVoiceDetectionEnabled, // Disable PTT when voice input is off or auto-detection is on
  });

  // Voice Activity Detection - automatically start/stop microphone
  const { isSpeaking: vadIsSpeaking } = useVoiceActivityDetection({
    enabled: autoVoiceDetectionEnabled && !isListening && !isPushToTalkEnabled, // Disabled when PTT is enabled
    onSpeakingStart: () => {
      console.log('[Auto Voice] User started speaking - activating microphone');
      if (!isListening) {
        startListening();
      }
    },
    onSpeakingStop: () => {
      console.log('[Auto Voice] User stopped speaking');
      // Don't stop listening here - let auto-send detection handle it
    },
  });

  // Auto-send detection - detect "send" command
  useAutoSendDetection({
    enabled: autoVoiceDetectionEnabled && isListening,
    transcript: transcript || '',
    onSendDetected: () => {
      console.log('[Auto Voice] Send command detected - submitting message');

      // Remove the "send" trigger word from the message
      const triggerWords = ['send', 'submit', 'send it', 'submit it'];
      let cleanedValue = value;

      triggerWords.forEach(word => {
        const regex = new RegExp(`\\s*${word}[.!?]?\\s*$`, 'i');
        cleanedValue = cleanedValue.replace(regex, '').trim();
      });

      // Update the value without the trigger word
      if (cleanedValue !== value) {
        onChange(cleanedValue);
      }

      // Stop listening
      stopListening();

      // Send the message after a brief delay to let the value update
      setTimeout(() => {
        if (cleanedValue.trim() || attachedFiles.length > 0) {
          onSend();
        }
      }, 100);
    },
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || attachedFiles.length > 0)) {
        onSend();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFilesChange) {
      const newFiles = Array.from(e.target.files);
      onFilesChange([...attachedFiles, ...newFiles]);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    if (onFilesChange) {
      const newFiles = attachedFiles.filter((_, i) => i !== index);
      onFilesChange(newFiles);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Check if current model supports the attached files
  const fileWarning = selectedModel ? getFileUploadWarning(selectedModel, attachedFiles) : null;

  return (
    <div className="border-t border-white/30 bg-white/40 backdrop-blur-md px-4 py-3">
      {/* File Upload Warning */}
      {fileWarning && (
        <div className="mb-3 rounded-md border border-amber-600 bg-amber-600/10 px-3 py-2 text-xs text-amber-400">
          <div className="flex items-start gap-2">
            <svg
              className="h-4 w-4 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{fileWarning}</span>
          </div>
        </div>
      )}

      {/* Attached Files Display */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md border border-white/40 bg-white/60 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                {file.type.startsWith("image/") ? (
                  <svg
                    className="h-4 w-4 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
                <div className="flex flex-col">
                  <span className="text-foreground font-medium">{file.name}</span>
                  <span className="text-foreground-secondary/60">{formatFileSize(file.size)}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFile(index)}
                className="ml-2 rounded-md p-1 text-foreground-secondary/40 hover:bg-white/40 hover:text-foreground"
                title="Remove file"
              >
                <svg
                  className="h-4 w-4"
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
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 flex flex-col gap-2">
          {/* Drag Handle Bar */}
          <div
            onMouseDown={handleDragStart}
            className={`group flex items-center justify-center h-2 cursor-ns-resize hover:bg-white/60 rounded-t transition-colors ${
              isDragging ? 'bg-white/80' : ''
            }`}
            title="Drag to resize"
          >
            {/* Visual indicator (three horizontal dots) */}
            <div className="flex gap-1 opacity-40 group-hover:opacity-70 transition-opacity">
              <div className="w-1 h-1 rounded-full bg-foreground/40"></div>
              <div className="w-1 h-1 rounded-full bg-foreground/40"></div>
              <div className="w-1 h-1 rounded-full bg-foreground/40"></div>
            </div>
          </div>

          <textarea
            className="resize-none rounded-md border border-white/40 bg-white/60 px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-1 focus:ring-secondary-sky shadow-inner"
            style={{ height: `${height}px` }}
            placeholder="Send a message… (Shift+Enter for new line)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          {/* Model Dropdown, File Upload, and Microphone Row */}
          <div className="flex items-center gap-2">
            {/* Chatbot Selector - show if chatbot change handler is provided */}
            {onChatbotChange && (
              <ChatbotSelector
                chatbots={chatbots}
                selectedChatbot={selectedChatbot}
                onSelectChatbot={onChatbotChange}
                loading={chatbotsLoading}
                disabled={disabled}
                compact
              />
            )}

            {/* Canvas Selector - show if canvas selector feature is enabled */}
            {canvasSelectorEnabled && onWorkflowChange && (
              <WorkflowSelector
                workflows={workflows}
                selectedWorkflow={selectedWorkflow}
                onWorkflowChange={onWorkflowChange}
                isLoading={workflowsLoading}
                disabled={disabled || workflowExecuting}
              />
            )}

            {/* Model Dropdown - only show if model selection is enabled */}
            {modelSelectionEnabled && selectedModel && onModelChange && (
              <ModelDropdown
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                disabled={disabled}
                userTier={userTier}
              />
            )}

            {/* File Upload Button - only show if file attachments are enabled */}
            {fileAttachmentsEnabled && onFilesChange && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.html,.css,.xml,.yaml,.yml"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="flex items-center gap-2 rounded-md border border-white/40 bg-white/60 px-3 py-1.5 text-xs text-foreground-secondary/70 hover:bg-white/80 disabled:opacity-60 transition-colors"
                  title="Attach files or images"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  Attach files
                </button>
              </div>
            )}

            {/* Microphone Button - only show if voice input is enabled */}
            {voiceInputEnabled && (
              <MicrophoneButton
                isListening={isListening}
                isSupported={isSupported}
                onClick={toggleListening}
                disabled={disabled || isPushToTalkEnabled}
                error={speechError}
                autoVoiceMode={autoVoiceDetectionEnabled}
                pushToTalkMode={isPushToTalkEnabled}
                isPushing={isPushing}
              />
            )}

            {/* Web Search Toggle */}
            {onToggleWebSearch && (
              <button
                onClick={onToggleWebSearch}
                disabled={disabled}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-all ${
                  enableWebSearch
                    ? "border-mint/50 bg-mint/40 text-emerald-700 hover:bg-mint/50"
                    : "border-foreground/30 bg-white/60 text-foreground/60 hover:bg-white/80"
                } disabled:opacity-60`}
                title={enableWebSearch ? "Web search enabled - AI can search the web for current information" : "Web search disabled - AI will only use its training data"}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                {enableWebSearch ? "Web search ON" : "Web search OFF"}
              </button>
            )}
          </div>

          {/* Step-by-Step Mode Toggle - only show if step-by-step mode is enabled */}
          {stepByStepModeEnabled && onToggleStepByStepWithExplanation && onToggleStepByStepNoExplanation && (
            <StepByStepToggle
              isWithExplanationEnabled={isStepByStepWithExplanation}
              isNoExplanationEnabled={isStepByStepNoExplanation}
              onToggleWithExplanation={onToggleStepByStepWithExplanation}
              onToggleNoExplanation={onToggleStepByStepNoExplanation}
              disabled={disabled}
            />
          )}

          {/* Text Conversion Buttons - show if at least one conversion feature is enabled */}
          {(convertToMarkdownEnabled || convertToJsonEnabled) && onConvertToMarkdown && onConvertToJson && (
            <TextConversionButtons
              hasText={!!value.trim()}
              convertingToMarkdown={convertingToMarkdown}
              convertingToJson={convertingToJson}
              onConvertToMarkdown={onConvertToMarkdown}
              onConvertToJson={onConvertToJson}
              disabled={disabled}
              showMarkdownButton={convertToMarkdownEnabled}
              showJsonButton={convertToJsonEnabled}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {/* Summarize Thread button - only show if feature is enabled */}
          {summarizeThreadEnabled && onSummarize && (
            <button
              className="rounded-md border border-white/40 px-3 py-1 text-[11px] text-foreground-secondary/70 hover:bg-white/40 disabled:opacity-60"
              onClick={onSummarize}
              disabled={!canSummarize || summarizing}
              title="Summarize this thread and add summary as a message"
            >
              {summarizing ? "Summarizing…" : "Summarize thread"}
            </button>
          )}
          {/* Summarize & Continue button - only show if feature is enabled */}
          {summarizeAndContinueEnabled && onSummarizeAndContinue && (
            <button
              className="rounded-md border border-secondary-mint bg-secondary-mint/20 px-3 py-1 text-[11px] text-emerald-700 hover:bg-secondary-mint/40 disabled:opacity-60 transition-all"
              onClick={onSummarizeAndContinue}
              disabled={!canSummarize || summarizing || summarizingAndContinuing}
              title="Summarize this thread and start a new thread with the summary as context"
            >
              {summarizingAndContinuing ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating new thread…
                </span>
              ) : (
                "Summarize & Continue"
              )}
            </button>
          )}
          {/* Fork Thread button - only show if feature is enabled */}
          {forkThreadEnabled && onFork && (
            <button
              className="rounded-md border border-secondary-pink bg-secondary-pink/20 px-3 py-1 text-[11px] text-pink-700 hover:bg-secondary-pink/40 disabled:opacity-60 transition-all"
              onClick={onFork}
              disabled={!canSummarize || forking}
              title="Fork this thread - create a duplicate with all messages to explore different paths"
            >
              {forking ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Forking…
                </span>
              ) : (
                "Fork Thread"
              )}
            </button>
          )}
          <button
            className="rounded-full rainbow-gradient px-5 py-2 text-sm font-medium disabled:opacity-60"
            onClick={onSend}
            disabled={disabled || (!value.trim() && attachedFiles.length === 0)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
