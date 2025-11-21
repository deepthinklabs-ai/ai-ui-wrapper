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
        <h3 className="text-lg font-medium mb-2">Push-to-Talk</h3>
        <p className="text-sm text-gray-400 mb-2">
          Hold a key to activate voice input. Release to stop recording.
        </p>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 mb-4">
          <p className="text-xs text-blue-300">
            <strong>💡 Recommendation:</strong> Use a non-alphanumeric key (like Space, Tab, or CapsLock)
            to avoid conflicts when typing messages. Avoid letters and numbers.
          </p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor="ptt-enabled" className="text-sm font-medium">
          Enable Push-to-Talk
        </label>
        <button
          id="ptt-enabled"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-gray-700"
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
          <label className="text-sm font-medium">Key Binding</label>

          {!isRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 rounded-lg px-4 py-3 border border-gray-700">
                <span className="font-mono text-sm">{formatKeybind(keybind)}</span>
              </div>
              <button
                onClick={startRecording}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-950 border border-blue-800 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-300 mb-2">
                  Press any key combination...
                </p>
                {recordedKey ? (
                  <div className="font-mono text-sm text-white">
                    {formatKeybind(recordedKey)}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Waiting for input...</div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveKeybind}
                  disabled={!recordedKey}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={cancelRecording}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              <strong>Tip:</strong> You can use modifier keys (Ctrl, Alt, Shift, Meta) combined with any key.
            </p>
            <p className="text-xs text-amber-400">
              <strong>⚠️ Avoid:</strong> Letters and numbers may interfere when typing in the message box.
              Recommended: Space, Tab, CapsLock, or modifier combinations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
