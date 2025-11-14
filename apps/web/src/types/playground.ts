/**
 * Types for The Playground - AI-driven Sims-style game
 */

export type PersonalityTrait = {
  name: string;
  weight: number; // 0-100
  description: string;
};

export type PersonalityPreset = {
  id: string;
  name: string;
  description: string;
  traits: PersonalityTrait[];
};

export type Character = {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  color: string; // Hex color for character visualization
  personality: PersonalityTrait[];
  customPrompt?: string; // User's custom personality prompt
  currentActivity: string;
  isThinking: boolean;
};

export type NewsItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
};

export type DialogueMessage = {
  id: string;
  characterId: string;
  characterName: string;
  text: string;
  timestamp: Date;
  isReaction: boolean; // Is this reacting to news or another character?
  reactingTo?: string; // ID of news item or message
};

export type GameState = {
  characters: Character[];
  currentNews: NewsItem[];
  dialogueHistory: DialogueMessage[];
  isPaused: boolean;
  gameSpeed: number; // 1x, 2x, 4x
  time: Date; // In-game time
};

export type CharacterAction =
  | { type: "MOVE"; characterId: string; position: { x: number; y: number; z: number } }
  | { type: "SPEAK"; characterId: string; text: string; reactingTo?: string }
  | { type: "REACT_TO_NEWS"; characterId: string; newsId: string }
  | { type: "REACT_TO_CHARACTER"; characterId: string; messageId: string }
  | { type: "IDLE"; characterId: string };

// Preset personality trait names
export const TRAIT_NAMES = {
  OPTIMISM: "Optimism",
  PESSIMISM: "Pessimism",
  AGGRESSION: "Aggression",
  EMPATHY: "Empathy",
  HUMOR: "Humor",
  SERIOUSNESS: "Seriousness",
  CURIOSITY: "Curiosity",
  SKEPTICISM: "Skepticism",
  ENTHUSIASM: "Enthusiasm",
  CALMNESS: "Calmness",
  CREATIVITY: "Creativity",
  LOGIC: "Logic",
  EXTROVERSION: "Extroversion",
  INTROVERSION: "Introversion",
  CONFIDENCE: "Confidence",
  HUMILITY: "Humility",
} as const;

export type TraitName = typeof TRAIT_NAMES[keyof typeof TRAIT_NAMES];
