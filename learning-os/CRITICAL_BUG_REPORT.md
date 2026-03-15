# CRITICAL BUG REPORT - All Issues Found

## Summary: 15+ Critical Issues Found Across All Files

---

## 1. WRONG IMPORT PATH (CRITICAL)

**File:** `backend/src/services/evaluation/semanticSystemDesign.service.ts:4`

**Issue:**
```typescript
import { circuitBreakerRegistry } from './circuitBreaker.service.js';
```

**Problem:** The file is in `services/evaluation/` but `circuitBreaker.service.js` is in `services/ai/`

**Fix:**
```typescript
import { circuitBreakerRegistry } from '../ai/circuitBreaker.service.js';
```

---

## 2. MISSING METHOD IN AI CLIENT SERVICE

**File:** `backend/src/services/ai/structuredQuestion.service.ts:310`

**Issue:**
```typescript
const embedding = await this.aiClient.generateEmbedding(text);
```

**Problem:** `generateEmbedding` method doesn't exist in AIClientService

**Fix:** Add the method to AIClientService or use a stub:
```typescript
// Add to structuredQuestion.service.ts
private async getEmbedding(text: string): Promise<number[]> {
  // Fallback: generate a random embedding for now
  // In production, this should call OpenAI embeddings API
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Generate deterministic "embedding" based on text hash
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const embedding = Array.from({ length: 128 }, (_, i) => {
    return Math.sin(hash * (i + 1)) * 0.5 + 0.5;
  });
  
  await redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(embedding));
  return embedding;
}
```

---

## 3. INCORRECT REDIS ZRANK ARGUMENT TYPE

**File:** `backend/src/infrastructure/redis.ts:166`

**Issue:**
```typescript
const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
const resetTime = parseInt(oldest[1]) + windowSeconds;
```

**Problem:** Redis zrange returns array of strings, but 'WITHSCORES' returns flat array [member1, score1, member2, score2]

**Fix:**
```typescript
const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
// oldest is like ['member', 'score']
const resetTime = oldest.length >= 2 ? parseInt(oldest[1]) + windowSeconds : now + windowSeconds;
```

---

## 4. UNUSED IMPORT IN REDIS

**File:** `backend/src/infrastructure/redis.ts:3-6`

**Issue:**
```typescript
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
```

**Problem:** These are defined but could be undefined if env vars not set. Need validation.

**Fix:**
```typescript
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

if (!REDIS_HOST || isNaN(REDIS_PORT)) {
  throw new Error('Invalid Redis configuration');
}
```

---

## 5. MISSING IMPORT IN ATTESTATION SERVICE

**File:** `backend/src/services/proctoring/attestation.service.ts`

**Issue:** Uses `redis` but imports from `../../infrastructure/redis.js` which exports `redis` as default

**Check:** Verify the import path is correct

---

## 6. FRONTEND HOOK MISSING DEPENDENCY

**File:** `frontend/src/hooks/useSecureProctoring.ts:2`

**Issue:**
```typescript
import { createHmac } from 'crypto-browserify';
```

**Problem:** `crypto-browserify` is not installed by default in the project

**Fix:** Either:
1. Install crypto-browserify: `npm install crypto-browserify`
2. Or use native Web Crypto API:
```typescript
const generateEventProof = async (type: ViolationType, data?: Record<string, unknown>): Promise<string> => {
  sequenceNumberRef.current++;
  const timestamp = Date.now();
  const seq = sequenceNumberRef.current;
  
  const dataStr = JSON.stringify({ sessionId, type, timestamp, seq, ...data });
  
  // Use Web Crypto API instead of crypto-browserify
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(dataStr);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
```

---

## 7. CONTROLLER METRICS METHOD SIGNATURE MISMATCH

**File:** `backend/src/controllers/interview.controller.new.ts:42-44`

**Issue:**
```typescript
interviewMetrics.codeExecutionFailed.inc({
  reason: 'provider_unavailable'
});
```

**Problem:** Looking at monitoring.ts, the counter doesn't accept labels

**Fix:**
```typescript
interviewMetrics.codeExecutionFailed.inc();
```

---

## 8. CONTROLLER METRICS - INTERVIEW STARTED WRONG SIGNATURE

**File:** `backend/src/controllers/interview.controller.new.ts:64-66`

**Issue:**
```typescript
interviewMetrics.interviewStarted.inc({
  difficulty: req.body.difficulty || 'mixed'
});
```

**Problem:** The counter doesn't accept object parameter

**Fix:**
```typescript
interviewMetrics.interviewStarted.inc();
```

---

## 9. FRONTEND HOOK - USEINTERVIEWSTATE MISSING API METHODS

**File:** `frontend/src/hooks/useInterviewState.ts`

**Issues:**
1. Line 30: `api.updateDraft` - Method doesn't exist in API service
2. Line 215: `api.submitInterviewCode` - Method doesn't exist

**Fix:** Add these methods to the API service or create them:
```typescript
// In api.ts
export const api = {
  // ... existing methods
  
  updateDraft: async (sessionId: string, questionIndex: number, code?: string, answer?: string) => {
    return fetch(`/api/interview/${sessionId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, code, answer })
    }).then(r => r.json());
  },
  
  submitInterviewCode: async (sessionId: string, questionIndex: number) => {
    return fetch(`/api/interview/${sessionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex })
    }).then(r => r.json());
  }
};
```

---

## 10. TYPE ERROR IN MONITORING - METRICS INC METHOD

**File:** `backend/src/infrastructure/monitoring.ts:18-50`

**Issue:** All counters use `.inc()` but OpenTelemetry counters need attributes

**Current:**
```typescript
public interviewStarted = this.meter.createCounter('interview.started', {...});
```

**Problem:** When calling `.inc()` with no args, it works, but `.inc({difficulty: 'easy'})` would fail

**Status:** This is actually OK - counters can be called with no attributes or with attributes

---

## 11. REDIS SCANSTREAM TYPE ERROR

**File:** `backend/src/infrastructure/redis.ts:114`

**Issue:**
```typescript
const stream = redis.scanStream({ match: pattern, count: 100 });
```

**Problem:** `count` should be number, but TypeScript might complain about the type

**Fix:**
```typescript
const stream = redis.scanStream({ match: pattern, count: 100 } as any);
```

---

## 12. CIRCUTBREAKER IMPORT PATH IN EVALUATOR

**Already documented in issue #1**

---

## 13. EXECUTION QUEUE - JOB INTERFACE MISMATCH

**File:** `backend/src/services/execution/executionQueue.service.ts:5-15`

**Issue:**
```typescript
interface ExecutionJob {
  jobId: string;  // This is not used when adding to queue
  // ...
}
```

**Problem:** `jobId` in interface but Bull generates its own job ID

**Fix:** Remove `jobId` from the interface since Bull generates it:
```typescript
interface ExecutionJob {
  language: string;
  code: string;
  testCases: Array<{ input: string; expectedOutput: string }>;
  limits: ExecutionLimits;
  priority: number;
  sessionId: string;
  userId: string;
  questionId: string;
}
```

---

## 14. SANDBOXED EXECUTION - STREAM PARSING ERROR

**File:** `backend/src/services/execution/sandboxedExecution.service.ts:189-208`

**Issue:** Docker stream parsing assumes first byte is header

**Problem:** Docker multiplexed stream format is: [8-byte header][payload]
Header: [1-byte stream type][3-byte padding][4-byte size]

**Fix:**
```typescript
stream.on('data', (chunk: Buffer) => {
  // Docker multiplexed stream format
  // Header: [1 byte type][3 bytes padding][4 bytes size]
  // Type 1 = stdout, Type 2 = stderr
  
  let offset = 0;
  while (offset < chunk.length) {
    const streamType = chunk[offset];
    const size = chunk.readUInt32BE(offset + 4);
    
    if (offset + 8 + size > chunk.length) break;
    
    const data = chunk.slice(offset + 8, offset + 8 + size).toString('utf8');
    
    if (streamType === 1) {
      stdout += data;
      if (stdout.length > mergedLimits.maxOutputBytes) {
        stdout = stdout.substring(0, mergedLimits.maxOutputBytes) + '\n[Output truncated]';
        truncated = true;
      }
    } else if (streamType === 2) {
      stderr += data;
      if (stderr.length > mergedLimits.maxOutputBytes) {
        stderr = stderr.substring(0, mergedLimits.maxOutputBytes) + '\n[Output truncated]';
        truncated = true;
      }
    }
    
    offset += 8 + size;
  }
});
```

---

## 15. FRONTEND - USESECUREPROCTORING MISSING ASYNC

**File:** `frontend/src/hooks/useSecureProctoring.ts:69-79`

**Issue:** `generateEventProof` is synchronous but Web Crypto is async

**Fix:** Make it async and update all callers:
```typescript
const generateEventProof = useCallback(async (
  type: ViolationType,
  data?: Record<string, unknown>
): Promise<string> => {
  // ... async implementation
}, [sessionId, secret]);
```

---

## 16. CONTROLLER - PROCTORING SCHEMA MISSING FIELDS

**File:** `backend/src/controllers/interview.controller.new.ts`

**Issue:** Controller expects `clientProof` and `sequenceNumber` from body

**Problem:** The `proctoringUpdateSchema` in `interview.schemas.ts` doesn't have these fields

**Fix:** Update the schema to include attestation fields:
```typescript
export const proctoringUpdateSchema = z
  .object({
    tabSwitchCount: z.number().int().min(0).max(10000).optional(),
    idleTime: z.number().min(0).max(86400).optional(),
    lastActivityTime: z.string().datetime().optional(),
    violationType: z.string().max(100).optional(),
    violationMessage: z.string().max(500).optional(),
    timestamp: z.string().datetime().optional(),
    // NEW FIELDS:
    clientProof: z.string().optional(),
    sequenceNumber: z.number().optional(),
  })
```

---

## 17. RATE LIMITER - BROKEN LOGIC

**File:** `backend/src/middleware/advancedRateLimiter.ts:32-76`

**Issue:** The rate limiter uses MULTI but doesn't actually add the request atomically

**Current flow:**
1. MULTI to remove old entries
2. MULTI to count current
3. Check if allowed
4. If allowed, add request (separate call)

**Problem:** Race condition between step 2 and 4

**Fix:** Use proper Redis Lua script or fix atomicity:
```typescript
async check(key: string, config: RateLimitConfig): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `ratelimit:${config.keyPrefix || 'default'}:${key}`;

  // Use a Lua script for atomicity
  const luaScript = `
    redis.call('zremrangebyscore', KEYS[1], 0, ARGV[1])
    local current = redis.call('zcard', KEYS[1])
    if current < tonumber(ARGV[2]) then
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
```

---

## 18. MONITORING - OBSERVABLE GAUGE SETUP ERROR

**File:** `backend/src/infrastructure/monitoring.ts:54-74`

**Issue:**
```typescript
this.activeInterviews.addCallback((result) => {
  result.observe(this.activeInterviewsValue);
});
```

**Problem:** ObservableGauge callbacks are called during metric collection, but `result` is the ObservableResult, not a function

**Fix:**
```typescript
constructor() {
  this.activeInterviews.addCallback((observableResult) => {
    observableResult.observe(this.activeInterviewsValue, {});
  });
  
  this.queueDepth.addCallback((observableResult) => {
    observableResult.observe(this.queueDepthValue, {});
  });
  
  this.redisLatency.addCallback((observableResult) => {
    observableResult.observe(this.redisLatencyValue, {});
  });
}
```

---

## 19. SEEDER - WRONG IMPORT EXTENSION

**File:** `backend/src/scripts/seedProductionQuestions.ts:1-7`

**Issue:** Uses `.js` extension imports but this is a `.ts` file

**Problem:** In TypeScript with ESM, imports need `.js` extensions, but this might cause issues

**Status:** This is actually correct for ESM TypeScript, but verify the build process handles it

---

## 20. WEIGHTED SCORING - POTENTIAL DIVISION BY ZERO

**File:** `backend/src/services/evaluation/weightedScoring.service.ts:298-300`

**Issue:**
```typescript
const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
const cv = Math.sqrt(variance) / mean;
```

**Problem:** If `intervals` is empty or `mean` is 0, division by zero occurs

**Fix:**
```typescript
if (intervals.length === 0 || mean === 0) {
  return 0;
}
```

---

## COMPLETE FIXES NEEDED

### Priority 1 (CRITICAL - Will crash)
1. Fix import path in semanticSystemDesign.service.ts
2. Add generateEmbedding method or stub
3. Fix rate limiter atomicity issue
4. Fix monitoring observable gauge
5. Fix Docker stream parsing in sandboxedExecution.service.ts
6. Fix division by zero in weightedScoring.service.ts

### Priority 2 (HIGH - Will cause runtime errors)
7. Remove crypto-browserify dependency, use Web Crypto API
8. Fix Redis zrange parsing in multiple files
9. Add missing API methods for frontend
10. Update proctoring schema with attestation fields
11. Make generateEventProof async in frontend

### Priority 3 (MEDIUM - Code quality)
12. Fix unused imports and variables
13. Add proper error handling for edge cases
14. Fix type mismatches in Bull queue interfaces

---

## FILES TO FIX

1. `backend/src/services/evaluation/semanticSystemDesign.service.ts`
2. `backend/src/services/ai/structuredQuestion.service.ts`
3. `backend/src/infrastructure/redis.ts`
4. `backend/src/middleware/advancedRateLimiter.ts`
5. `backend/src/infrastructure/monitoring.ts`
6. `backend/src/services/execution/sandboxedExecution.service.ts`
7. `backend/src/services/evaluation/weightedScoring.service.ts`
8. `frontend/src/hooks/useSecureProctoring.ts`
9. `frontend/src/hooks/useInterviewState.ts`
10. `backend/src/schemas/interview.schemas.ts`

---

## RECOMMENDATION

**DO NOT DEPLOY** until all Priority 1 and Priority 2 issues are fixed. These will cause:
- Server crashes (import errors, division by zero)
- Security bypasses (rate limiter race conditions)
- Silent failures (stream parsing errors)
- Frontend crashes (missing API methods)
