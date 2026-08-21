/**
 * Vault encryption: AES-GCM with a PBKDF2-derived key.
 *
 * ── Iteration count ──
 * SECURITY_Rulebook §2c.6 sets PBKDF2-HMAC-SHA-256 at 600,000 iterations. This
 * file shipped at 100,000, which was the OWASP figure of an earlier era. The
 * gap matters more here than it would for a password, because the secret being
 * stretched is a short numeric PIN: the whole cost of a guess IS the KDF, so
 * the iteration count is very nearly the entire work factor (§1a.9).
 *
 * Existing vault rows were encrypted at 100,000 and there is no stored
 * iteration field to read, so the count cannot simply be raised — every saved
 * entry would fail to decrypt. Instead:
 *   • Everything written from now on uses PBKDF2_ITERATIONS (600,000).
 *   • decryptData tries that first, then retries at LEGACY_ITERATIONS.
 *   • The retry is only reached when the modern attempt fails, so it costs
 *     nothing on new data and cannot be used to force the weaker parameter —
 *     an attacker with the ciphertext gets to choose their own KDF cost anyway.
 * Re-saving an entry silently upgrades it. `decryptData` reports which cost
 * actually worked so a caller can drive that upgrade.
 *
 * Note the remaining limit, which no iteration count fixes: a 6-digit PIN is
 * 10^6 possibilities. 600,000 iterations makes an offline sweep expensive, not
 * impossible. Raising the PIN length or adding a server-side check is the real
 * ceiling here, and it is a product decision, not a crypto one.
 */

/** Current cost for everything written from now on (§2c.6). */
const PBKDF2_ITERATIONS = 600_000;
/** The cost every vault row written before this change used. Read-only path. */
const LEGACY_ITERATIONS = 100_000;

// Derive a CryptoKey from the master password using PBKDF2
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
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
      salt: salt.buffer as ArrayBuffer,
      iterations,
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
  // A fresh salt and a fresh IV per record: AES-GCM loses all confidentiality
  // guarantees if an IV is ever reused under the same key (§2f.5), and both
  // come from the platform CSPRNG (§2f.4).
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(plaintext),
  );
  return {
    encrypted: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/**
 * Decrypt at the current cost, falling back to the legacy cost for rows written
 * before the bump. `legacy` is true when the fallback is what worked, so the
 * caller can re-save the record and retire the old parameters.
 */
export async function decryptDataDetailed(
  encryptedB64: string,
  ivB64: string,
  saltB64: string,
  password: string,
): Promise<{ plaintext: string; legacy: boolean }> {
  const dec = new TextDecoder();
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const data = fromBase64(encryptedB64);

  const attempt = async (iterations: number) => {
    const key = await deriveKey(password, salt, iterations);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      data.buffer as ArrayBuffer,
    );
    return dec.decode(decrypted);
  };

  try {
    return { plaintext: await attempt(PBKDF2_ITERATIONS), legacy: false };
  } catch {
    // AES-GCM authenticates, so a wrong key throws rather than returning
    // garbage — the failure above is a genuine "not this key", which for an
    // old record means the wrong iteration count. Anything still failing here
    // propagates, so a bad PIN is still a rejection (§2h.2, fail closed).
    return { plaintext: await attempt(LEGACY_ITERATIONS), legacy: true };
  }
}

export async function decryptData(
  encryptedB64: string,
  ivB64: string,
  saltB64: string,
  password: string,
): Promise<string> {
  const { plaintext } = await decryptDataDetailed(
    encryptedB64,
    ivB64,
    saltB64,
    password,
  );
  return plaintext;
}

// Encrypt a known test string with the PIN — used to verify PIN later
export async function createPinVerifier(
  pin: string,
): Promise<{ verifier: string; iv: string; salt: string }> {
  const result = await encryptData("TYUNNIE_VAULT_OK", pin);
  return {
    verifier: result.encrypted,
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

// ── Base64 helpers ──
// `String.fromCharCode(...bytes)` spreads one argument per byte and throws
// RangeError once a record is large enough to blow the call-stack limit. A
// vault note is small today, but a crypto primitive that fails on big input is
// a correctness bug waiting for the first long entry (§2l.7 in spirit).

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
