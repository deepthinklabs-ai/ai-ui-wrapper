/**
 * PasswordStrengthIndicator Component
 *
 * Visual indicator showing password strength with color-coded bar
 * and helpful feedback messages.
 */

import React from 'react';
import type { PasswordStrength } from '@/lib/passwordStrength';

type PasswordStrengthIndicatorProps = {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
  show?: boolean; // Only show when user has started typing
};

export default function PasswordStrengthIndicator({
  strength,
  score,
  feedback,
  show = true,
}: PasswordStrengthIndicatorProps) {
  if (!show) return null;

  // Color schemes for each strength level
  const strengthConfig = {
    weak: {
      label: 'Weak',
      barColor: 'bg-red-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    fair: {
      label: 'Fair',
      barColor: 'bg-orange-500',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
    },
    good: {
      label: 'Good',
      barColor: 'bg-yellow-500',
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
    },
    strong: {
      label: 'Strong',
      barColor: 'bg-green-500',
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
  };

  const config = strengthConfig[strength];

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${config.barColor} transition-all duration-300 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${config.textColor}`}>
          {config.label}
        </span>
      </div>

      {/* Feedback messages */}
      {feedback.length > 0 && (
        <div className={`rounded-md border ${config.borderColor} ${config.bgColor} px-3 py-2`}>
          <ul className="space-y-1">
            {feedback.map((message, index) => (
              <li key={index} className={`text-xs ${config.textColor} flex items-start`}>
                <span className="mr-2">•</span>
                <span>{message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
