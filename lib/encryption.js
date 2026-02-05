import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'hr-biometric-secrets';

/**
 * Get 32-byte key from ENCRYPTION_KEY env.
 * Uses SHA-256 so any length env var works; for production prefer a 32-byte (64 hex) key.
 */
function getKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw || typeof raw !== 'string') {
        throw new Error('ENCRYPTION_KEY environment variable is required for encrypting secrets');
    }
    if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    return crypto.createHash('sha256').update(raw + SALT).digest();
}

/**
 * Encrypt a plain-text secret for storage. Returns a string (iv:authTag:ciphertext in base64).
 * Use for: vendor API keys, device passwords.
 */
export function encrypt(plainText) {
    if (plainText == null || plainText === '') return null;
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt a stored secret. Input is the string from encrypt().
 * Returns null if input is null/empty or decryption fails (e.g. legacy bcrypt value).
 */
export function decrypt(cipherText) {
    if (cipherText == null || cipherText === '') return null;
    // Legacy bcrypt hashes cannot be decrypted; do not try
    if (typeof cipherText === 'string' && (cipherText.startsWith('$2a$') || cipherText.startsWith('$2b$') || cipherText.startsWith('$2y$'))) {
        return null;
    }
    try {
        const key = getKey();
        const buf = Buffer.from(cipherText, 'base64');
        if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
        const iv = buf.subarray(0, IV_LENGTH);
        const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const enc = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(tag);
        return decipher.update(enc) + decipher.final('utf8');
    } catch {
        return null;
    }
}

/**
 * Prepare device and optional vendorConfig with decrypted secrets for adapter use only.
 * Mutates and returns the device object; decrypts device.password and vendorConfig.apiKey/apiSecret.
 */
export function withDecryptedSecrets(device) {
    const decrypted = { ...device };
    if (decrypted.password) {
        const plain = decrypt(decrypted.password);
        decrypted.password = plain ?? decrypted.password;
    }
    if (decrypted.vendorConfig) {
        decrypted.vendorConfig = { ...decrypted.vendorConfig };
        if (decrypted.vendorConfig.apiKey) {
            const plain = decrypt(decrypted.vendorConfig.apiKey);
            decrypted.vendorConfig.apiKey = plain ?? decrypted.vendorConfig.apiKey;
        }
        if (decrypted.vendorConfig.apiSecret) {
            const plain = decrypt(decrypted.vendorConfig.apiSecret);
            decrypted.vendorConfig.apiSecret = plain ?? decrypted.vendorConfig.apiSecret;
        }
    }
    return decrypted;
}
