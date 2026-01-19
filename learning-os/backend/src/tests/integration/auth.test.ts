import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User';
import authRoutes from '../../routes/auth';

// Create a test app instance
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock the User model class
jest.mock('../../models/User', () => {
    return {
        User: jest.fn()
    };
});

// Mock bcrypt
jest.mock('bcryptjs', () => ({
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('hashed_password'),
    genSalt: jest.fn().mockResolvedValue('salt'),
}));

// Mock jwt
jest.mock('jsonwebtoken', () => ({
    sign: jest.fn().mockReturnValue('mock_token'),
    verify: jest.fn(),
}));

describe('Auth Routes Integration', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        // 1. Setup Static Methods (findOne, create, etc.)
        (User as any).findOne = jest.fn();
        (User as any).create = jest.fn();
        (User as any).findByIdAndUpdate = jest.fn().mockResolvedValue({
            _id: 'user123',
            toJSON: () => ({ _id: 'user123' })
        });
        (User as any).findByIdAndDelete = jest.fn();

        // 2. Setup Constructor Implementation (Mocking 'new User(...)')
        (User as unknown as jest.Mock).mockImplementation((data: any) => ({
            ...data,
            _id: 'user123',
            save: jest.fn().mockResolvedValue(data), // Mock .save() instance method
            comparePassword: jest.fn().mockResolvedValue(true), // Mock instance method
            toJSON: jest.fn().mockReturnValue({
                _id: 'user123',
                name: data.name || 'Test User',
                email: data.email || 'test@example.com'
            })
        }));
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            // Mock User.findOne to return null (user doesn't exist)
            (User.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'testuser',
                    email: 'test@example.com',
                    password: 'Password123!',
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('token', 'mock_token');
            expect(User).toHaveBeenCalled(); // Constructor called
        });

        it('should fail if user already exists', async () => {
            // Mock User.findOne to return an existing user
            (User.findOne as jest.Mock).mockResolvedValue({
                _id: 'existing123',
                email: 'test@example.com'
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'testuser',
                    email: 'test@example.com',
                    password: 'Password123!'
                });

            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/registered/i);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with correct credentials', async () => {
            // Mock findOne to return user instance (NOT a plain object!)
            // Because code calls user.comparePassword()
            const mockComparePassword = jest.fn().mockResolvedValue(true);
            const mockUserInstance = {
                _id: 'user123',
                email: 'test@example.com',
                passwordHash: 'hashed_password',
                comparePassword: mockComparePassword,
                toJSON: jest.fn().mockReturnValue({ _id: 'user123', email: 'test@example.com' })
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUserInstance);

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Password123!'
                });

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('token', 'mock_token');
        });

        it('should fail with incorrect password', async () => {
            // Mock findOne to return user
            const mockComparePassword = jest.fn().mockResolvedValue(false);
            const mockUserInstance = {
                _id: 'user123',
                email: 'test@example.com',
                passwordHash: 'hashed_password',
                comparePassword: mockComparePassword,
                toJSON: jest.fn()
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUserInstance);

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/invalid/i);
        });
    });
});
