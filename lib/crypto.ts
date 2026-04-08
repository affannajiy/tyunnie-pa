// Derive a CryptoKey from the master password using PBKDF2
async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer, // ← cast here
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptData(
  plaintext: string,
  password: string,
): Promise<{ encrypted: string; iv: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, // ← cast here
    key,
    enc.encode(plaintext),
  );
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function decryptData(
  encryptedB64: string,
  ivB64: string,
  saltB64: string,
  password: string,
): Promise<string> {
  const dec = new TextDecoder();
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, // ← cast here
    key,
    data.buffer as ArrayBuffer, // ← cast here
  );
  return dec.decode(decrypted);
}

// Encrypt a known test string with the PIN — used to verify PIN later
export async function createPinVerifier(
  pin: string,
): Promise<{ verifier: string; iv: string; salt: string }> {
  const result = await encryptData("TYUNNIE_VAULT_OK", pin);
  return {
    verifier: result.encrypted, // ← rename encrypted → verifier
    iv: result.iv,
    salt: result.salt,
  };
}

// Returns true if the PIN correctly decrypts the verifier
export async function verifyPin(
  pin: string,
  verifier: string,
  iv: string,
  salt: string,
): Promise<boolean> {
  try {
    const result = await decryptData(verifier, iv, salt, pin);
    return result === "TYUNNIE_VAULT_OK";
  } catch {
    return false;
  }
}
