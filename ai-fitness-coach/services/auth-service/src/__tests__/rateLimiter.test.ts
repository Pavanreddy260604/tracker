import request from 'supertest';
import express from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter';

describe('Property 37: Rate Limiting', () => {
  it('should reject requests after 5 attempts per minute', async () => {
    const app = express();
    // Apply the rate limiter to a mock route
    app.post('/api/v1/auth/login', authRateLimiter, (req, res) => {
      res.status(200).json({ message: 'Success' });
    });

    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      const response = await request(app).post('/api/v1/auth/login');
      expect(response.status).toBe(200);
    }

    // The 6th request should fail with 429 Too Many Requests
    const rejectedResponse = await request(app).post('/api/v1/auth/login');
    expect(rejectedResponse.status).toBe(429);
    expect(rejectedResponse.body.message).toBe('Too many authentication attempts, please try again after a minute');
  });
});
