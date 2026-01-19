import { jest } from '@jest/globals';

// Set default timeout
jest.setTimeout(30000);

// Mock console methods to keep test output clean
global.console = {
    ...console,
    // log: jest.fn(), 
    error: jest.fn(),
    warn: jest.fn(),
};

// Mock environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.PORT = '5001';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
process.env.GEMINI_API_KEY = 'test-api-key';
