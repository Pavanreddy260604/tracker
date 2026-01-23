import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// Security: Require encryption key from environment - no fallback allowed
function getValidatedEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
        throw new Error(
            '❌ CRITICAL: ENCRYPTION_KEY environment variable is required.\n' +
            '   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"'
        );
    }

    if (key.length !== 32) {
        throw new Error(
            `❌ CRITICAL: ENCRYPTION_KEY must be exactly 32 characters. Got ${key.length}.`
        );
    }

    return key;
}

const ENCRYPTION_KEY = getValidatedEncryptionKey();

export function encrypt(text: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex')
    };
}

export function decrypt(encryptedData: string, iv: string) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
