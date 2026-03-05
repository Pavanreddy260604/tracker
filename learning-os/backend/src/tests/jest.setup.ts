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
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-32chars';
process.env.PORT = '5001';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
process.env.OLLAMA_URL = 'http://localhost:11434';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
