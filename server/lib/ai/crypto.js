// AES-256-GCM encryption of the users' API keys. The master key comes from AI_ENCRYPTION_KEY (or ai.encryptionKey);
// without it the AI features are disabled.
import crypto from 'crypto';
import config from '../config.js';

function getMasterKey() {
    const secret = process.env.AI_ENCRYPTION_KEY || (config.ai && config.ai.encryptionKey);
    if (!secret) {
        return null;
    }
    // Any sufficiently long secret works: it is stretched to 32 bytes
    return crypto.createHash('sha256').update(String(secret)).digest();
}

function isConfigured() {
    return getMasterKey() !== null;
}

function encrypt(plain) {
    const key = getMasterKey();
    if (!key) {
        throw new Error('AI_ENCRYPTION_KEY is not configured');
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

function decrypt(payload) {
    const key = getMasterKey();
    if (!key) {
        throw new Error('AI_ENCRYPTION_KEY is not configured');
    }
    const [iv, tag, data] = payload.split('.').map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export { isConfigured, encrypt, decrypt };
