import CryptoJS from 'crypto-js';

export type EncryptedPayload = {
  ct: string;
  iv: string;
  s: string;
};

export function encryptNoteContent(content: string, password: string) {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256
  });

  const encrypted = CryptoJS.AES.encrypt(content, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  const payload: EncryptedPayload = {
    ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    iv: CryptoJS.enc.Hex.stringify(iv),
    s: CryptoJS.enc.Hex.stringify(salt)
  };

  return JSON.stringify(payload);
}

export function decryptNoteContent(payloadString: string, password: string) {
  const payload = JSON.parse(payloadString) as EncryptedPayload;

  const salt = CryptoJS.enc.Hex.parse(payload.s);
  const iv = CryptoJS.enc.Hex.parse(payload.iv);

  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256
  });

  const decrypted = CryptoJS.AES.decrypt(
    {
      ciphertext: CryptoJS.enc.Base64.parse(payload.ct)
    } as CryptoJS.lib.CipherParams,
    key,
    {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );

  const result = decrypted.toString(CryptoJS.enc.Utf8);
  if (!result) {
    throw new Error('Invalid password');
  }

  return result;
}

export function isEncryptedContent(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedPayload>;
    return Boolean(parsed.ct && parsed.iv && parsed.s);
  } catch {
    return false;
  }
}
