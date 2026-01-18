import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for auth endpoints
 * Strict limits to prevent brute force attacks
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: {
        success: false,
        error: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for general API endpoints
 */
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        error: 'Too many requests. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for write operations
 */
export const writeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 writes per minute
    message: {
        success: false,
        error: 'Too many write operations. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
