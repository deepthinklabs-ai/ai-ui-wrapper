"use client";

import type { ToolCall, ToolResult } from "@/types/chat";

type ToolCallDisplayProps = {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
};

export function ToolCallDisplay({ toolCalls, toolResults }: ToolCallDisplayProps) {
  return (
    <div className="space-y-2 p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg my-2">
      <div className="text-xs font-medium text-blue-300 flex items-center gap-2">
        <span>🔧</span>
        <span>Tool Usage</span>
      </div>

      {toolCalls.map((call) => {
        const result = toolResults.find((r) => r.toolCallId === call.id);

        return (
          <details key={call.id} className="text-sm">
            <summary className="cursor-pointer text-blue-400 hover:text-blue-300 flex items-center gap-2">
              <span>{call.name}</span>
              {result && (
                <span className={result.isError ? "text-red-400" : "text-green-400"}>
                  {result.isError ? " ✗" : " ✓"}
                </span>
              )}
            </summary>

            <div className="mt-2 space-y-2 pl-4">
              <div>
                <div className="text-xs text-gray-400">Input:</div>
                <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto mt-1">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </div>

              {result && (
                <div>
                  <div className="text-xs text-gray-400">Result:</div>
                  <pre
                    className={`text-xs p-2 rounded overflow-x-auto mt-1 ${
                      result.isError
                        ? "bg-red-950 text-red-300"
                        : "bg-gray-900 text-gray-300"
                    }`}
                  >
                    {typeof result.result === "string"
                      ? result.result
                      : JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
