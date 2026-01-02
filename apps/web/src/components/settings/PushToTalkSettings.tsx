/**
 * Push-to-Talk Settings Component
 *
 * UI for configuring push-to-talk feature:
 * - Enable/disable toggle
 * - Key binding configuration
 * - Visual feedback for key recording
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  isPushToTalkEnabled,
  setPushToTalkEnabled,
  getPushToTalkKeybind,
  setPushToTalkKeybind,
  formatKeybind,
  type KeyBinding,
} from "@/lib/pushToTalkStorage";

export default function PushToTalkSettings() {
  const [enabled, setEnabled] = useState(false);
  const [keybind, setKeybind] = useState<KeyBinding>({ key: " " });
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKey, setRecordedKey] = useState<KeyBinding | null>(null);

  // Load settings on mount
  useEffect(() => {
    setEnabled(isPushToTalkEnabled());
    setKeybind(getPushToTalkKeybind());
  }, []);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setPushToTalkEnabled(newEnabled);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordedKey(null);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    setRecordedKey(null);
  };

  const saveKeybind = () => {
    if (recordedKey) {
      setKeybind(recordedKey);
      setPushToTalkKeybind(recordedKey);
      setIsRecording(false);
      setRecordedKey(null);
    }
  };

  // Listen for key press when recording
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();

      // Ignore modifier-only keys
      if (
        event.key === "Control" ||
        event.key === "Alt" ||
        event.key === "Shift" ||
        event.key === "Meta"
      ) {
        return;
      }

      // Record the key combination
      const newKeybind: KeyBinding = {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };

      setRecordedKey(newKeybind);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-2">Push-to-Talk</h3>
        <p className="text-sm text-foreground/60 mb-2">
          Hold a key to activate voice input. Release to stop recording.
        </p>
        <div className="rounded-lg border border-sky/30 bg-sky/10 px-3 py-2 mb-4">
          <p className="text-xs text-sky-700">
            <strong>💡 Recommendation:</strong> Use a non-alphanumeric key (like Space, Tab, or CapsLock)
            to avoid conflicts when typing messages. Avoid letters and numbers.
          </p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor="ptt-enabled" className="text-sm font-medium text-foreground">
          Enable Push-to-Talk
        </label>
        <button
          id="ptt-enabled"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-sky" : "bg-foreground/20"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Key Binding Configuration */}
      {enabled && (
        <div className="space-y-3 pt-2">
          <label className="text-sm font-medium text-foreground">Key Binding</label>

          {!isRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/60 rounded-lg px-4 py-3 border border-white/40">
                <span className="font-mono text-sm text-foreground">{formatKeybind(keybind)}</span>
              </div>
              <button
                onClick={startRecording}
                className="px-4 py-2 bg-sky hover:bg-sky/80 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-sky/10 border border-sky/30 rounded-lg px-4 py-3">
                <p className="text-sm text-sky-700 mb-2">
                  Press any key combination...
                </p>
                {recordedKey ? (
                  <div className="font-mono text-sm text-foreground">
                    {formatKeybind(recordedKey)}
                  </div>
                ) : (
                  <div className="text-sm text-foreground/40">Waiting for input...</div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveKeybind}
                  disabled={!recordedKey}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white disabled:bg-foreground/10 disabled:text-foreground/40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={cancelRecording}
                  className="flex-1 px-4 py-2 bg-white/60 border border-white/40 hover:bg-white/80 text-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-foreground/50">
              <strong>Tip:</strong> You can use modifier keys (Ctrl, Alt, Shift, Meta) combined with any key.
            </p>
            <p className="text-xs text-amber-600">
              <strong>⚠️ Avoid:</strong> Letters and numbers may interfere when typing in the message box.
              Recommended: Space, Tab, CapsLock, or modifier combinations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
