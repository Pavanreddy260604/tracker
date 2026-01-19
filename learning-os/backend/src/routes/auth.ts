import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { DailyLog } from '../models/DailyLog.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { BackendTopic } from '../models/BackendTopic.js';
import { ProjectStudy } from '../models/ProjectStudy.js';
import { encrypt } from '../utils/encryption.js';

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

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'Email already registered',
            });
            return;
        }

        // Create user (password will be hashed by pre-save hook)
        const user = new User({
            name,
            email,
            passwordHash: password, // Will be hashed by pre-save middleware
            timezone: timezone || 'Asia/Kolkata',
        });

        await user.save();

        // Generate token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
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

        // Find user
        const user = await User.findOne({ email });
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
        const { apiKey } = req.body;
        if (!apiKey) {
            return res.status(400).json({ success: false, error: 'API Key is required' });
        }

        const { iv, encryptedData } = encrypt(apiKey);

        const user = await User.findByIdAndUpdate(
            req.userId,
            {
                $set: {
                    geminiApiKey: encryptedData,
                    encryptionIV: iv
                }
            },
            { new: true }
        );

        res.json({ success: true, message: 'AI Key updated securely' });
    } catch (error) {
        console.error('Update AI key error:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI key' });
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
        await Promise.all([
            User.findByIdAndDelete(req.userId),
            DailyLog.deleteMany({ userId: req.userId }),
            DSAProblem.deleteMany({ userId: req.userId }),
            BackendTopic.deleteMany({ userId: req.userId }),
            ProjectStudy.deleteMany({ userId: req.userId }),
        ]);

        res.json({ success: true, data: { message: 'Account deleted successfully' } });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete account' });
    }
});

export default router;
