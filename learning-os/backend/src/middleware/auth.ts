import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from '../utils/jwt.js';
import { User, IUser } from '../models/User.js';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
            userId?: string;
        }
    }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Extract token from Authorization header
        const token = extractToken(req.headers.authorization);

        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.',
            });
            return;
        }

        // Verify token
        const payload = verifyToken(token);

        // Find user
        const user = await User.findById(payload.userId).select('-passwordHash');

        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid token. User not found.',
            });
            return;
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id.toString();

        next();
    } catch (error) {
        const message = error instanceof Error && error.message === 'Token expired'
            ? 'Token expired'
            : 'Authentication failed';

        res.status(401).json({
            success: false,
            error: message,
        });
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = extractToken(req.headers.authorization);

        if (token) {
            const payload = verifyToken(token);
            const user = await User.findById(payload.userId);
            if (user) {
                req.user = user;
                req.userId = user._id.toString();
            }
        }

        next();
    } catch {
        // Silently continue without user if token is invalid
        next();
    }
};
