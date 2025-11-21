/**
 * Generate Virtual Employee Identity
 * Creates a random human-like name, gender, and voice ID for new employees
 */

import type { Gender, EmployeeIdentity } from '../types';

// Human-like names by gender
const MALE_NAMES = [
  'Alex', 'Ben', 'Chris', 'Daniel', 'Eric', 'Frank', 'George', 'Henry',
  'Ian', 'Jack', 'Kevin', 'Leo', 'Marcus', 'Nathan', 'Oliver', 'Paul',
  'Quinn', 'Ryan', 'Sam', 'Tim', 'Victor', 'Will', 'Xander', 'Zach'
];

const FEMALE_NAMES = [
  'Anna', 'Beth', 'Claire', 'Diana', 'Emma', 'Fiona', 'Grace', 'Hannah',
  'Iris', 'Julia', 'Kate', 'Laura', 'Maya', 'Nina', 'Olivia', 'Paula',
  'Rachel', 'Sarah', 'Tara', 'Uma', 'Vera', 'Wendy', 'Yara', 'Zoe'
];

const NONBINARY_NAMES = [
  'Avery', 'Blake', 'Casey', 'Dakota', 'Ellis', 'Finley', 'Gray', 'Harper',
  'Jordan', 'Kai', 'Logan', 'Morgan', 'Parker', 'Quinn', 'Riley', 'Sage',
  'Taylor', 'Val'
];

// ElevenLabs voice IDs mapped to gender
// TODO: Replace with actual ElevenLabs voice IDs from your account
const VOICE_IDS: Record<Gender, string[]> = {
  male: [
    'ErXwobaYiN019PkySvjV', // Antoni
    'VR6AewLTigWG4xSOukaG', // Arnold
    'pNInz6obpgDQGcFmaJgB', // Adam
    'yoZ06aMxZJJ28mfd3POQ', // Sam
  ],
  female: [
    'EXAVITQu4vr4xnSDxMaL', // Bella
    'MF3mGyEYCl7XYWbV9V6O', // Elli
    'ThT5KcBeYPX3keUQqHPh', // Dorothy
    'jsCqWAovK2LkecY7zXl4', // Freya
  ],
  nonbinary: [
    'N2lVS1w4EtoT3dr4eOWO', // Callum
    'onwK4e9ZLuTAKqWW03F9', // Daniel
  ],
};

/**
 * Generate a random employee identity with name, gender, and voice
 */
export function generateVirtualEmployeeIdentity(): EmployeeIdentity {
  // Randomly select gender
  const genders: Gender[] = ['male', 'female', 'nonbinary'];
  const gender = genders[Math.floor(Math.random() * genders.length)];

  // Select name based on gender
  let name: string;
  if (gender === 'male') {
    name = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
  } else if (gender === 'female') {
    name = FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)];
  } else {
    name = NONBINARY_NAMES[Math.floor(Math.random() * NONBINARY_NAMES.length)];
  }

  // Select voice ID based on gender
  const voiceOptions = VOICE_IDS[gender];
  const voiceId = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];

  return {
    name,
    gender,
    voiceId,
  };
}

/**
 * Get a random voice ID for a specific gender
 */
export function getVoiceIdForGender(gender: Gender): string {
  const voiceOptions = VOICE_IDS[gender];
  return voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
}

/**
 * Get all available voice IDs for a specific gender
 */
export function getVoiceOptionsForGender(gender: Gender): string[] {
  return VOICE_IDS[gender];
}
