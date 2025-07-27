const CryptoJS = require('crypto-js');

// IMPORTANT: Store this key securely in your environment variables
const secretKey = process.env.CRYPTO_SECRET_KEY || 'default-super-secret-key-that-is-long-and-random';

if (process.env.NODE_ENV !== 'test' && secretKey === 'default-super-secret-key-that-is-long-and-random') {
  console.warn('WARNING: Using default encryption key. Please set CRYPTO_SECRET_KEY in your .env file for production.');
}

/**
 * Encrypts a text string.
 * @param {string} text The text to encrypt.
 * @returns {string} The encrypted text.
 */
const encrypt = (text) => {
  if (text === null || text === undefined) return null;
  return CryptoJS.AES.encrypt(text.toString(), secretKey).toString();
};

/**
 * Decrypts an encrypted text string.
 * @param {string} ciphertext The text to decrypt.
 * @returns {string} The decrypted text.
 */
const decrypt = (ciphertext) => {
  if (ciphertext === null || ciphertext === undefined) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    console.error("Decryption failed:", error);
    return null; // Or handle the error as needed
  }
};

module.exports = {
  encrypt,
  decrypt,
};