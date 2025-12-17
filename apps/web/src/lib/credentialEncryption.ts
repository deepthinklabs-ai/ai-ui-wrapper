/**
 * @security-audit-requested
 * AUDIT FOCUS: Credential encryption implementation
 * - Is AES-256-GCM implementation correct?
 * - Is the encryption key properly protected?
 * - Are IVs generated securely and never reused?
 * - Is the auth tag properly validated on decryption?
 * - Are there any timing attacks possible?
 */

/**
 * Credential Encryption Utilities
 *
 * SECURITY: Phase 1 - Encrypt MCP credentials using AES-256-GCM
 * Credentials are encrypted before storing in database and decrypted on retrieval.
 *
 * Algorithm: AES-256-GCM (Galois/Counter Mode)
 * - Provides both confidentiality and authenticity
 * - Prevents tampering with encrypted data
 * - Industry standard for sensitive data encryption
 */

import crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment
 * SECURITY: Key must be stored in environment variable, never in code
 */
function getEncryptionKey(): Buffer {
  const key = process.env.MCP_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "MCP_ENCRYPTION_KEY not found in environment. Please set this variable with a 32-byte hex string."
    );
  }

  // Key should be 32 bytes (256 bits) hex string
  if (key.length !== 64) {
    throw new Error(
      "MCP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Generate a random encryption key
 * Use this to generate MCP_ENCRYPTION_KEY for your environment
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param plaintext - Data to encrypt (will be JSON stringified)
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encrypt(plaintext: any): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  try {
    // Convert plaintext to JSON string
    const plaintextString =
      typeof plaintext === "string" ? plaintext : JSON.stringify(plaintext);

    // Generate random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Get encryption key
    const key = getEncryptionKey();

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintextString, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  } catch (error) {
    // SECURITY: Only log error type/message, not full object which may contain sensitive data
    console.error("[Encryption] Encryption failed:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to encrypt credentials");
  }
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encrypted - Encrypted data (hex string)
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @returns Decrypted data (parsed from JSON)
 */
export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string
): any {
  try {
    // Get encryption key
    const key = getEncryptionKey();

    // Convert hex strings to buffers
    const ivBuffer = Buffer.from(iv, "hex");
    const authTagBuffer = Buffer.from(authTag, "hex");

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt data
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Parse JSON
    try {
      return JSON.parse(decrypted);
    } catch {
      // If not JSON, return as string
      return decrypted;
    }
  } catch (error) {
    // SECURITY: Only log error type/message, not full object which may contain sensitive data
    console.error("[Encryption] Decryption failed:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to decrypt credentials");
  }
}

/**
 * Encrypt MCP server configuration
 * Separates sensitive data (env vars) from non-sensitive data
 *
 * @param config - MCP server configuration
 * @returns Encrypted configuration with IV
 */
export function encryptMCPConfig(config: {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}): { encryptedConfig: string; iv: string; authTag: string } {
  // Only encrypt sensitive parts (env variables)
  const sensitiveData = {
    env: config.env || {},
  };

  const encrypted = encrypt(sensitiveData);

  return {
    encryptedConfig: encrypted.encrypted,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
}

/**
 * Decrypt MCP server configuration
 *
 * @param encryptedConfig - Encrypted configuration
 * @param iv - Initialization vector
 * @param authTag - Authentication tag
 * @returns Decrypted configuration
 */
export function decryptMCPConfig(
  encryptedConfig: string,
  iv: string,
  authTag: string
): {
  env?: Record<string, string>;
} {
  return decrypt(encryptedConfig, iv, authTag);
}

/**
 * Validate encryption key format
 * Use this during server startup to validate environment
 */
export function validateEncryptionKey(): {
  valid: boolean;
  error?: string;
} {
  try {
    const key = process.env.MCP_ENCRYPTION_KEY;

    if (!key) {
      return {
        valid: false,
        error: "MCP_ENCRYPTION_KEY not set in environment",
      };
    }

    if (key.length !== 64) {
      return {
        valid: false,
        error: "MCP_ENCRYPTION_KEY must be 64 characters (32 bytes hex)",
      };
    }

    // Test encryption/decryption
    const testData = { test: "encryption test" };
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.authTag);

    if (JSON.stringify(decrypted) !== JSON.stringify(testData)) {
      return {
        valid: false,
        error: "Encryption/decryption test failed",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear references to sensitive data (defense-in-depth measure)
 *
 * IMPORTANT: This does NOT securely wipe memory!
 *
 * JavaScript strings are immutable - this function only:
 * - Overwrites object property references with dummy strings
 * - Deletes the properties
 * - Allows the original data to be garbage collected sooner
 *
 * The original sensitive strings remain in memory until GC runs.
 * Use this as one layer of defense, not as a security guarantee.
 *
 * For actual memory wiping, use Node.js Buffer objects with .fill(0).
 */
export function clearSensitiveDataReferences(data: any): void {
  if (typeof data === "object" && data !== null) {
    for (const key in data) {
      if (typeof data[key] === "string") {
        // Replace with dummy string and delete reference
        data[key] = "0".repeat(data[key].length);
        delete data[key];
      } else if (typeof data[key] === "object") {
        clearSensitiveDataReferences(data[key]);
      }
    }
  }
}
