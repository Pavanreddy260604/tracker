import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const envSecret = process.env.SCRIPT_WRITER_JWT_SECRET || process.env.JWT_SECRET;
if (!envSecret) {
    throw new Error('JWT secret missing: set SCRIPT_WRITER_JWT_SECRET (or JWT_SECRET) for script-writer authentication.');
}
const JWT_SECRET: string = envSecret;

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
        }
    }
}

function extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    const alt = req.headers['x-access-token'];
    if (typeof alt === 'string' && alt.length > 0) return alt;
    return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access denied. Missing token.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; email?: string };
        if (!decoded.userId) {
            return res.status(401).json({ success: false, error: 'Invalid token payload.' });
        }
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
}
