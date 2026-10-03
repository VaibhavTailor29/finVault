/**
 * WebCrypto-based Client Cryptographic utilities.
 * Implements AES-GCM, HKDF key derivation, HMAC blind indexing, and passphrase backup encryption.
 */

// Simple base64 encode/decode
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function computeBlindIndex(value: string, secretKey: string = 'finvault_client_blind_index_salt'): Promise<string> {
  const encoder = new TextEncoder();
  const normalized = value.trim().toLowerCase();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(normalized));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptBackupData(dataJson: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));

  // Derive key via PBKDF2
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: encoder.encode('finvault-backup')
    },
    key,
    encoder.encode(dataJson)
  );

  return JSON.stringify({
    version: 'finvault_enc_v1',
    salt: bufferToBase64(salt.buffer),
    nonce: bufferToBase64(nonce.buffer),
    ciphertext: bufferToBase64(ciphertext)
  });
}

export async function decryptBackupData(encryptedJson: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const parsed = JSON.parse(encryptedJson);
  const salt = new Uint8Array(base64ToBuffer(parsed.salt));
  const nonce = new Uint8Array(base64ToBuffer(parsed.nonce));
  const cipherBuffer = base64ToBuffer(parsed.ciphertext);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const aad = parsed.version === 'finvault_enc_v1'
    ? encoder.encode('finvault-backup')
    : encoder.encode('kuber-backup');

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: aad
      },
      key,
      cipherBuffer
    );
  } catch (e) {
    // If that failed, try fallback AAD
    const fallbackAad = parsed.version === 'finvault_enc_v1'
      ? encoder.encode('kuber-backup')
      : encoder.encode('finvault-backup');
    decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: fallbackAad
      },
      key,
      cipherBuffer
    );
  }

  return new TextDecoder().decode(decryptedBuffer);
}
