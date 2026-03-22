import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { generateToken, generateRefreshToken, hashToken } from '../utils/jwt.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { DailyLog } from '../models/DailyLog.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { BackendTopic } from '../models/BackendTopic.js';
import { ProjectStudy } from '../models/ProjectStudy.js';
import { ChatSession } from '../models/ChatSession.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { RoadmapNode } from '../models/RoadmapNode.js';
import { RoadmapEdge } from '../models/RoadmapEdge.js';
import { Subscription } from '../models/Subscription.js';
import { UserActivity } from '../models/UserActivity.js';
import { emailService } from '../services/email.service.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { encrypt } from '../utils/encryption.js';
import crypto from 'crypto';

const router = Router();

// Validation schemas
const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: z.string().email('Invalid email format'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    timezone: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

const aiKeySchema = z.object({
    apiKey: z.string().trim().min(1, 'API Key is required').max(500, 'API Key is too long'),
}).strict();

const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: registerSchema.shape.password,
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: registerSchema.shape.password,
});

const verifyEmailSchema = z.object({
    code: z.string().length(6, 'Verification code must be 6 digits'),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * GET /api/auth/csrf
 * Generate and return a CSRF token for the frontend
 */
router.get('/csrf', (req: Request, res: Response) => {
    const token = generateCsrfToken(req, res);
    res.json({ success: true, token });
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', authLimiter, async (req: Request, res: Response) => {
    try {
        // Validate input
        const result = registerSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: result.error.errors[0].message,
            });
            return;
        }

        const { name, email, password, timezone } = result.data;
        const normalizedEmail = normalizeEmail(email);

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Email already registered',
            });
        }

        const verificationCode = crypto.randomInt(100000, 999999).toString();

        // Create user (password will be hashed by pre-save hook)
        const user = new User({
            name,
            email: normalizedEmail,
            passwordHash: password, // Will be hashed by pre-save middleware
            timezone: timezone || 'Asia/Kolkata',
            emailVerified: false,
            verificationToken: crypto.createHash('sha256').update(verificationCode).digest('hex'),
            verificationExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        });

        await user.save();

        // Send verification email in the background
        emailService.sendVerificationEmail(user.email, verificationCode).catch(e => {
            console.error('Failed to send verification email:', e);
        });

        // Generate token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
        });

        const refreshToken = generateRefreshToken();
        await RefreshToken.create({
            userId: user._id,
            token: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            success: true,
            data: {
                user: user.toJSON(),
                token,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed',
        });
    }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
    try {
        // Validate input
        const result = loginSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: result.error.errors[0].message,
            });
            return;
        }

        const { email, password } = result.data;
        const normalizedEmail = normalizeEmail(email);

        // Find user
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
            return;
        }

        // Compare password
        const isValid = await user.comparePassword(password);
        if (!isValid) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
            return;
        }

        // Generate token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
        });

        const refreshToken = generateRefreshToken();
        await RefreshToken.create({
            userId: user._id,
            token: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.json({
            success: true,
            data: {
                user: user.toJSON(),
                token,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
        });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using httpOnly cookie refresh token
 */
export const refreshTokenHandler = async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            res.status(401).json({ success: false, error: 'No refresh token provided' });
            return;
        }

        const hashedToken = hashToken(refreshToken);
        const storedToken = await RefreshToken.findOne({ token: hashedToken });

        if (!storedToken) {
            res.clearCookie('refreshToken');
            res.status(401).json({ success: false, error: 'Invalid refresh token' });
            return;
        }

        if (new Date() > storedToken.expiresAt) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            res.clearCookie('refreshToken');
            res.status(401).json({ success: false, error: 'Refresh token expired' });
            return;
        }

        const user = await User.findById(storedToken.userId);
        if (!user) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            res.clearCookie('refreshToken');
            res.status(401).json({ success: false, error: 'User not found' });
            return;
        }

        // Token is valid; let's rotate it
        await RefreshToken.deleteOne({ _id: storedToken._id });

        const newAccessToken = generateToken({
            userId: user._id.toString(),
            email: user.email,
        });

        const newRefreshToken = generateRefreshToken();
        await RefreshToken.create({
            userId: user._id,
            token: hashToken(newRefreshToken),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.json({
            success: true,
            data: {
                token: newAccessToken,
                user: user.toJSON()
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ success: false, error: 'Failed to refresh token' });
    }
};

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            const hashedToken = hashToken(refreshToken);
            await RefreshToken.deleteOne({ token: hashedToken });
        }
        res.clearCookie('refreshToken');
        res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: 'Failed to logout' });
    }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user?.toJSON(),
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user',
        });
    }
});

const updateProfileSchema = z.object({
    name: z.string().min(2).max(50).optional(),
    timezone: z.string().optional(),
    targets: z.object({
        dsa: z.number().min(0).max(24),
        backend: z.number().min(0).max(24),
        project: z.number().min(0).max(24),
    }).optional(),
    scriptInterests: z.object({
        directors: z.array(z.string()),
        genres: z.array(z.string()),
        styles: z.array(z.string()),
    }).optional(),
});

/**
 * PUT /api/auth/profile
 * Update user profile (name, timezone, targets)
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
    try {
        const result = updateProfileSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: result.data },
            { new: true, runValidators: true }
        );

        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }

        res.json({ success: true, data: { user } });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

/**
 * PUT /api/auth/ai-key
 * Securely update Gemini API key
 */
router.put('/ai-key', authenticate, async (req: Request, res: Response) => {
    try {
        const result = aiKeySchema.safeParse(req.body ?? {});
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error.errors[0].message,
            });
        }
        const { apiKey } = result.data;

        const { iv, encryptedData } = encrypt(apiKey);

        const user = await User.findByIdAndUpdate(
            req.userId,
            {
                $set: {
                    geminiApiKey: encryptedData,
                    encryptionIV: iv
                }
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: { message: 'AI Key updated securely' } });
    } catch (error) {
        console.error('Update AI key error:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI key' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
    try {
        const result = forgotPasswordSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error.errors[0].message });
        }

        const email = normalizeEmail(result.data.email);
        const user = await User.findOne({ email });

        // Always return success even if user not found (security best practice)
        if (!user) {
            return res.json({ success: true, data: { message: 'If an account exists, a reset link was sent' } });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        await PasswordReset.create({
            userId: user._id,
            tokenHash,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        });

        // E.g. http://localhost:5173/reset-password?token=abcdef
        const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        await emailService.sendPasswordResetEmail(user.email, resetUrl);

        res.json({ success: true, data: { message: 'If an account exists, a reset link was sent' } });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, error: 'Failed to process request' });
    }
});

/**
 * POST /api/auth/reset-password
 * Complete password reset using token
 */
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
    try {
        const result = resetPasswordSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error.errors[0].message });
        }

        const { token, password } = result.data;
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const resetRecord = await PasswordReset.findOne({
            tokenHash,
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!resetRecord) {
            return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
        }

        const user = await User.findById(resetRecord.userId);
        if (!user) {
            return res.status(400).json({ success: false, error: 'User not found' });
        }

        user.passwordHash = password; // Will be hashed by pre-save middleware
        await user.save();

        resetRecord.used = true;
        await resetRecord.save();

        // Optional: Revoke all existing refresh tokens here to force re-login everywhere
        await RefreshToken.deleteMany({ userId: user._id });

        res.json({ success: true, data: { message: 'Password has been reset successfully' } });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

/**
 * PUT /api/auth/change-password
 * Change password when already logged in
 */
router.put('/change-password', authenticate, async (req: Request, res: Response) => {
    try {
        const result = changePasswordSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error.errors[0].message });
        }

        const { currentPassword, newPassword } = result.data;

        // Using user from DB to access passwordHash
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Incorrect current password' });
        }

        user.passwordHash = newPassword; // Handled by pre-save hook
        await user.save();

        // Optional: Revoke other sessions
        await RefreshToken.deleteMany({
            userId: user._id,
            token: { $ne: hashToken(req.cookies?.refreshToken || '') }
        });

        res.json({ success: true, data: { message: 'Password changed successfully' } });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

/**
 * POST /api/auth/verify-email
 * Verifies a 6-digit code for the authenticated user
 */
router.post('/verify-email', authenticate, authLimiter, async (req: Request, res: Response) => {
    try {
        const result = verifyEmailSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error.errors[0].message });
        }

        const { code } = result.data;
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.emailVerified) {
            return res.json({ success: true, data: { message: 'Email already verified', user: user.toJSON() } });
        }

        if (!user.verificationToken || !user.verificationExpiry) {
            return res.status(400).json({ success: false, error: 'No verification pending' });
        }

        if (new Date() > user.verificationExpiry) {
            return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
        }

        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        if (hashedCode !== user.verificationToken) {
            return res.status(400).json({ success: false, error: 'Invalid verification code' });
        }

        // Code is valid
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationExpiry = undefined;
        await user.save();

        res.json({ success: true, message: 'Email verified successfully', data: { user } });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, error: 'Failed to verify email' });
    }
});

/**
 * POST /api/auth/resend-verification
 * Resends a 6-digit generic email code
 */
router.post('/resend-verification', authenticate, authLimiter, async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ success: false, error: 'Email already verified' });
        }

        // Prevent spamming
        if (user.verificationExpiry && new Date(user.verificationExpiry.getTime() - 14 * 60 * 1000) > new Date()) {
            return res.status(429).json({ success: false, error: 'Please wait a minute before requesting another code' });
        }

        const verificationCode = crypto.randomInt(100000, 999999).toString();

        user.verificationToken = crypto.createHash('sha256').update(verificationCode).digest('hex');
        user.verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        await user.save();

        await emailService.sendVerificationEmail(user.email, verificationCode);

        res.json({ success: true, data: { message: 'Verification code sent' } });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ success: false, error: 'Failed to resend verification code' });
    }
});

/**
 * GET /api/auth/export
 * Export all user data
 */
router.get('/export', authenticate, async (req: Request, res: Response) => {
    try {
        const [dailyLogs, dsaProblems, backendTopics, projectStudies] = await Promise.all([
            DailyLog.find({ userId: req.userId }).lean(),
            DSAProblem.find({ userId: req.userId }).lean(),
            BackendTopic.find({ userId: req.userId }).lean(),
            ProjectStudy.find({ userId: req.userId }).lean(),
        ]);

        const exportData = {
            user: req.user?.toJSON(),
            dailyLogs,
            dsaProblems,
            backendTopics,
            projectStudies,
            exportedAt: new Date().toISOString(),
        };

        res.json({ success: true, data: exportData });
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

/**
 * DELETE /api/auth/account
 * Delete user account and all data
 */
router.delete('/account', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        await Promise.all([
            User.findByIdAndDelete(userId),
            DailyLog.deleteMany({ userId }),
            DSAProblem.deleteMany({ userId }),
            BackendTopic.deleteMany({ userId }),
            ProjectStudy.deleteMany({ userId }),
            ChatSession.deleteMany({ userId }),
            InterviewSession.deleteMany({ userId }),
            RefreshToken.deleteMany({ userId }),
            PasswordReset.deleteMany({ userId }),
            RoadmapNode.deleteMany({ userId }),
            RoadmapEdge.deleteMany({ userId }),
            UserActivity.deleteMany({ userId }),
            Subscription.deleteMany({ userId }),
        ]);

        res.clearCookie('refreshToken');
        res.json({ success: true, data: { message: 'Account deleted successfully' } });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete account' });
    }
});

export default router;
