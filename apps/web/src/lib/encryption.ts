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

  // Import it as a CryptoKey
  return crypto.subtle.importKey(
    'raw',
    unwrappedKeyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
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
 */
export async function createKeyBundle(password: string): Promise<EncryptionKeyBundle> {
  // Generate salt for password key derivation
  const salt = generateSalt();

  // Derive key-encryption-key from password
  const kek = await deriveKeyFromPassword(password, salt);

  // Generate random data encryption key
  const dataKey = await generateDataKey();

  // Wrap the data key with the KEK
  const { wrappedKey, iv } = await wrapDataKey(dataKey, kek);

  return {
    salt: bufferToBase64(salt),
    wrappedDataKey: wrappedKey,
    wrappedKeyIV: iv,
  };
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
