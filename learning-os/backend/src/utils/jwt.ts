import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { getOptionalEnv, getRequiredEnv } from '../config/env.js';

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_EXPIRES_IN = (getOptionalEnv('JWT_EXPIRES_IN', '15m') || '15m') as SignOptions['expiresIn'];
const JWT_ISSUER = getOptionalEnv('JWT_ISSUER');

import crypto from 'crypto';

/**
 * Generates a secure random refresh token string (UUID v4)
 */
export const generateRefreshToken = (): string => {
    return crypto.randomUUID();
};

/**
 * Creates a SHA-256 hash of a string to store securely in database
 */
export const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};


const jwtPayloadSchema = z.object({
    userId: z.string().min(1),
    email: z.string().email(),
});

export interface JWTPayload {
    userId: string;
    email: string;
}

/**
 * Generate JWT token for authenticated user
 */
export const generateToken = (payload: JWTPayload): string => {
    const parsedPayload = jwtPayloadSchema.parse(payload);

    const options: SignOptions = {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256',
    };

    if (JWT_ISSUER) {
        options.issuer = JWT_ISSUER;
    }

    return jwt.sign(parsedPayload, JWT_SECRET, options);
};

/**
 * Verify JWT token and return payload
 * Throws error if invalid or expired
 */
export const verifyToken = (token: string): JWTPayload => {
    try {
        const verifyOptions: jwt.VerifyOptions = {
            algorithms: ['HS256'],
        };
        if (JWT_ISSUER) {
            verifyOptions.issuer = JWT_ISSUER;
        }

        const decoded = jwt.verify(token, JWT_SECRET, verifyOptions);
        const parsed = jwtPayloadSchema.safeParse(decoded);

        if (!parsed.success) {
            throw new Error('Invalid token payload');
        }

        return parsed.data;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw error;
    }
};

/**
 * Extract token from Authorization header
 * Format: "Bearer <token>"
 */
export const extractToken = (authHeader: string | undefined): string | null => {
    if (!authHeader) {
        return null;
    }

    const [scheme, token] = authHeader.trim().split(/\s+/);
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token;
};
