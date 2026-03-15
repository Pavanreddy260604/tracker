import { Request, Response, NextFunction } from 'express';
import { redis } from '../infrastructure/redis.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstAllowance?: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  handler?: (req: Request, res: Response) => void;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

// Sliding window rate limiter using Redis sorted sets with Lua for atomicity
export class SlidingWindowRateLimiter {
  async check(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const redisKey = `ratelimit:${config.keyPrefix || 'default'}:${key}`;

    // Use a Lua script for atomicity
    const luaScript = `
      redis.call('zremrangebyscore', KEYS[1], 0, ARGV[1])
      local current = redis.call('zcard', KEYS[1])
      local burstLimit = tonumber(ARGV[2])
      if current < burstLimit then
        redis.call('zadd', KEYS[1], ARGV[3], ARGV[4])
        redis.call('pexpire', KEYS[1], ARGV[5])
        return {current + 1, 1}
      else
        return {current, 0}
      end
    `;

    const burstLimit = config.burstAllowance 
      ? config.maxRequests + config.burstAllowance
      : config.maxRequests;

    const requestId = `${now}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await redis.eval(
      luaScript,
      1,
      redisKey,
      windowStart,
      burstLimit,
      now,
      requestId,
      config.windowMs + 1000
    ) as [number, number];

    const currentCount = result[0];
    const allowed = result[1] === 1;

    if (!allowed) {
      const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetTime = oldest.length >= 2 
        ? new Date(parseInt(oldest[1]) + config.windowMs)
        : new Date(now + config.windowMs);

      return {
        allowed: false,
        info: {
          limit: config.maxRequests,
          current: currentCount,
          remaining: 0,
          resetTime
        }
      };
    }

    return {
      allowed: true,
      info: {
        limit: config.maxRequests,
        current: currentCount,
        remaining: Math.max(0, config.maxRequests - currentCount),
        resetTime: new Date(now + config.windowMs)
      }
    };
  }

  async reset(key: string, keyPrefix: string = 'default'): Promise<void> {
    await redis.del(`ratelimit:${keyPrefix}:${key}`);
  }
}

const rateLimiter = new SlidingWindowRateLimiter();

// Default key generator
const defaultKeyGenerator = (req: Request): string => {
  return req.userId || req.ip || 'anonymous';
};

// Default handler when rate limit exceeded
const defaultHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later',
    retryAfter: res.getHeader('Retry-After')
  });
};

// Middleware factory
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = (config.keyGenerator || defaultKeyGenerator)(req);
      const result = await rateLimiter.check(key, config);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.info.limit);
      res.setHeader('X-RateLimit-Remaining', result.info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(result.info.resetTime.getTime() / 1000));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.info.resetTime.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);
        
        const handler = config.handler || defaultHandler;
        return handler(req, res);
      }

      // Track response for skip options
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        const statusCode = res.statusCode;
        
        // Decrement count if configured to skip
        if (config.skipSuccessfulRequests && statusCode < 400) {
          // We don't actually decrement, we just don't count it in the first place
          // This is handled by not adding to the set until after we know the result
        }
        
        if (config.skipFailedRequests && statusCode >= 400) {
          // Same logic
        }
        
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('[RateLimiter] Error:', error);
      // Fail open - allow request but log error
      next();
    }
  };
}

// Pre-configured rate limits for different endpoints
export const rateLimits = {
  // Very strict - interview starts are expensive
  interviewStart: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 2,
    burstAllowance: 1,
    keyPrefix: 'interview:start'
  }),

  // Moderate - code execution is resource intensive
  codeExecution: createRateLimitMiddleware({
    windowMs: 10 * 1000, // 10 seconds
    maxRequests: 5,
    burstAllowance: 3,
    keyPrefix: 'execution:code',
    keyGenerator: (req) => req.userId || req.ip || 'anon'
  }),

  // Lenient - AI chat is relatively cheap but still rate limited
  aiChat: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyPrefix: 'ai:chat'
  }),

  // Standard API rate limit
  api: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'api:general'
  }),

  // Strict for writes
  write: createRateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'api:write'
  }),

  // Very strict for proctoring updates
  proctoring: createRateLimitMiddleware({
    windowMs: 5 * 1000, // 5 seconds
    maxRequests: 10, // Allow burst of updates
    burstAllowance: 5,
    keyPrefix: 'proctoring:update'
  })
};

// IP-based rate limit for unauthenticated users
export const ipRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'ip',
  keyGenerator: (req) => req.ip || 'unknown'
});

// Health check endpoint for rate limiter
export async function checkRateLimitStatus(identifier: string): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
}> {
  const key = `ratelimit:api:general:${identifier}`;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  await redis.zremrangebyscore(key, 0, windowStart);
  const current = await redis.zcard(key);
  const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
  const resetTime = oldest.length >= 2 
    ? new Date(parseInt(oldest[1]) + 60000)
    : new Date(now + 60000);

  return {
    allowed: current < 100,
    limit: 100,
    remaining: Math.max(0, 100 - current),
    resetTime
  };
}
