/**
 * Subtitles Component
 *
 * Displays TV-style subtitles at the bottom of the screen
 * as characters speak.
 */

"use client";

import React from "react";
import type { Character } from "@/types/playground";

type SubtitlesProps = {
  character: Character | null;
  text: string;
  isVisible: boolean;
};

export default function Subtitles({ character, text, isVisible }: SubtitlesProps) {
  if (!isVisible || !character) {
    return null;
  }

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-11/12 max-w-4xl z-10 pointer-events-none">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg px-6 py-4 shadow-2xl border border-slate-700/50">
        <div className="flex items-start gap-3">
          {/* Character indicator */}
          <div className="flex-shrink-0 pt-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: character.color }}
            />
          </div>

          {/* Subtitle text */}
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: character.color }}
              >
                {character.name}
              </span>
            </div>
            <p className="text-white text-lg leading-relaxed font-medium">
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
