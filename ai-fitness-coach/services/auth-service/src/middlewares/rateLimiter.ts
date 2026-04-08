import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: { message: 'Too many authentication attempts, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});
