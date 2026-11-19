// Criptografia de tokens Meta (AES-256-GCM)
// Requer: META_TOKEN_ENCRYPTION_KEY no Vercel (32 bytes hex = 64 chars)
// Gere com: openssl rand -hex 32

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.META_TOKEN_ENCRYPTION_KEY || '';
const KEY = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null;
const IV_LENGTH = 12; // GCM recommended
const TAG_LENGTH = 16;

function checkKey() {
  if (!KEY || KEY.length !== 32) {
    throw new Error('META_TOKEN_ENCRYPTION_KEY inválida (precisa ser 32 bytes hex = 64 chars). Gere com: openssl rand -hex 32');
  }
}

function encrypt(plaintext) {
  checkKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: iv:ciphertext:tag (todos em base64)
  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${tag.toString('base64')}`;
}

function decrypt(encrypted) {
  checkKey();
  const [ivB64, ciphertextB64, tagB64] = encrypted.split(':');
  if (!ivB64 || !ciphertextB64 || !tagB64) {
    throw new Error('Formato de token criptografado inválido');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };