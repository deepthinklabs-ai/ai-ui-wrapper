/**
 * Debounced Value Hook
 *
 * Delays updating a value until the user stops changing it for a specified time.
 * This prevents expensive operations (like context window calculations) from
 * running on every keystroke, improving typing performance.
 */

"use client";

import { useState, useEffect } from "react";

/**
 * Returns a debounced version of the value
 * The value will only update after `delay` milliseconds of inactivity
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timeout to update the debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clear the timeout if value changes before delay expires
    // This ensures we only update after user stops typing
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
