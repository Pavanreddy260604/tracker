import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Flag to track if Redis is actually available
let isRedisAvailable = false;

export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retryStrategy: (times) => {
    // If we failed after 3 attempts, slow down significantly to avoid log spam in dev
    if (times > 3) {
      return 30000; // Try once every 30 seconds
    }
    return Math.min(times * 1000, 5000);
  },
  maxRetriesPerRequest: null, // Critical: set to null so Bull doesn't crash on connection failure
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: false,
});

export const getRedisStatus = () => isRedisAvailable;

// Handle connection events
redis.on('connect', () => {
  isRedisAvailable = true;
  console.log(`[Redis] Connected successfully to ${REDIS_HOST}:${REDIS_PORT}`);
});

redis.on('error', (err) => {
  // Only log if we were previously available or if not in dev
  if (isRedisAvailable) {
    console.error('[Redis] Connection lost:', err.message);
    isRedisAvailable = false;
  } else if (process.env.NODE_ENV !== 'development') {
    console.error('[Redis] Connection error:', err.message);
  }
});

redis.on('reconnecting', () => {
  if (isRedisAvailable) {
    console.log('[Redis] Attempting to reconnect...');
  }
});

// Redis key patterns for interview simulator
export const Keys = {
  // Interview sessions
  interviewSession: (id: string) => `interview:session:${id}`,
  interviewSessionTTL: (id: string) => `interview:session:${id}:ttl`,
  
  // Proctoring
  proctoringSecret: (sessionId: string) => `proctoring:secret:${sessionId}`,
  proctoringEvents: (sessionId: string) => `proctoring:events:${sessionId}`,
  proctoringSequence: (sessionId: string) => `proctoring:seq:${sessionId}`,
  behavioralProfile: (userId: string) => `behavioral:profile:${userId}`,
  
  // Code execution
  executionResult: (jobId: string) => `execution:result:${jobId}`,
  executionQueue: 'execution:queue',
  executionJob: (jobId: string) => `execution:job:${jobId}`,
  
  // Questions
  question: (id: string) => `question:${id}`,
  questionPool: (difficulty: string, topics: string) => `questions:pool:${difficulty}:${topics}`,
  questionSet: (difficulty: string, topics: string) => `questions:set:${difficulty}:${topics}`,
  questionBySlug: (slug: string) => `question:slug:${slug}`,
  
  // User attempts and progress
  userAttempts: (userId: string, questionId: string) => `attempts:${userId}:${questionId}`,
  userRecentQuestions: (userId: string) => `user:${userId}:recent_questions`,
  userSkillProfile: (userId: string) => `user:${userId}:skills`,
  
  // Rate limiting
  rateLimit: (identifier: string, endpoint: string) => `ratelimit:${identifier}:${endpoint}`,
  
  // AI caching
  aiResponse: (hash: string) => `ai:response:${hash}`,
  aiEmbedding: (text: string) => `ai:embedding:${text}`,
  
  // Cache invalidation markers
  cacheVersion: (type: string) => `cache:version:${type}`,
};

// Redis helper functions
export async function withLock(
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<void>
): Promise<boolean> {
  const lockValue = `${Date.now()}-${Math.random()}`;
  
  const acquired = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
  if (!acquired) {
    return false;
  }
  
  try {
    await fn();
    return true;
  } finally {
    // Only delete if we still own the lock
    const current = await redis.get(lockKey);
    if (current === lockValue) {
      await redis.del(lockKey);
    }
  }
}

export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  
  const value = await fn();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}

export async function invalidatePattern(pattern: string): Promise<void> {
 const stream = redis.scanStream({ match: pattern, count: 100 });
  
  stream.on('data', async (keys: string[]) => {
    if (keys.length) {
      const pipeline = redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
    }
  });
  
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

// Cache warming helper
export async function warmCache<T>(
  keys: string[],
  fn: (key: string) => Promise<T>,
  ttlSeconds: number
): Promise<void> {
  const pipeline = redis.pipeline();
  
  for (const key of keys) {
    try {
      const value = await fn(key);
      pipeline.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error(`[Redis] Failed to warm cache for ${key}:`, error);
    }
  }
  
  await pipeline.exec();
}

// Distributed rate limiting
export async function checkRateLimit(
  key: string,
  windowSeconds: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Count current
  const currentCount = await redis.zcard(key);
  
  if (currentCount >= maxRequests) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetTime = parseInt(oldest[1]) + windowSeconds;
    
    return {
      allowed: false,
      remaining: 0,
      resetTime
    };
  }
  
  // Add current request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, windowSeconds + 1);
  
  return {
    allowed: true,
    remaining: maxRequests - currentCount - 1,
    resetTime: now + windowSeconds
  };
}

// Health check
export async function checkRedisHealth(): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now();
  try {
    await redis.ping();
    return { healthy: true, latency: Date.now() - start };
  } catch (error) {
    return { healthy: false, latency: -1 };
  }
}
