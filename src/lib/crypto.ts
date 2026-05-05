/**
 * Cryptography utilities for WhisperBox E2EE.
 * Uses Web Crypto API for RSA-OAEP, AES-GCM, and AES-KW.
 */

// Helper: Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Step 1: Generate RSA-OAEP 2048-bit keypair
 */
export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Step 2: Derive a wrapping key from password using PBKDF2 -> AES-KW
 */
export async function deriveWrappingKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(saltBase64);
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

/**
 * Step 3: Wrap the RSA private key with AES-KW
 */
export async function wrapPrivateKey(privateKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await window.crypto.subtle.wrapKey(
    "pkcs8",
    privateKey,
    wrappingKey,
    { name: "AES-GCM", iv: iv }
  );
  
  const combined = new Uint8Array(iv.length + wrapped.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(wrapped), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

/**
 * Step 4: Unwrap the RSA private key
 */
export async function unwrapPrivateKey(wrappedKeyBase64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const combined = new Uint8Array(base64ToArrayBuffer(wrappedKeyBase64));
  const iv = combined.slice(0, 12);
  const wrapped = combined.slice(12);
  
  return await window.crypto.subtle.unwrapKey(
    "pkcs8",
    wrapped.buffer,
    wrappingKey,
    { name: "AES-GCM", iv: iv },
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

/**
 * Export RSA public key as Base64 (spki)
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import RSA public key from Base64
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(publicKeyBase64);
  return await window.crypto.subtle.importKey(
    "spki",
    buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

/**
 * Message Encryption (Hybrid)
 * 1. Generate random AES-GCM key (256-bit) and IV (96-bit)
 * 2. Encrypt plaintext with AES-GCM
 * 3. Encrypt AES key with recipient's RSA public key
 * 4. Encrypt AES key with sender's RSA public key (for self)
 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<{
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}> {
  // 1. Generate random AES key and IV
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Encrypt plaintext
  const encoder = new TextEncoder();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encoder.encode(plaintext)
  );

  // 3. Encrypt AES key (as raw bytes) with RSA keys
  const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);
  
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    aesKeyRaw
  );

  const encryptedKeyForSelfBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPublicKey,
    aesKeyRaw
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
    encryptedKeyForSelf: arrayBufferToBase64(encryptedKeyForSelfBuffer),
  };
}

/**
 * Message Decryption
 * 1. Decrypt the AES key using user's RSA private key
 * 2. Decrypt the ciphertext using the AES key + IV
 */
export async function decryptMessage(
  payload: { ciphertext: string; iv: string; encryptedKey: string; encryptedKeyForSelf?: string },
  privateKey: CryptoKey,
  isSender: boolean = false
): Promise<string> {
  const keyToUse = isSender ? payload.encryptedKeyForSelf : payload.encryptedKey;
  if (!keyToUse) throw new Error("Missing encrypted key for decryption");

  // 1. Decrypt AES key
  const aesKeyRaw = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(keyToUse)
  );

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // 2. Decrypt content
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(payload.iv) },
    aesKey,
    base64ToArrayBuffer(payload.ciphertext)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
