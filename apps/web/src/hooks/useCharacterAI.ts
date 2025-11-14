/**
 * Character AI Hook
 *
 * Handles AI-driven character dialogue and reactions.
 * Characters react to news and other characters based on their personalities.
 */

"use client";

import { useCallback } from "react";
import type { Character, NewsItem, DialogueMessage } from "@/types/playground";
import { generatePersonalityPrompt } from "@/lib/playgroundPresets";

type UseCharacterAIProps = {
  userId: string;
  userTier: "free" | "pro";
};

type UseCharacterAIResult = {
  generateReactionToNews: (
    character: Character,
    newsItem: NewsItem,
    recentDialogue: DialogueMessage[]
  ) => Promise<string>;
  generateReactionToCharacter: (
    character: Character,
    messageToReactTo: DialogueMessage,
    recentDialogue: DialogueMessage[]
  ) => Promise<string>;
  generateSpontaneousComment: (
    character: Character,
    context: {
      recentNews: NewsItem[];
      recentDialogue: DialogueMessage[];
    }
  ) => Promise<string>;
};

export function useCharacterAI({ userId, userTier }: UseCharacterAIProps): UseCharacterAIResult {
  /**
   * Call AI API to generate character dialogue
   */
  const callAI = useCallback(
    async (systemPrompt: string, userPrompt: string): Promise<string> => {
      try {
        // Use the unified API route based on user tier
        const apiRoute = userTier === "pro" ? "/api/pro/claude" : "/api/chat";

        // Format request based on API tier
        const requestBody = userTier === "pro"
          ? {
              // Claude API format - system as separate parameter
              system: systemPrompt,
              messages: [
                {
                  role: "user",
                  content: userPrompt,
                },
              ],
              model: "claude-sonnet-4.5",
            }
          : {
              // OpenAI API format - system in messages array
              messages: [
                {
                  role: "system",
                  content: systemPrompt,
                },
                {
                  role: "user",
                  content: userPrompt,
                },
              ],
              model: "gpt-4o-mini",
            };

        const response = await fetch(apiRoute, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("API error:", errorData);
          throw new Error(`API call failed: ${response.statusText}`);
        }

        const data = await response.json();
        // Try multiple response formats: Pro API returns 'content', Free API returns 'reply'
        const responseText = data.content || data.reply || data.message || "";

        if (!responseText || responseText === "...") {
          console.error("Empty or invalid AI response:", data);
          return "...";
        }

        return responseText;
      } catch (error) {
        console.error("Error calling AI:", error);
        return "..."; // Silent failure - character just stays quiet
      }
    },
    [userTier]
  );

  /**
   * Generate character reaction to news
   */
  const generateReactionToNews = useCallback(
    async (
      character: Character,
      newsItem: NewsItem,
      recentDialogue: DialogueMessage[]
    ): Promise<string> => {
      const systemPrompt = generatePersonalityPrompt(character.personality, character.customPrompt);

      // Build context from recent dialogue
      const dialogueContext =
        recentDialogue.length > 0
          ? "\n\nRecent conversation:\n" +
            recentDialogue
              .slice(-5) // Last 5 messages
              .map((msg) => `${msg.characterName}: ${msg.text}`)
              .join("\n")
          : "";

      const userPrompt = `You just heard this news:
"${newsItem.title}"
${newsItem.description}

${dialogueContext}

Make a brief comment about this to start a conversation. Keep it SHORT (1-2 sentences). Be natural and conversational. Stay in character.`;

      return await callAI(systemPrompt, userPrompt);
    },
    [callAI]
  );

  /**
   * Generate character reaction to another character's message
   */
  const generateReactionToCharacter = useCallback(
    async (
      character: Character,
      messageToReactTo: DialogueMessage,
      recentDialogue: DialogueMessage[]
    ): Promise<string> => {
      const systemPrompt = generatePersonalityPrompt(character.personality, character.customPrompt);

      // Build context from recent dialogue
      const dialogueContext =
        recentDialogue.length > 0
          ? "Recent conversation:\n" +
            recentDialogue
              .slice(-8) // Last 8 messages
              .map((msg) => `${msg.characterName}: ${msg.text}`)
              .join("\n")
          : "";

      const userPrompt = `${dialogueContext}

${messageToReactTo.characterName} just said: "${messageToReactTo.text}"

Respond naturally to what they just said, like you're in a conversation with them. React to their comment, not the original topic. You can agree, disagree, question, interrupt, or build on what they said. Keep it conversational (1-2 sentences). Stay in character.`;

      return await callAI(systemPrompt, userPrompt);
    },
    [callAI]
  );

  /**
   * Generate spontaneous comment (when character feels like speaking)
   */
  const generateSpontaneousComment = useCallback(
    async (
      character: Character,
      context: {
        recentNews: NewsItem[];
        recentDialogue: DialogueMessage[];
      }
    ): Promise<string> => {
      const systemPrompt = generatePersonalityPrompt(character.personality, character.customPrompt);

      // Build context
      const newsContext =
        context.recentNews.length > 0
          ? "Recent news:\n" +
            context.recentNews
              .slice(0, 3)
              .map((news) => `- ${news.title}`)
              .join("\n")
          : "";

      const dialogueContext =
        context.recentDialogue.length > 0
          ? "\n\nRecent conversation:\n" +
            context.recentDialogue
              .slice(-5)
              .map((msg) => `${msg.characterName}: ${msg.text}`)
              .join("\n")
          : "";

      const userPrompt = `${newsContext}${dialogueContext}

Based on recent events and conversations, make a spontaneous comment or observation. 1-3 sentences. Stay in character.`;

      return await callAI(systemPrompt, userPrompt);
    },
    [callAI]
  );

  return {
    generateReactionToNews,
    generateReactionToCharacter,
    generateSpontaneousComment,
  };
}
