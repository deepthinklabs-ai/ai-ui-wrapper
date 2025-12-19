/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used for:
 * - Environment variable validation
 * - Startup checks
 * - Telemetry initialization
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvironment } = await import("@/lib/validateEnv");

    console.log("[Startup] Validating environment configuration...");

    const result = validateEnvironment({
      throwOnError: false, // Don't crash the server, but log errors
      logWarnings: true,
    });

    if (result.valid) {
      console.log("[Startup] Environment validation passed");
    } else {
      console.error(
        "[Startup] Environment validation failed - some features may not work correctly"
      );
      console.error("[Startup] Missing variables:", result.missing.join(", "));
    }
  }
}
