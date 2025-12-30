"use client";

/**
 * ChatbotSelector Component
 *
 * Dropdown selector for choosing which chatbot configuration to use.
 * Shows in the message composer area.
 */

import React, { useState, useRef, useEffect } from "react";
import type { Chatbot } from "@/types/chatbot";

type ChatbotSelectorProps = {
  /** List of available chatbots */
  chatbots: Chatbot[];
  /** Currently selected chatbot (null = using defaults) */
  selectedChatbot: Chatbot | null;
  /** Called when a chatbot is selected */
  onSelectChatbot: (chatbot: Chatbot | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Compact mode (smaller size) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
};

export function ChatbotSelector({
  chatbots,
  selectedChatbot,
  onSelectChatbot,
  disabled = false,
  loading = false,
  compact = false,
  className = "",
}: ChatbotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter chatbots by search term
  const filteredChatbots = chatbots.filter(
    (chatbot) =>
      chatbot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (chatbot.description && chatbot.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (chatbot: Chatbot | null) => {
    onSelectChatbot(chatbot);
    setIsOpen(false);
    setSearchTerm("");
  };

  const buttonClasses = compact
    ? "h-8 px-2 text-xs"
    : "h-9 px-3 text-sm";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`flex items-center gap-2 rounded-md border border-foreground/30 bg-white/60 text-foreground hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${buttonClasses}`}
      >
        {/* Icon */}
        <svg className="h-4 w-4 flex-shrink-0 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>

        {/* Label */}
        <span className="truncate max-w-[120px]">
          {loading ? (
            "Loading..."
          ) : selectedChatbot ? (
            selectedChatbot.name
          ) : (
            "Default"
          )}
        </span>

        {/* Dropdown arrow */}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-foreground/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-1 w-64 rounded-md border border-foreground/20 bg-white/90 backdrop-blur-md shadow-lg z-50">
          {/* Search Input */}
          {chatbots.length > 5 && (
            <div className="p-2 border-b border-foreground/10">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search chatbots..."
                className="w-full rounded-md border border-foreground/20 bg-white/60 px-2 py-1.5 text-sm text-foreground placeholder-foreground/40 focus:border-sky/50 focus:outline-none focus:ring-1 focus:ring-sky/50"
              />
            </div>
          )}

          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1">
            {/* Default option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/60 transition-colors ${
                !selectedChatbot ? "bg-white/60 text-foreground" : "text-foreground"
              }`}
            >
              <div className="h-6 w-6 flex items-center justify-center rounded-full bg-foreground/10 text-xs font-medium text-foreground/60">
                D
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">Default Settings</div>
                <div className="text-xs text-foreground/50 truncate">Use global defaults</div>
              </div>
              {!selectedChatbot && (
                <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Divider */}
            {filteredChatbots.length > 0 && (
              <div className="my-1 border-t border-foreground/10" />
            )}

            {/* Chatbot options */}
            {filteredChatbots.length === 0 && searchTerm && (
              <div className="px-3 py-2 text-sm text-foreground/50">
                No chatbots found
              </div>
            )}

            {filteredChatbots.length === 0 && !searchTerm && chatbots.length === 0 && (
              <div className="px-3 py-2 text-sm text-foreground/50">
                No chatbots yet. Create one in the sidebar.
              </div>
            )}

            {filteredChatbots.map((chatbot) => {
              const isSelected = selectedChatbot?.id === chatbot.id;
              const initial = chatbot.name.charAt(0).toUpperCase();
              const provider = chatbot.config.model?.provider || "ai";
              const providerColor = {
                openai: "bg-green-500",
                claude: "bg-orange-500",
                grok: "bg-blue-500",
                gemini: "bg-purple-500",
              }[provider] || "bg-foreground/30";

              return (
                <button
                  key={chatbot.id}
                  type="button"
                  onClick={() => handleSelect(chatbot)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/60 transition-colors ${
                    isSelected ? "bg-white/60 text-foreground" : "text-foreground"
                  }`}
                >
                  <div className={`h-6 w-6 flex items-center justify-center rounded-full ${providerColor} text-xs font-medium text-white`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{chatbot.name}</div>
                    {chatbot.description && (
                      <div className="text-xs text-foreground/50 truncate">{chatbot.description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
