/**
 * @security-audit-requested
 * AUDIT FOCUS: Client-side encryption implementation
 * - Is PBKDF2 iteration count sufficient (100000)?
 * - Is key derivation secure?
 * - Are wrapped keys properly protected?
 * - Is the recovery code system secure?
 * - Can an attacker brute-force recovery codes?
 * - Are there any key extraction vulnerabilities?
 */

/**
 * Client-Side Encryption Utility
 *
 * Provides AES-GCM encryption for conversation history.
 * Keys are derived from user password using PBKDF2.
 * All encryption happens client-side - server never sees plaintext.
 */

// Constants for encryption
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random IV for encryption
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive an encryption key from a password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the actual encryption key
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Generate a random data encryption key (DEK)
 */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // Extractable so we can wrap it
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) a data key with a key-encryption-key derived from password
 */
export async function wrapDataKey(
  dataKey: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedKey: string; iv: string }> {
  const iv = generateIV();

  // Export the data key
  const exportedKey = await crypto.subtle.exportKey('raw', dataKey);

  // Encrypt it with the KEK
  const wrappedKeyBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    kek,
    exportedKey
  );

  return {
    wrappedKey: bufferToBase64(wrappedKeyBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Unwrap (decrypt) a data key using a key-encryption-key derived from password
 */
export async function unwrapDataKey(
  wrappedKey: string,
  iv: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  const wrappedKeyBuffer = base64ToBuffer(wrappedKey);
  const ivBuffer = base64ToBuffer(iv);

  // Decrypt the wrapped key
  const unwrappedKeyBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer.buffer as ArrayBuffer },
    kek,
    wrappedKeyBuffer.buffer as ArrayBuffer
  );

  // Import it as a CryptoKey (extractable for session persistence)
  return crypto.subtle.importKey(
    'raw',
    unwrappedKeyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // Extractable to allow session storage persistence
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const iv = generateIV();
  const encodedData = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    encodedData
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bufferToBase64(combined);
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(
  encryptedData: string,
  key: CryptoKey
): Promise<string> {
  const combined = base64ToBuffer(encryptedData);

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt a JSON object
 */
export async function encryptJSON<T>(data: T, key: CryptoKey): Promise<string> {
  const json = JSON.stringify(data);
  return encrypt(json, key);
}

/**
 * Decrypt to a JSON object
 */
export async function decryptJSON<T>(encryptedData: string, key: CryptoKey): Promise<T> {
  const json = await decrypt(encryptedData, key);
  return JSON.parse(json);
}

/**
 * Check if a string is encrypted (base64 with expected length)
 */
export function isEncrypted(data: string): boolean {
  // Encrypted data is base64 and has at least IV_LENGTH + some ciphertext
  if (!data || data.length < 20) return false;

  try {
    const decoded = base64ToBuffer(data);
    return decoded.length > IV_LENGTH;
  } catch {
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// KEY STORAGE HELPERS
// ============================================================================

export interface EncryptionKeyBundle {
  salt: string;           // Salt for PBKDF2 (stored in DB)
  wrappedDataKey: string; // Data key encrypted with password-derived key (stored in DB)
  wrappedKeyIV: string;   // IV used to wrap the data key (stored in DB)
}

/**
 * Create a new encryption key bundle for a user
 * Called once when user first enables encryption
 * Returns both the bundle (for storage) and the data key (for immediate use)
 */
export async function createKeyBundle(password: string): Promise<{ bundle: EncryptionKeyBundle; dataKey: CryptoKey }> {
  // Generate salt for password key derivation
  const salt = generateSalt();

  // Derive key-encryption-key from password
  const kek = await deriveKeyFromPassword(password, salt);

  // Generate random data encryption key
  const dataKey = await generateDataKey();

  // Wrap the data key with the KEK
  const { wrappedKey, iv } = await wrapDataKey(dataKey, kek);

  const bundle: EncryptionKeyBundle = {
    salt: bufferToBase64(salt),
    wrappedDataKey: wrappedKey,
    wrappedKeyIV: iv,
  };

  return { bundle, dataKey };
}

/**
 * Unlock the data key using password
 * Called on each login
 */
export async function unlockDataKey(
  password: string,
  bundle: EncryptionKeyBundle
): Promise<CryptoKey> {
  const salt = base64ToBuffer(bundle.salt);

  // Derive the KEK from password
  const kek = await deriveKeyFromPassword(password, salt);

  // Unwrap the data key
  return unwrapDataKey(bundle.wrappedDataKey, bundle.wrappedKeyIV, kek);
}

/**
 * Re-wrap the data key with a new password (for password change)
 */
export async function rewrapKeyBundle(
  oldPassword: string,
  newPassword: string,
  oldBundle: EncryptionKeyBundle
): Promise<EncryptionKeyBundle> {
  // Unlock with old password
  const dataKey = await unlockDataKey(oldPassword, oldBundle);

  // Export the data key temporarily
  const exportedKey = await crypto.subtle.exportKey('raw', dataKey);

  // Generate new salt
  const newSalt = generateSalt();

  // Derive new KEK
  const newKek = await deriveKeyFromPassword(newPassword, newSalt);

  // Re-import data key as extractable
  const extractableDataKey = await crypto.subtle.importKey(
    'raw',
    exportedKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  // Wrap with new KEK
  const { wrappedKey, iv } = await wrapDataKey(extractableDataKey, newKek);

  return {
    salt: bufferToBase64(newSalt),
    wrappedDataKey: wrappedKey,
    wrappedKeyIV: iv,
  };
}

// ============================================================================
// RECOVERY CODE SYSTEM
// ============================================================================

const RECOVERY_CODE_LENGTH = 12; // Format: XXXX-XXXX-XXXX
const RECOVERY_CODE_COUNT = 12;  // Generate 12 codes

/**
 * Generate a single recovery code in format XXXX-XXXX-XXXX
 */
function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding ambiguous: 0, O, I, 1
  const randomValues = crypto.getRandomValues(new Uint8Array(12));

  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      code += '-';
    }
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}

/**
 * Generate multiple recovery codes
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  const usedCodes = new Set<string>();

  while (codes.length < count) {
    const code = generateRecoveryCode();
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      codes.push(code);
    }
  }

  return codes;
}

/**
 * Hash a recovery code for server storage (server stores hash, not plaintext)
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  // Normalize the code (remove dashes, uppercase)
  const normalized = code.replace(/-/g, '').toUpperCase();
  const encoded = new TextEncoder().encode(normalized);

  // SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToBase64(hashBuffer);
}

/**
 * Hash multiple recovery codes for server storage
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(hashRecoveryCode));
}

export interface RecoveryCodeBundle {
  // Stored on server (hashed codes + wrapped keys per code)
  codeHashes: string[];           // SHA-256 hashes of codes
  wrappedKeys: {                  // Data key wrapped with each code
    codeHash: string;             // Which code this wrapping corresponds to
    wrappedKey: string;           // Data key encrypted with code-derived key
    salt: string;                 // Salt for PBKDF2 derivation from code
    iv: string;                   // IV for wrapping
  }[];
  createdAt: string;              // ISO timestamp
  usedCodes: string[];            // Hashes of codes that have been used
}

/**
 * Create recovery code bundle for a user
 * Returns plaintext codes (show to user) and bundle (store on server)
 */
export async function createRecoveryCodeBundle(
  dataKey: CryptoKey
): Promise<{ codes: string[]; bundle: RecoveryCodeBundle }> {
  // Generate plaintext recovery codes
  const codes = generateRecoveryCodes();

  // Hash the codes for storage
  const codeHashes = await hashRecoveryCodes(codes);

  // Export data key for wrapping
  const exportedDataKey = await crypto.subtle.exportKey('raw', dataKey);
  const extractableDataKey = await crypto.subtle.importKey(
    'raw',
    exportedDataKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // Extractable
    ['encrypt', 'decrypt']
  );

  // Wrap the data key with each recovery code
  const wrappedKeys = await Promise.all(
    codes.map(async (code, index) => {
      // Normalize code for key derivation
      const normalized = code.replace(/-/g, '').toUpperCase();
      const salt = generateSalt();

      // Derive KEK from recovery code
      const kek = await deriveKeyFromPassword(normalized, salt);

      // Wrap the data key
      const { wrappedKey, iv } = await wrapDataKey(extractableDataKey, kek);

      return {
        codeHash: codeHashes[index],
        wrappedKey,
        salt: bufferToBase64(salt),
        iv,
      };
    })
  );

  const bundle: RecoveryCodeBundle = {
    codeHashes,
    wrappedKeys,
    createdAt: new Date().toISOString(),
    usedCodes: [],
  };

  return { codes, bundle };
}

/**
 * Recover data key using a recovery code
 * Returns the unwrapped data key if successful
 */
export async function recoverWithCode(
  code: string,
  bundle: RecoveryCodeBundle
): Promise<{ dataKey: CryptoKey; codeHash: string } | null> {
  // Hash the provided code
  const codeHash = await hashRecoveryCode(code);

  // Check if this code has been used
  if (bundle.usedCodes.includes(codeHash)) {
    throw new Error('This recovery code has already been used');
  }

  // Find the wrapped key for this code
  const wrappedKeyEntry = bundle.wrappedKeys.find(wk => wk.codeHash === codeHash);
  if (!wrappedKeyEntry) {
    return null; // Invalid code
  }

  try {
    // Derive KEK from recovery code
    const normalized = code.replace(/-/g, '').toUpperCase();
    const salt = base64ToBuffer(wrappedKeyEntry.salt);
    const kek = await deriveKeyFromPassword(normalized, salt);

    // Unwrap the data key
    const dataKey = await unwrapDataKey(
      wrappedKeyEntry.wrappedKey,
      wrappedKeyEntry.iv,
      kek
    );

    return { dataKey, codeHash };
  } catch (err) {
    console.error('[Recovery] Failed to recover with code:', err);
    return null;
  }
}

/**
 * Mark a recovery code as used (after successful recovery)
 */
export function markRecoveryCodeUsed(
  bundle: RecoveryCodeBundle,
  codeHash: string
): RecoveryCodeBundle {
  return {
    ...bundle,
    usedCodes: [...bundle.usedCodes, codeHash],
  };
}

/**
 * Get count of remaining (unused) recovery codes
 */
export function getRemainingRecoveryCodeCount(bundle: RecoveryCodeBundle): number {
  return bundle.codeHashes.length - bundle.usedCodes.length;
}
