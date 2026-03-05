import crypto from 'crypto';
import { getRequiredEnv } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';

const getValidatedEncryptionKey = (): string => {
    const key = getRequiredEnv('ENCRYPTION_KEY');

    if (key.length !== 32) {
        throw new Error(
            `[encryption] ENCRYPTION_KEY must be exactly 32 characters. Got ${key.length}.`
        );
    }

    return key;
};

const ENCRYPTION_KEY = getValidatedEncryptionKey();

export function encrypt(text: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex'),
    };
}

export function decrypt(encryptedData: string, iv: string) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY),
        Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
