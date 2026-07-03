const ITERATIONS = 100_000;

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecretKey(secretKey: string, pin: string) {
  const encoder = new TextEncoder();
  // Cast to ArrayBuffer variant to satisfy Web Crypto types
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const cryptoKey = await deriveKey(pin, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(secretKey),
  );

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  };
}

export async function decryptSecretKey(
  data: { encrypted: string; salt: string; iv: string },
  pin: string,
): Promise<string> {
  const decoder = new TextDecoder();
  const salt = Buffer.from(data.salt, 'base64') as unknown as Uint8Array<ArrayBuffer>;
  const iv = Buffer.from(data.iv, 'base64') as unknown as Uint8Array<ArrayBuffer>;
  const encrypted = Buffer.from(data.encrypted, 'base64');

  const cryptoKey = await deriveKey(pin, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted,
    );
    return decoder.decode(decrypted);
  } catch {
    throw new Error('Incorrect PIN');
  }
}