/**
 * Push-to-Talk Settings Storage
 *
 * Manages push-to-talk feature settings in localStorage:
 * - Feature enabled/disabled state
 * - Custom key binding
 */

const PTT_ENABLED_KEY = "ptt_enabled";
const PTT_KEYBIND_KEY = "ptt_keybind";

// Default key binding (Space key)
const DEFAULT_KEYBIND = " ";

export type KeyBinding = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

/**
 * Check if push-to-talk feature is enabled
 */
export function isPushToTalkEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const value = localStorage.getItem(PTT_ENABLED_KEY);
  return value === "true";
}

/**
 * Enable or disable push-to-talk feature
 */
export function setPushToTalkEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PTT_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * Get the current key binding for push-to-talk
 */
export function getPushToTalkKeybind(): KeyBinding {
  if (typeof window === "undefined") {
    return { key: DEFAULT_KEYBIND };
  }

  const value = localStorage.getItem(PTT_KEYBIND_KEY);
  if (!value) {
    return { key: DEFAULT_KEYBIND };
  }

  try {
    return JSON.parse(value) as KeyBinding;
  } catch {
    return { key: DEFAULT_KEYBIND };
  }
}

/**
 * Set a new key binding for push-to-talk
 */
export function setPushToTalkKeybind(keybind: KeyBinding): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PTT_KEYBIND_KEY, JSON.stringify(keybind));
}

/**
 * Reset push-to-talk settings to defaults
 */
export function resetPushToTalkSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PTT_ENABLED_KEY);
  localStorage.removeItem(PTT_KEYBIND_KEY);
}

/**
 * Check if a keyboard event matches the configured key binding
 */
export function matchesKeybind(event: KeyboardEvent, keybind: KeyBinding): boolean {
  // Check main key
  if (event.key !== keybind.key) return false;

  // Check modifiers
  if (!!keybind.ctrl !== event.ctrlKey) return false;
  if (!!keybind.alt !== event.altKey) return false;
  if (!!keybind.shift !== event.shiftKey) return false;
  if (!!keybind.meta !== event.metaKey) return false;

  return true;
}

/**
 * Format a key binding for display
 */
export function formatKeybind(keybind: KeyBinding): string {
  const parts: string[] = [];

  if (keybind.ctrl) parts.push("Ctrl");
  if (keybind.alt) parts.push("Alt");
  if (keybind.shift) parts.push("Shift");
  if (keybind.meta) parts.push("Meta");

  // Format the main key
  let keyDisplay = keybind.key;
  if (keybind.key === " ") keyDisplay = "Space";
  else if (keybind.key.length === 1) keyDisplay = keybind.key.toUpperCase();

  parts.push(keyDisplay);

  return parts.join(" + ");
}
