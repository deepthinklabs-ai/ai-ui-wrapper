"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getSelectedModel,
  setSelectedModel,
  type AIModel,
} from "@/lib/apiKeyStorage";
import {
  getClaudeApiKey,
  setClaudeApiKey,
  clearClaudeApiKey,
} from "@/lib/apiKeyStorage.claude";
import ApiKeyInput from "@/components/settings/ApiKeyInput";
import ModelSelector from "@/components/settings/ModelSelector";
import SecurityWarning from "@/components/settings/SecurityWarning";

export default function SettingsPage() {
  const router = useRouter();
  const [openaiApiKey, setOpenaiApiKeyState] = useState("");
  const [claudeApiKey, setClaudeApiKeyState] = useState("");
  const [selectedModel, setSelectedModelState] = useState<AIModel>("gpt-5");
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingClaude, setIsTestingClaude] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isOpenaiKeySaved, setIsOpenaiKeySaved] = useState(false);
  const [isClaudeKeySaved, setIsClaudeKeySaved] = useState(false);

  // Load existing settings on mount
  useEffect(() => {
    const existingOpenAIKey = getApiKey();
    const existingClaudeKey = getClaudeApiKey();
    const existingModel = getSelectedModel();

    if (existingOpenAIKey) {
      setIsOpenaiKeySaved(true);
    }
    if (existingClaudeKey) {
      setIsClaudeKeySaved(true);
    }
    setSelectedModelState(existingModel);
  }, []);

  const handleOpenAIKeyChange = (value: string) => {
    setOpenaiApiKeyState(value);
    setHasUnsavedChanges(true);
  };

  const handleClaudeKeyChange = (value: string) => {
    setClaudeApiKeyState(value);
    setHasUnsavedChanges(true);
  };

  const handleModelChange = (model: AIModel) => {
    setSelectedModelState(model);
    setHasUnsavedChanges(true);
  };

  const testOpenAIKey = async (): Promise<boolean> => {
    setIsTesting(true);
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error("Error testing OpenAI API key:", error);
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  const testClaudeKey = async (): Promise<boolean> => {
    setIsTestingClaude(true);
    try {
      console.log("Testing Claude API key...");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      console.log("Claude API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Claude API error details:", errorData);
      }

      return response.ok;
    } catch (error) {
      console.error("Error testing Claude API key:", error);
      return false;
    } finally {
      setIsTestingClaude(false);
    }
  };

  const handleSave = () => {
    if (openaiApiKey.trim()) {
      setApiKey(openaiApiKey);
      setIsOpenaiKeySaved(true);
      setOpenaiApiKeyState("");
    }
    if (claudeApiKey.trim()) {
      setClaudeApiKey(claudeApiKey);
      setIsClaudeKeySaved(true);
      setClaudeApiKeyState("");
    }
    setSelectedModel(selectedModel);
    setHasUnsavedChanges(false);
    router.push("/dashboard");
  };

  const handleClearOpenAIKey = () => {
    if (confirm("Are you sure you want to remove your OpenAI API key?")) {
      clearApiKey();
      setOpenaiApiKeyState("");
      setIsOpenaiKeySaved(false);
      setHasUnsavedChanges(false);
    }
  };

  const handleClearClaudeKey = () => {
    if (confirm("Are you sure you want to remove your Claude API key?")) {
      clearClaudeApiKey();
      setClaudeApiKeyState("");
      setIsClaudeKeySaved(false);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-400">Unsaved changes</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* Security Best Practices Warning */}
          <SecurityWarning />

          {/* OpenAI API Key Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-100">OpenAI API Key</h2>
              <p className="mt-2 text-sm text-slate-400">
                Your API key is stored locally in your browser and never sent to our servers.
                We only use it to make direct calls to OpenAI on your behalf.
              </p>
            </div>

            {/* Instructions */}
            <div className="mb-6 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-300">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                How to get your OpenAI API key (takes 30 seconds)
              </h3>
              <ol className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                    1
                  </span>
                  <span>
                    Click the button below to open OpenAI's API key page in a new tab
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                    2
                  </span>
                  <span>Sign in to your OpenAI account (or create one if you don't have one)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                    3
                  </span>
                  <span>Click "Create new secret key" and give it a name</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                    4
                  </span>
                  <span>Copy the key (it starts with "sk-") and paste it below</span>
                </li>
              </ol>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Get Your OpenAI API Key
              </a>
            </div>

            {/* API Key Status or Input */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                API Key
              </label>

              {isOpenaiKeySaved && !openaiApiKey ? (
                // Show masked status when key is saved and not being edited
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-slate-200">API Key Configured</div>
                        <div className="text-xs text-slate-400">sk-••••••••••••••••••••••••••</div>
                      </div>
                    </div>
                    <button
                      onClick={handleClearOpenAIKey}
                      className="rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Your API key is securely stored in your browser. To update it, remove the current key and add a new one.
                  </p>
                </div>
              ) : (
                // Show input when no key is saved or user is adding a new key
                <>
                  <ApiKeyInput
                    value={openaiApiKey}
                    onChange={handleOpenAIKeyChange}
                    onTest={testOpenAIKey}
                    isTesting={isTesting}
                  />
                  {isOpenaiKeySaved && openaiApiKey && (
                    <button
                      onClick={() => {
                        setOpenaiApiKeyState("");
                        setHasUnsavedChanges(false);
                      }}
                      className="mt-3 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Claude API Key Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Claude (Anthropic) API Key</h2>
              <p className="mt-2 text-sm text-slate-400">
                Optional: Add your Claude API key to use Anthropic's Claude models.
              </p>
            </div>

            {/* Instructions */}
            <div className="mb-6 rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-300">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                How to get your Claude API key
              </h3>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Get Your Claude API Key
              </a>
            </div>

            {/* Claude API Key Status or Input */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Claude API Key
              </label>

              {isClaudeKeySaved && !claudeApiKey ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-slate-200">Claude API Key Configured</div>
                        <div className="text-xs text-slate-400">sk-ant-••••••••••••••••••••••••••</div>
                      </div>
                    </div>
                    <button
                      onClick={handleClearClaudeKey}
                      className="rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Your Claude API key is securely stored in your browser.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="password"
                        value={claudeApiKey}
                        onChange={(e) => handleClaudeKeyChange(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    {claudeApiKey && !claudeApiKey.startsWith("sk-ant-") && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Claude API keys should start with 'sk-ant-'</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">
                      Note: Claude API doesn't support browser-based key testing. Your key will be validated when you use a Claude model.
                    </p>
                  </div>
                  {isClaudeKeySaved && claudeApiKey && (
                    <button
                      onClick={() => {
                        setClaudeApiKeyState("");
                        setHasUnsavedChanges(false);
                      }}
                      className="mt-3 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Model Selection Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Model Selection</h2>
              <p className="mt-2 text-sm text-slate-400">
                Choose which OpenAI model to use for your conversations. Different models have
                different capabilities and pricing.
              </p>
            </div>

            <ModelSelector value={selectedModel} onChange={handleModelChange} />

            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">Note:</strong> Pricing varies by model. Check{" "}
                <a
                  href="https://openai.com/api/pricing/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300"
                >
                  OpenAI's pricing page
                </a>{" "}
                for details. You'll be charged directly by OpenAI based on your usage.
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
