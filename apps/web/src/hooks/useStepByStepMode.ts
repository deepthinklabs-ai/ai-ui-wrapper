/**
 * Step-by-Step Mode Hook
 *
 * Manages the state for step-by-step response mode.
 * When enabled, instructs the AI to provide one step at a time with detailed explanations.
 */

"use client";

import { useState, useCallback } from "react";

export type StepByStepMode = "off" | "with-explanation" | "no-explanation";

type UseStepByStepModeResult = {
  stepByStepMode: StepByStepMode;
  isStepByStepWithExplanation: boolean;
  isStepByStepNoExplanation: boolean;
  toggleStepByStepWithExplanation: () => void;
  toggleStepByStepNoExplanation: () => void;
  getSystemPromptAddition: () => string;
};

/**
 * Hook to manage step-by-step response mode
 */
export function useStepByStepMode(): UseStepByStepModeResult {
  const [stepByStepMode, setStepByStepMode] = useState<StepByStepMode>("off");

  const toggleStepByStepWithExplanation = useCallback(() => {
    setStepByStepMode((current) => {
      if (current === "with-explanation") {
        console.log("Step-by-step mode (with explanation): OFF");
        return "off";
      } else {
        console.log("Step-by-step mode (with explanation): ON");
        return "with-explanation";
      }
    });
  }, []);

  const toggleStepByStepNoExplanation = useCallback(() => {
    setStepByStepMode((current) => {
      if (current === "no-explanation") {
        console.log("Step-by-step mode (no explanation): OFF");
        return "off";
      } else {
        console.log("Step-by-step mode (no explanation): ON");
        return "no-explanation";
      }
    });
  }, []);

  /**
   * Get the system prompt addition based on the current mode
   */
  const getSystemPromptAddition = useCallback((): string => {
    switch (stepByStepMode) {
      case "with-explanation":
        return `

IMPORTANT: Step-by-Step Mode is ENABLED.

You must respond with ONLY ONE STEP at a time. Follow these rules strictly:

1. Provide ONLY the next single step in the process
2. Include a detailed explanation of WHY this step is necessary
3. Explain WHAT this step accomplishes
4. Stop after explaining this ONE step
5. Wait for the user to ask for the next step before continuing

Format your response as:
**Step [number]: [Brief title]**

[Detailed explanation of what this step does and why it's important]

[The actual step content, code, or instructions]

**Ready for next step:** Ask me to continue when you're ready for the next step.

Remember: DO NOT provide multiple steps. DO NOT continue beyond one step. WAIT for user confirmation.`;

      case "no-explanation":
        return `

IMPORTANT: Step-by-Step Mode (No Explanation) is ENABLED.

You must respond with ONLY ONE STEP at a time with NO explanation. Follow these rules strictly:

1. Provide ONLY the next single step
2. Do NOT include explanations
3. Do NOT include commentary
4. Just provide the minimal step content/code/instruction
5. Stop after providing this ONE step
6. Wait for the user to ask for the next step before continuing

Format: Just provide the step content directly without extra text.

Remember: DO NOT provide multiple steps. DO NOT add explanations. WAIT for user confirmation.`;

      case "off":
      default:
        return "";
    }
  }, [stepByStepMode]);

  return {
    stepByStepMode,
    isStepByStepWithExplanation: stepByStepMode === "with-explanation",
    isStepByStepNoExplanation: stepByStepMode === "no-explanation",
    toggleStepByStepWithExplanation,
    toggleStepByStepNoExplanation,
    getSystemPromptAddition,
  };
}
