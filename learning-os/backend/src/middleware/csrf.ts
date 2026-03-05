import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Enhanced Double Submit Cookie Pattern for CSRF Protection.
 * 
 * 1. Backend generates a token.
 * 2. Backend sets it as an HTTP-Only cookie.
 * 3. Backend returns the token in the response body to the frontend.
 * 4. Frontend stores the token in memory and sends it in the `X-CSRF-Token` header for mutations.
 * 5. Backend validates that the Header and the HTTP-Only cookie match.
 */

export const generateCsrfToken = (req: Request, res: Response) => {
    const token = crypto.randomUUID();
    res.cookie('csrfToken', token, {
        httpOnly: true, // Crucial: makes it protected against XSS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    return token;
};

// Auth endpoints that use their own security mechanisms (httpOnly cookies, rate limiting)
// and don't carry CSRF tokens in their requests.
const CSRF_EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
];

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    // Skip protection for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Skip CSRF for auth endpoints that use their own security mechanisms
    if (CSRF_EXEMPT_PATHS.some(path => req.path === path || req.originalUrl.endsWith(path))) {
        return next();
    }

    const cookieToken = req.cookies?.csrfToken;
    const headerToken = req.headers['x-csrf-token'];

    // If both exist and match, request is valid
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or missing CSRF token'
        });
    }

    next();
};
