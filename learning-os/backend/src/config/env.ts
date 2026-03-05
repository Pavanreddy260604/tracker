import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV_VALUES = new Set(['development', 'test', 'production']);
const REQUIRED_APP_ENV = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'] as const;

const readEnv = (key: string): string | undefined => {
    const value = process.env[key];
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

export const getRequiredEnv = (key: string): string => {
    const value = readEnv(key);
    if (!value) {
        throw new Error(`[ENV] Missing required environment variable: ${key}`);
    }
    return value;
};

export const getOptionalEnv = (key: string, fallback?: string): string | undefined => {
    const value = readEnv(key);
    if (value !== undefined) return value;
    return fallback;
};

const validateRequiredEnv = () => {
    const missing = REQUIRED_APP_ENV.filter((key) => !readEnv(key));
    if (missing.length > 0) {
        throw new Error(`[ENV] Missing required environment variables: ${missing.join(', ')}`);
    }
};

const validateNodeEnv = (nodeEnv: string) => {
    if (!NODE_ENV_VALUES.has(nodeEnv)) {
        throw new Error(
            `[ENV] Invalid NODE_ENV "${nodeEnv}". Allowed values: ${Array.from(NODE_ENV_VALUES).join(', ')}`
        );
    }
};

const validateSecretConstraints = () => {
    const encryptionKey = getRequiredEnv('ENCRYPTION_KEY');
    if (encryptionKey.length !== 32) {
        throw new Error(
            `[ENV] ENCRYPTION_KEY must be exactly 32 characters. Got ${encryptionKey.length}.`
        );
    }

    const jwtSecret = getRequiredEnv('JWT_SECRET');
    if (jwtSecret.length < 32) {
        throw new Error('[ENV] JWT_SECRET must be at least 32 characters.');
    }
};

export interface AppEnv {
    NODE_ENV: 'development' | 'test' | 'production';
    PORT: string;
    FRONTEND_URL: string;
    MONGODB_URI: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_ISSUER?: string;
    ENCRYPTION_KEY: string;
    PISTON_BASE_URL?: string;
    PISTON_FALLBACK_BASE_URLS?: string;
    PISTON_API_KEY?: string;
    PISTON_API_KEY_HEADER?: string;
    PISTON_API_KEY_PREFIX?: string;
    PISTON_TIMEOUT_MS?: string;
}

export const validateAppEnv = (): AppEnv => {
    validateRequiredEnv();

    const nodeEnv = (getOptionalEnv('NODE_ENV', 'development') as AppEnv['NODE_ENV']);
    validateNodeEnv(nodeEnv);
    validateSecretConstraints();

    return {
        NODE_ENV: nodeEnv,
        PORT: getOptionalEnv('PORT', '5000') || '5000',
        FRONTEND_URL: getOptionalEnv('FRONTEND_URL', 'http://localhost:5173') || 'http://localhost:5173',
        MONGODB_URI: getRequiredEnv('MONGODB_URI'),
        JWT_SECRET: getRequiredEnv('JWT_SECRET'),
        JWT_EXPIRES_IN: getOptionalEnv('JWT_EXPIRES_IN', '7d') || '7d',
        JWT_ISSUER: getOptionalEnv('JWT_ISSUER'),
        ENCRYPTION_KEY: getRequiredEnv('ENCRYPTION_KEY'),
        PISTON_BASE_URL: getOptionalEnv('PISTON_BASE_URL'),
        PISTON_FALLBACK_BASE_URLS: getOptionalEnv('PISTON_FALLBACK_BASE_URLS'),
        PISTON_API_KEY: getOptionalEnv('PISTON_API_KEY'),
        PISTON_API_KEY_HEADER: getOptionalEnv('PISTON_API_KEY_HEADER'),
        PISTON_API_KEY_PREFIX: getOptionalEnv('PISTON_API_KEY_PREFIX'),
        PISTON_TIMEOUT_MS: getOptionalEnv('PISTON_TIMEOUT_MS'),
    };
};
