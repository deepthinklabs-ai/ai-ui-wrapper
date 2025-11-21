/**
 * MCP Credentials Migration Banner
 *
 * Displays a banner in settings if MCP credentials need to be migrated
 * from localStorage to encrypted database storage.
 */

"use client";

import { useState, useEffect } from "react";
import {
  migrateMCPCredentials,
  getMigrationStatus,
  type MigrationResult,
} from "@/lib/migrateCredentials";

export default function MCPMigrationBanner() {
  const [status, setStatus] = useState<{
    needsMigration: boolean;
    serverCount: number;
    serversWithCredentials: number;
  }>({ needsMigration: false, serverCount: 0, serversWithCredentials: 0 });

  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if migration is needed
    const migrationStatus = getMigrationStatus();
    setStatus(migrationStatus);
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationResult(null);

    try {
      const result = await migrateMCPCredentials();
      setMigrationResult(result);

      // Refresh status
      const newStatus = getMigrationStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error("[Migration] Error:", error);
      setMigrationResult({
        success: false,
        migrated: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        details: [],
      });
    } finally {
      setMigrating(false);
    }
  };

  // Don't show banner if no migration needed
  if (!status.needsMigration && !migrationResult) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Migration Banner */}
      {status.needsMigration && !migrationResult?.success && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-yellow-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                Security Upgrade Available
              </h3>

              <p className="text-sm text-gray-300 mb-3">
                Your MCP server credentials are currently stored in browser localStorage
                (unencrypted). We recommend migrating to encrypted database storage for
                enhanced security.
              </p>

              <div className="bg-black/20 rounded p-3 mb-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400">Servers found:</span>
                  <span className="font-semibold text-white">{status.serverCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Servers with credentials:</span>
                  <span className="font-semibold text-yellow-300">
                    {status.serversWithCredentials}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
                >
                  {migrating ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Migrating...
                    </span>
                  ) : (
                    "Migrate Now"
                  )}
                </button>

                <button
                  onClick={() => setStatus({ ...status, needsMigration: false })}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Remind Me Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration Result */}
      {migrationResult && (
        <div
          className={`border rounded-lg p-4 ${
            migrationResult.success
              ? "bg-green-900/30 border-green-600"
              : "bg-red-900/30 border-red-600"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {migrationResult.success ? (
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>

            <div className="flex-1">
              <h3
                className={`text-lg font-semibold mb-2 ${
                  migrationResult.success ? "text-green-300" : "text-red-300"
                }`}
              >
                {migrationResult.success ? "Migration Successful!" : "Migration Failed"}
              </h3>

              <div className="text-sm text-gray-300 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-semibold">
                    ✓ {migrationResult.migrated}
                  </span>
                  <span>servers migrated</span>
                </div>
                {migrationResult.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-semibold">
                      ✗ {migrationResult.failed}
                    </span>
                    <span>servers failed</span>
                  </div>
                )}
              </div>

              {migrationResult.success && (
                <p className="text-sm text-gray-300 mb-3">
                  Your MCP credentials are now encrypted and stored securely in the
                  database. The credentials have been removed from browser storage.
                </p>
              )}

              {migrationResult.errors.length > 0 && (
                <div className="bg-black/20 rounded p-3 mb-3">
                  <p className="text-sm font-semibold text-red-300 mb-2">Errors:</p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    {migrationResult.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {migrationResult.details.length > 0 && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-gray-400 hover:text-gray-300 underline"
                >
                  {showDetails ? "Hide" : "Show"} Details
                </button>
              )}

              {showDetails && (
                <div className="mt-3 bg-black/20 rounded p-3">
                  <p className="text-sm font-semibold text-gray-300 mb-2">
                    Migration Details:
                  </p>
                  <div className="space-y-2">
                    {migrationResult.details.map((detail, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-gray-300"
                      >
                        <span className={detail.success ? "text-green-400" : "text-red-400"}>
                          {detail.success ? "✓" : "✗"}
                        </span>
                        <span>{detail.serverName}</span>
                        {detail.error && (
                          <span className="text-red-300 text-xs">({detail.error})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setMigrationResult(null)}
                className="mt-3 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
