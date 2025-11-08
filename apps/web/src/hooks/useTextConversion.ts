/**
 * Text Conversion Hook
 *
 * Handles converting draft text to different formats (Markdown, JSON)
 * using the LLM before sending. Allows users to format their messages
 * automatically.
 */

"use client";

import { useState } from "react";
import { sendChatRequest } from "@/lib/chatClient";

type ConversionFormat = "markdown" | "json";

type UseTextConversionOptions = {
  onTextConverted: (convertedText: string) => void;
};

type UseTextConversionResult = {
  convertingToMarkdown: boolean;
  convertingToJson: boolean;
  convertToMarkdown: (text: string) => Promise<void>;
  convertToJson: (text: string) => Promise<void>;
};

export function useTextConversion(
  options: UseTextConversionOptions
): UseTextConversionResult {
  const { onTextConverted } = options;

  const [convertingToMarkdown, setConvertingToMarkdown] = useState(false);
  const [convertingToJson, setConvertingToJson] = useState(false);

  /**
   * Convert text to specified format using LLM
   */
  const convertText = async (text: string, format: ConversionFormat) => {
    const formatInstructions = {
      markdown: `Take the following text and reformat it using proper Markdown syntax. Do NOT answer or respond to the text. Do NOT generate new content. Simply add Markdown formatting (headers, lists, bold, italic, code blocks, etc.) to make the SAME content more readable and well-structured.

IMPORTANT: Return ONLY the Markdown-formatted version of the exact same text. Do not add explanations, commentary, or new information.

Text to reformat:
${text}`,
      json: `Convert the following text into valid JSON format. Structure the data appropriately based on the content. Only return the JSON, nothing else - no explanations or additional text.

Text to convert:
${text}`,
    };

    const systemPrompt =
      format === "markdown"
        ? "You are a Markdown formatting assistant. Your job is to take text and add Markdown formatting to it WITHOUT changing the content or answering questions. Only format the text with Markdown syntax."
        : "You are a JSON formatting expert. Convert text to valid, well-structured JSON format.";

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: formatInstructions[format] },
    ];

    try {
      const convertedText = await sendChatRequest(messages);
      onTextConverted(convertedText);
    } catch (error) {
      console.error(`Error converting to ${format}:`, error);
      throw error;
    }
  };

  /**
   * Convert text to Markdown format
   */
  const convertToMarkdown = async (text: string) => {
    if (!text.trim()) return;

    setConvertingToMarkdown(true);
    try {
      await convertText(text, "markdown");
    } catch (error) {
      console.error("Error in convertToMarkdown:", error);
    } finally {
      setConvertingToMarkdown(false);
    }
  };

  /**
   * Convert text to JSON format
   */
  const convertToJson = async (text: string) => {
    if (!text.trim()) return;

    setConvertingToJson(true);
    try {
      await convertText(text, "json");
    } catch (error) {
      console.error("Error in convertToJson:", error);
    } finally {
      setConvertingToJson(false);
    }
  };

  return {
    convertingToMarkdown,
    convertingToJson,
    convertToMarkdown,
    convertToJson,
  };
}
