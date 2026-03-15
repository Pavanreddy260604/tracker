# Production-Grade Interview Simulator - Complete Fix Plan

## Executive Summary
Transform the MVP interview simulator into a production-ready platform. Every identified issue will be fixed with zero tolerance for shortcuts.

---

## Phase 1: Security & Proctoring Overhaul

### 1.1 Server-Side Proctoring Verification (CRITICAL)
**Current Issue**: Proctoring is client-side theater. Backend trusts frontend data blindly.

**Solution**: Implement cryptographic attestation + behavioral analysis

```typescript
// New: ProctoringAttestationService.ts
interface ProctoringEvent {
  type: 'tab_switch' | 'focus_loss' | 'fullscreen_exit' | 'mouse_idle' | 'key_pattern';
  timestamp: number;
  sessionId: string;
  clientProof: string; // HMAC of event data
  screenCapture?: string; // Base64 blurhash of screen (optional)
  mouseTrail: { x: number; y: number; t: number }[];
  keystrokeDynamics: { key: string; pressTime: number; releaseTime: number }[];
}
```

**Implementation Steps**:
1. Generate HMAC secret on session start, share with client via secure WebSocket
2. Client signs every proctoring event with HMAC-SHA256
3. Server validates all events, rejects tampered data
4. Use WebRTC screen capture for high-stakes interviews (optional tier)
5. Implement keystroke dynamics analysis (typing rhythm detection)

**New Files Required**:
- `backend/src/services/proctoring/attestation.service.ts`
- `backend/src/services/proctoring/behavioralAnalysis.service.ts`
- `frontend/src/hooks/useSecureProctoring.ts` (replace old hook)

### 1.2 Tamper-Proof Client Architecture
**Current Issue**: Users can disable JavaScript, modify DOM, use dev tools

**Solution**: Multiple detection layers

```typescript
// Anti-debug detection
const detectDevTools = () => {
  const threshold = 160;
  const check = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
      reportViolation('devtools_detected');
    }
  };
  setInterval(check, 1000);
};

// Integrity checks - verify code hasn't been modified
const verifyIntegrity = () => {
  const scripts = document.querySelectorAll('script[src*="interview"]');
  scripts.forEach(script => {
    const hash = calculateHash(script.textContent);
    // Compare against known good hash from server
  });
};
```

**Implementation**:
1. Add SubResource Integrity (SRI) hashes to all scripts
2. Webpack plugin to generate integrity manifests
3. Server-side verification that client sends expected hashes
4. Obfuscate critical proctoring code (cannot be easily disabled)

### 1.3 Behavioral Biometrics
**New Feature**: Detect if candidate is getting external help

```typescript
interface BiometricProfile {
  typingSpeed: number;
  errorRate: number;
  pasteFrequency: number;
  tabSwitchPattern: 'normal' | 'suspicious' | 'cheating';
  mouseConsistency: number; // 0-1 score
}
```

**Detection Rules**:
- Sudden typing speed increase (>200% baseline) = likely copy-paste
- Tab switching to Stack Overflow pattern = suspicious
- Mouse cursor teleportation (instant moves) = automation detected
- Long pauses followed by code bursts = external help

---

## Phase 2: AI Integration - Bulletproof Pipeline

### 2.1 Structured Output with JSON Schema
**Current Issue**: Regex parsing of AI responses

**Solution**: Use OpenAI GPT-4-turbo with JSON mode, Pydantic validation

```typescript
// backend/src/services/ai/structuredQuestion.service.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const QuestionSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(50).max(5000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topics: z.array(z.string()).min(1).max(5),
  signature: z.object({
    javascript: z.string(),
    python: z.string(),
    java: z.string(),
    cpp: z.string(),
    go: z.string()
  }),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isHidden: z.boolean(),
    isEdgeCase: z.boolean().describe('True if this tests boundary conditions'),
    explanation: z.string().describe('Why this is/isn\'t an edge case')
  })).min(5).max(20),
  timeComplexity: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(2^n)', 'O(n!)']),
  spaceComplexity: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n^2)']),
  solution: z.object({
    approach: z.string(),
    code: z.record(z.string()) // language -> code
  })
});

type GeneratedQuestion = z.infer<typeof QuestionSchema>;

export class StructuredQuestionService {
  async generateQuestion(difficulty: string, topics: string[]): Promise<GeneratedQuestion> {
    const jsonSchema = zodToJsonSchema(QuestionSchema);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a technical interviewer. Generate a coding question following this schema: ${JSON.stringify(jsonSchema)}`
        },
        {
          role: 'user',
          content: `Generate a ${difficulty} question about: ${topics.join(', ')}`
        }
      ]
    });
    
    const parsed = QuestionSchema.parse(JSON.parse(response.choices[0].message.content));
    return parsed;
  }
}
```

### 2.2 Retry Logic with Exponential Backoff
**Current Issue**: No retries on AI failures

**Solution**: Circuit breaker pattern

```typescript
// backend/src/services/ai/circuitBreaker.service.ts
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxCalls: number;
}

class AICircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new AIServiceError('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await this.executeWithRetry(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await sleep(delay);
      }
    }
    throw new Error('Unreachable');
  }
}
```

### 2.3 AI Response Caching with Semantic Deduplication
**Current Issue**: Regenerates questions on every request

**Solution**: Redis cache with semantic key

```typescript
// backend/src/services/ai/cachedQuestion.service.ts
import { createHash } from 'crypto';

export class CachedQuestionService {
  async generateCuratedQuestion(
    difficulty: string, 
    topics: string[]
  ): Promise<GeneratedQuestion> {
    // Sort topics for consistent cache key
    const sortedTopics = [...topics].sort().join(',');
    const cacheKey = `question:${difficulty}:${sortedTopics}:${this.getCacheVersion()}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Check if we have 50+ cached questions for this combo
    const questionSetKey = `question_set:${difficulty}:${sortedTopics}`;
    const count = await redis.scard(questionSetKey);
    
    if (count >= 50) {
      // Pick random from existing pool
      const randomId = await redis.srandmember(questionSetKey);
      const question = await redis.get(`question_data:${randomId}`);
      return JSON.parse(question);
    }
    
    // Generate new question
    const question = await this.aiService.generateQuestion(difficulty, topics);
    
    // Validate uniqueness - semantic similarity check
    const isDuplicate = await this.checkSemanticDuplicate(question, difficulty, topics);
    if (isDuplicate) {
      // Retry with different seed/temperature
      return this.generateCuratedQuestion(difficulty, topics);
    }
    
    // Cache it
    await redis.setex(cacheKey, 86400 * 30, JSON.stringify(question)); // 30 days
    await redis.sadd(questionSetKey, question.id);
    await redis.setex(`question_data:${question.id}`, 86400 * 30, JSON.stringify(question));
    
    return question;
  }
  
  private async checkSemanticDuplicate(
    newQuestion: GeneratedQuestion,
    difficulty: string,
    topics: string[]
  ): Promise<boolean> {
    // Use embeddings to detect similar questions
    const similar = await this.vectorStore.similaritySearch(
      newQuestion.title + ' ' + newQuestion.description,
      1,
      { difficulty, topics }
    );
    
    if (similar.length === 0) return false;
    
    const similarity = similar[0].score;
    return similarity > 0.85; // 85% similar = duplicate
  }
}
```

---

## Phase 3: Question Database - Industrial Scale

### 3.1 Database Schema Redesign
**Current Issue**: 4 hardcoded questions

**Solution**: Proper MongoDB schema with 1000+ questions

```typescript
// backend/src/models/Question.ts - Enhanced Schema
const testCaseSchema = new Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, required: true },
  isEdgeCase: { 
    type: Boolean, 
    required: true,
    index: true 
  },
  // NEW: Why this is an edge case (for transparency)
  edgeCaseType: {
    type: String,
    enum: [
      'empty_input',
      'single_element',
      'max_constraints',
      'min_constraints',
      'overflow',
      'null_undefined',
      'duplicate_values',
      'negative_values',
      'boundary_value',
      'performance_stress'
    ]
  },
  explanation: String // Educational note about the edge case
});

const questionSchema = new Schema({
  title: { type: String, required: true, index: true },
  slug: { type: String, required: true, unique: true }, // URL-friendly identifier
  description: { type: String, required: true },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'],
    required: true,
    index: true
  },
  topics: [{ type: String, index: true }],
  companies: [{ type: String }], // Which FAANG companies ask this
  frequency: { type: Number, default: 0 }, // How often this appears in interviews
  
  type: { 
    type: String, 
    enum: ['coding', 'sql', 'system-design', 'behavioral'],
    required: true,
    index: true
  },
  
  // Coding-specific
  functionName: String, // The function candidate implements
  signatures: {
    javascript: String,
    python: String,
    java: String,
    cpp: String,
    go: String
  },
  
  // SQL-specific
  schema: {
    tables: [{
      name: String,
      columns: [{ name: String, type: String }],
      sampleData: [Schema.Types.Mixed]
    }]
  },
  
  // System Design specific
  systemDesignParams: {
    requirements: [String],
    constraints: {
      rps: Number, // Requests per second
      dataVolume: String,
      latency: String
    },
    expectedComponents: [String],
    rubric: [{
      category: String,
      weight: Number,
      keywords: [String]
    }]
  },
  
  testCases: [testCaseSchema],
  
  // Performance expectations
  timeComplexity: String,
  spaceComplexity: String,
  
  // Editorial content
  hints: [String], // Progressive hints (costs points to use)
  solution: {
    approach: String,
    code: Schema.Types.Mixed, // language -> code
    complexityExplanation: String
  },
  
  // Metadata
  source: { type: String, enum: ['ai_generated', 'leetcode', 'hackerrank', 'manual'] },
  aiGenerated: { type: Boolean, default: false },
  verifiedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }], // SMEs who validated this
  timesUsed: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  
  // Content versioning
  version: { type: Number, default: 1 },
  previousVersions: [{
    version: Number,
    changedAt: Date,
    changes: String
  }]
}, { timestamps: true });

// Compound indexes for efficient queries
questionSchema.index({ difficulty: 1, topics: 1, frequency: -1 });
questionSchema.index({ type: 1, difficulty: 1, companies: 1 });
```

### 3.2 Question Seeding Pipeline
**New Feature**: Import from LeetCode, HackerRank, manual curation

```typescript
// backend/src/scripts/seedProductionQuestions.ts
import { LeetCodeImporter } from './importers/leetcode.importer';
import { QuestionValidator } from './validators/question.validator';

async function seedProductionDatabase() {
  const sources = [
    { type: 'leetcode', count: 500, difficulties: ['easy', 'medium', 'hard'] },
    { type: 'hackerrank', count: 300, categories: ['algorithms', 'data-structures'] },
    { type: 'manual', count: 200, files: ['./curated-questions/'] }
  ];
  
  for (const source of sources) {
    const importer = ImporterFactory.create(source.type);
    const questions = await importer.import(source);
    
    for (const rawQuestion of questions) {
      // Validate structure
      const validation = QuestionValidator.validate(rawQuestion);
      if (!validation.valid) {
        console.error(`Invalid question: ${validation.errors.join(', ')}`);
        continue;
      }
      
      // Generate test cases if missing
      if (rawQuestion.testCases.length < 5) {
        rawQuestion.testCases = await generateMissingTestCases(rawQuestion);
      }
      
      // Categorize edge cases properly (not random!)
      rawQuestion.testCases = categorizeTestCases(rawQuestion.testCases);
      
      // Check for duplicates
      const existing = await Question.findOne({ slug: rawQuestion.slug });
      if (existing) {
        console.log(`Duplicate found: ${rawQuestion.slug}, merging...`);
        await mergeQuestions(existing, rawQuestion);
      } else {
        await Question.create(rawQuestion);
      }
    }
  }
  
  console.log(`Seeded ${await Question.countDocuments()} questions`);
}

function categorizeTestCases(testCases: TestCase[]): TestCase[] {
  return testCases.map(tc => {
    // Analyze input to determine edge case type
    const edgeCaseType = analyzeEdgeCase(tc.input);
    return { ...tc, edgeCaseType, isEdgeCase: !!edgeCaseType };
  });
}

function analyzeEdgeCase(input: string): string | null {
  // Pattern matching for edge cases
  if (input.includes('[]') || input.includes('{}') || input.includes('""')) {
    return 'empty_input';
  }
  if (input.includes('10^5') || input.includes('100000')) {
    return 'max_constraints';
  }
  if (input.includes('-1') || input.includes('negative')) {
    return 'negative_values';
  }
  // ... more patterns
  return null;
}
```

### 3.3 Smart Question Selection Algorithm
**Current Issue**: Random selection from tiny pool

**Solution**: Weighted selection based on user performance, spaced repetition

```typescript
// backend/src/services/questionSelection.service.ts
interface SelectionCriteria {
  difficulty: string;
  topics: string[];
  avoidRecent?: boolean; // Don't repeat questions from last 30 days
  targetTime?: number; // Target solve time in minutes
}

export class QuestionSelectionService {
  async selectQuestions(criteria: SelectionCriteria, count: number): Promise<Question[]> {
    // Build weighted pool
    const candidates = await Question.aggregate([
      {
        $match: {
          difficulty: criteria.difficulty,
          topics: { $in: criteria.topics },
          // Exclude recently attempted by this user
          _id: { $nin: await this.getRecentQuestionIds(userId, 30) }
        }
      },
      {
        $addFields: {
          weight: {
            $add: [
              { $multiply: ['$frequency', 10] }, // Popular questions weighted higher
              { $multiply: [{ $subtract: [100, '$averageScore'] }, 0.5] }, // Harder questions = more valuable
              { $multiply: [{ $rand: {} }, 20] } // Random component (20%)
            ]
          }
        }
      },
      { $sort: { weight: -1 } },
      { $limit: count * 3 } // Get 3x candidates for diversity
    ]);
    
    // Ensure topic diversity - don't pick 5 array questions
    const selected = this.ensureTopicDiversity(candidates, count, criteria.topics);
    
    return selected;
  }
  
  private ensureTopicDiversity(
    candidates: Question[], 
    count: number, 
    targetTopics: string[]
  ): Question[] {
    const selected: Question[] = [];
    const topicCounts = new Map<string, number>();
    
    // Initialize topic counts
    targetTopics.forEach(t => topicCounts.set(t, 0));
    
    for (const q of candidates) {
      if (selected.length >= count) break;
      
      // Check if any topic is over-represented
      const overRepresented = q.topics.some(t => (topicCounts.get(t) || 0) >= 2);
      if (overRepresented) continue;
      
      selected.push(q);
      q.topics.forEach(t => topicCounts.set(t, (topicCounts.get(t) || 0) + 1));
    }
    
    return selected;
  }
}
```

---

## Phase 4: Code Execution - Fort Knox Sandboxing

### 4.1 Resource-Limited Execution
**Current Issue**: 10s timeout only, no memory limits

**Solution**: Firecracker microVMs or Docker with strict cgroups

```typescript
// backend/src/services/execution/sandboxedExecution.service.ts
import Docker from 'dockerode';

interface ExecutionLimits {
  maxExecutionTimeMs: number; // 5000ms default
  maxMemoryMB: number; // 256MB default
  maxOutputBytes: number; // 10KB default
  maxProcesses: number; // 1 process only
  maxFileDescriptors: number; // 64
  networkAccess: boolean; // false for coding questions
}

export class SandboxedExecutionService {
  private docker: Docker;
  
  async execute(
    language: string,
    code: string,
    input: string,
    limits: ExecutionLimits
  ): Promise<ExecutionResult> {
    // Create ephemeral container
    const container = await this.docker.createContainer({
      Image: `execution-${language}:latest`,
      Cmd: ['execute'],
      HostConfig: {
        Memory: limits.maxMemoryMB * 1024 * 1024,
        MemorySwap: limits.maxMemoryMB * 1024 * 1024, // No swap
        CpuQuota: 100000, // 100% of 1 CPU
        CpuPeriod: 100000,
        PidsLimit: limits.maxProcesses,
        NetworkMode: limits.networkAccess ? 'bridge' : 'none',
        AutoRemove: true,
        ReadonlyRootfs: true,
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=50m'
        }
      },
      Env: [
        `CODE=${Buffer.from(code).toString('base64')}`,
        `INPUT=${Buffer.from(input).toString('base64')}`,
        `TIMEOUT_MS=${limits.maxExecutionTimeMs}`,
        `MAX_OUTPUT=${limits.maxOutputBytes}`
      ]
    });
    
    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), limits.maxExecutionTimeMs + 1000);
    });
    
    const executionPromise = container.start().then(() => container.wait());
    
    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      return this.parseResult(result);
    } catch (error) {
      await container.kill();
      return { error: error.message, status: 'error' };
    }
  }
}
```

### 4.2 Async Queue for Execution
**New Feature**: Handle high load with queue

```typescript
// backend/src/services/execution/executionQueue.service.ts
import Bull from 'bull';

export class ExecutionQueueService {
  private queue: Bull.Queue;
  
  constructor() {
    this.queue = new Bull('code-execution', {
      redis: { port: 6379, host: 'redis' },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });
    
    // Process with 5 concurrent workers
    this.queue.process(5, this.processJob.bind(this));
  }
  
  async enqueue(
    language: string,
    code: string,
    testCases: TestCase[]
  ): Promise<JobId> {
    const job = await this.queue.add({
      language,
      code,
      testCases,
      limits: this.getLimitsForLanguage(language)
    }, {
      priority: this.calculatePriority(code.length), // Shorter code = faster
    });
    
    return job.id;
  }
  
  async getResult(jobId: JobId): Promise<ExecutionResult | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    
    if (await job.isCompleted()) {
      return job.returnvalue;
    }
    
    if (await job.isFailed()) {
      throw new Error(job.failedReason);
    }
    
    return null; // Still pending
  }
  
  private async processJob(job: Bull.Job): Promise<ExecutionResult> {
    const { language, code, testCases, limits } = job.data;
    
    const sandbox = new SandboxedExecutionService();
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await sandbox.execute(language, code, testCase.input, limits);
      results.push({
        ...result,
        passed: result.actual === testCase.expectedOutput
      });
    }
    
    return {
      testResults: results,
      summary: {
        passed: results.filter(r => r.passed).length,
        total: results.length
      }
    };
  }
}
```

### 4.3 Multi-Language Support with Isolation
**New Feature**: Support 15+ languages with proper isolation

```dockerfile
# execution-environments/Dockerfile.javascript
FROM node:20-alpine

RUN adduser -D -s /bin/sh executor
USER executor

WORKDIR /sandbox
COPY runner.js .

ENTRYPOINT ["node", "runner.js"]
```

```javascript
// execution-environments/runner.js (runs inside container)
const code = Buffer.from(process.env.CODE, 'base64').toString();
const input = Buffer.from(process.env.INPUT, 'base64').toString();
const timeout = parseInt(process.env.TIMEOUT_MS);

// Disable dangerous modules
const bannedModules = ['fs', 'child_process', 'cluster', 'dgram', 'net', 'tls', 'https'];
bannedModules.forEach(mod => {
  require.cache[require.resolve(mod)] = { exports: {} };
});

// Execute with timeout
const vm = require('vm');
const context = vm.createContext({
  console,
  process: { env: {} }, // Empty env
  Buffer,
  setTimeout,
  clearTimeout,
  setImmediate,
  clearImmediate
});

const script = new vm.Script(code, { timeout });
const result = script.runInContext(context, { timeout });

console.log('__RESULT__' + JSON.stringify(result));
```

---

## Phase 5: Evaluation Engine - Semantic Intelligence

### 5.1 Weighted Scoring System
**Current Issue**: Simple arithmetic mean

**Solution**: Difficulty-weighted, category-based scoring

```typescript
// backend/src/services/evaluation/weightedScoring.service.ts
interface ScoringWeights {
  coding: {
    correctness: 0.4,
    timeComplexity: 0.2,
    spaceComplexity: 0.15,
    codeQuality: 0.15,
    edgeCases: 0.1
  };
  sql: {
    correctness: 0.5,
    optimization: 0.25,
    readability: 0.25
  };
  systemDesign: {
    completeness: 0.25,
    scalability: 0.25,
    reliability: 0.2,
    dataModeling: 0.15,
    apiDesign: 0.15
  };
}

export class WeightedScoringService {
  calculateSectionScore(
    questions: IInterviewQuestion[],
    sectionType: SectionType
  ): number {
    const weights = SCORING_WEIGHTS[sectionType];
    
    const scores = questions.map(q => {
      const baseScore = q.score || 0;
      const difficultyMultiplier = this.getDifficultyMultiplier(q.difficulty);
      
      // Weight by difficulty - hard questions worth more
      return {
        weightedScore: baseScore * difficultyMultiplier,
        maxPossible: 100 * difficultyMultiplier,
        difficulty: q.difficulty
      };
    });
    
    const totalWeighted = scores.reduce((sum, s) => sum + s.weightedScore, 0);
    const totalPossible = scores.reduce((sum, s) => sum + s.maxPossible, 0);
    
    return Math.round((totalWeighted / totalPossible) * 100);
  }
  
  private getDifficultyMultiplier(difficulty: string): number {
    return { easy: 1.0, medium: 1.5, hard: 2.0 }[difficulty] || 1.0;
  }
}
```

### 5.2 Semantic System Design Evaluation
**Current Issue**: Keyword matching ("contains 'api'" = full marks)

**Solution**: LLM-based semantic evaluation with rubric

```typescript
// backend/src/services/evaluation/semanticSystemDesign.service.ts
import { z } from 'zod';

const SystemDesignEvaluationSchema = z.object({
  scores: z.object({
    completeness: z.number().min(0).max(100),
    scalability: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
    dataModeling: z.number().min(0).max(100),
    apiDesign: z.number().min(0).max(100)
  }),
  overallScore: z.number().min(0).max(100),
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  missingComponents: z.array(z.string()),
  suggestedReading: z.array(z.object({
    topic: z.string(),
    resource: z.string()
  }))
});

export class SemanticSystemDesignEvaluator {
  async evaluate(
    answer: string,
    question: Question,
    rubric: SystemDesignRubric
  ): Promise<SystemDesignEvaluation> {
    const prompt = `
You are evaluating a system design interview answer. Score each category 0-100.

Question: ${question.title}
Requirements: ${question.systemDesignParams.requirements.join(', ')}
Expected Components: ${question.systemDesignParams.expectedComponents.join(', ')}

Candidate Answer:
${answer}

Scoring Rubric:
- 90-100: Expert level, covers all edge cases, quantified decisions
- 70-89: Good understanding, minor gaps, reasonable tradeoffs
- 50-69: Basic understanding, significant gaps, vague explanations
- 0-49: Fundamentally wrong or incomplete

Be STRICT. Do not give partial credit for mentioning keywords without explanation.
Evaluate based on DEPTH of understanding, not keyword density.

Return JSON matching this schema: ${JSON.stringify(zodToJsonSchema(SystemDesignEvaluationSchema))}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });
    
    const parsed = SystemDesignEvaluationSchema.parse(
      JSON.parse(response.choices[0].message.content)
    );
    
    return parsed;
  }
}
```

### 5.3 AI-Powered Code Quality Analysis
**New Feature**: Evaluate beyond test case passing

```typescript
// backend/src/services/evaluation/codeQuality.service.ts
const CodeQualitySchema = z.object({
  timeComplexity: z.object({
    detected: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(2^n)', 'O(n!)']),
    optimal: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(2^n)', 'O(n!)']),
    isOptimal: z.boolean(),
    explanation: z.string()
  }),
  spaceComplexity: z.object({
    detected: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n^2)']),
    optimal: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n^2)']),
    isOptimal: z.boolean()
  }),
  codeQuality: z.object({
    readability: z.number().min(0).max(100),
    maintainability: z.number().min(0).max(100),
    efficiency: z.number().min(0).max(100),
    issues: z.array(z.object({
      line: z.number(),
      severity: z.enum(['error', 'warning', 'info']),
      message: z.string()
    }))
  }),
  edgeCaseHandling: z.object({
    score: z.number().min(0).max(100),
    missedCases: z.array(z.string())
  })
});

export class CodeQualityAnalyzer {
  async analyze(
    code: string,
    language: string,
    question: Question,
    passedTestCases: boolean
  ): Promise<CodeQualityAnalysis> {
    const prompt = `
Analyze this ${language} code for a coding interview.

Question: ${question.title}
Expected Time Complexity: ${question.timeComplexity}
Expected Space Complexity: ${question.spaceComplexity}

Candidate Code:
\`\`\`${language}
${code}
\`\`\`

Test cases ${passedTestCases ? 'PASSED' : 'FAILED'}.

Analyze:
1. Actual time/space complexity (trace through the code)
2. Code quality issues (naming, structure, edge cases)
3. Whether the solution is optimal
4. What edge cases might be missing

Be HONEST - if the code is bad, say so. If they brute-forced an O(n) problem with O(n^2), mark them down.

Return JSON matching schema: ${JSON.stringify(zodToJsonSchema(CodeQualitySchema))}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });
    
    return CodeQualitySchema.parse(JSON.parse(response.choices[0].message.content));
  }
}
```

---

## Phase 6: Infrastructure & Operations

### 6.1 Redis Integration
**New Infrastructure**: Caching, sessions, rate limiting

```typescript
// backend/src/infrastructure/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3
});

// Redis key patterns
export const Keys = {
  interviewSession: (id: string) => `interview:session:${id}`,
  proctoringEvents: (id: string) => `interview:proctoring:${id}:events`,
  codeExecutionResult: (jobId: string) => `execution:result:${jobId}`,
  questionPool: (difficulty: string, topics: string) => 
    `questions:pool:${difficulty}:${topics}`,
  userAttempts: (userId: string, questionId: string) => 
    `attempts:${userId}:${questionId}`,
  rateLimit: (userId: string, endpoint: string) => 
    `ratelimit:${userId}:${endpoint}`
};
```

### 6.2 Advanced Rate Limiting
**Current Issue**: Basic Express middleware

**Solution**: Redis-backed sliding window with burst support

```typescript
// backend/src/middleware/rateLimiter.ts
import { redis } from '../infrastructure/redis';

interface RateLimitConfig {
  windowMs: number; // Time window
  maxRequests: number; // Max requests in window
  burstAllowance?: number; // Allow temporary burst
  keyPrefix?: string;
}

export class SlidingWindowRateLimiter {
  async checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = `ratelimit:${config.keyPrefix}:${identifier}`;
    
    // Remove old entries outside window
    await redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    const currentCount = await redis.zcard(key);
    
    if (currentCount >= config.maxRequests) {
      const oldestTimestamp = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = parseInt(oldestTimestamp[1]) + config.windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }
    
    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, Math.ceil(config.windowMs / 1000) + 1);
    
    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetTime: now + config.windowMs
    };
  }
}

// Different limits for different endpoints
export const rateLimits = {
  interviewStart: { windowMs: 60000, maxRequests: 2 }, // 2 starts per minute
  codeSubmit: { windowMs: 10000, maxRequests: 5 }, // 5 submits per 10s
  codeRun: { windowMs: 5000, maxRequests: 10 }, // 10 runs per 5s
  aiChat: { windowMs: 60000, maxRequests: 20 } // 20 messages per minute
};
```

### 6.3 Monitoring & Observability
**New Feature**: Comprehensive logging, metrics, alerting

```typescript
// backend/src/infrastructure/monitoring.ts
import { metrics } from '@opentelemetry/api';

export class InterviewMetrics {
  private meter = metrics.getMeter('interview-simulator');
  
  // Counters
  public interviewStarted = this.meter.createCounter('interview.started');
  public interviewCompleted = this.meter.createCounter('interview.completed');
  public interviewTerminated = this.meter.createCounter('interview.terminated');
  public codeExecuted = this.meter.createCounter('code.executed');
  public proctoringViolation = this.meter.createCounter('proctoring.violation');
  
  // Histograms
  public executionTime = this.meter.createHistogram('code.execution.duration', {
    unit: 'ms',
    description: 'Code execution duration'
  });
  
  public scoreDistribution = this.meter.createHistogram('interview.score', {
    unit: '1',
    description: 'Interview score distribution'
  });
  
  // Gauges
  public activeInterviews = this.meter.createObservableGauge('interview.active');
  public queueDepth = this.meter.createObservableGauge('execution.queue.depth');
}

// Structured logging
export const logger = {
  info: (message: string, context: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...context, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error: Error, context: Record<string, unknown>) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      message, 
      error: error.message,
      stack: error.stack,
      ...context, 
      timestamp: new Date().toISOString() 
    }));
  },
  audit: (action: string, userId: string, details: Record<string, unknown>) => {
    console.log(JSON.stringify({ 
      level: 'audit', 
      action, 
      userId, 
      ...details, 
      timestamp: new Date().toISOString() 
    }));
  }
};
```

---

## Phase 7: Frontend State Management

### 7.1 Optimistic UI with Conflict Resolution
**Current Issue**: Race conditions on rapid navigation

**Solution**: Optimistic updates with server reconciliation

```typescript
// frontend/src/hooks/useInterviewState.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface InterviewState {
  session: InterviewSession;
  pendingChanges: Map<string, QuestionUpdate>;
  syncStatus: 'synced' | 'syncing' | 'error';
}

export function useInterviewState(sessionId: string) {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Map<string, QuestionUpdate>>(new Map());
  
  // Fetch session with polling
  const { data: session, isLoading } = useQuery({
    queryKey: ['interview', sessionId],
    queryFn: () => api.getInterviewSession(sessionId),
    refetchInterval: 30000, // Poll every 30s for session updates
    staleTime: 5000
  });
  
  // Optimistic code update
  const updateCode = useMutation({
    mutationFn: async ({ questionIndex, code }: { questionIndex: number; code: string }) => {
      return api.updateDraft(sessionId, questionIndex, code);
    },
    onMutate: async ({ questionIndex, code }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['interview', sessionId] });
      
      // Snapshot previous value
      const previousSession = queryClient.getQueryData(['interview', sessionId]);
      
      // Optimistically update
      queryClient.setQueryData(['interview', sessionId], (old: InterviewSession) => ({
        ...old,
        sections: old.sections.map((s, si) => 
          s.questions.map((q, qi) => 
            qi === questionIndex ? { ...q, userCode: code } : q
          )
        )
      }));
      
      return { previousSession };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['interview', sessionId], context?.previousSession);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['interview', sessionId] });
    }
  });
  
  // Conflict detection
  useEffect(() => {
    if (!session) return;
    
    // Check for server-side changes that conflict with local state
    const serverQuestion = session.sections[currentSectionIdx]?.questions[currentQuestionIdx];
    const localCode = localStorage.getItem(`interview_draft_${sessionId}_${currentSectionIdx}_${currentQuestionIdx}`);
    
    if (serverQuestion?.userCode && localCode && serverQuestion.userCode !== localCode) {
      // Conflict! Show resolution dialog
      showConflictDialog(serverQuestion.userCode, localCode);
    }
  }, [session, currentSectionIdx, currentQuestionIdx]);
  
  return {
    session,
    isLoading,
    updateCode: updateCode.mutate,
    isUpdating: updateCode.isPending
  };
}
```

### 7.2 Real-time Collaboration Features
**New Feature**: WebSocket for live updates

```typescript
// frontend/src/hooks/useInterviewWebSocket.ts
export function useInterviewWebSocket(sessionId: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/interview/${sessionId}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      // Authenticate
      ws.send(JSON.stringify({ type: 'auth', token: getAuthToken() }));
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'proctoring_alert':
          toast.warning(message.data.message);
          break;
        case 'time_warning':
          toast.error(`Only ${message.data.minutesLeft} minutes remaining!`);
          break;
        case 'session_terminated':
          handleSessionTerminated(message.data.reason);
          break;
        case 'heartbeat':
          // Respond to server heartbeat for connection health
          ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      // Attempt reconnect with exponential backoff
      setTimeout(() => reconnect(sessionId), 1000);
    };
    
    setSocket(ws);
    
    return () => ws.close();
  }, [sessionId]);
  
  const sendProctoringEvent = useCallback((event: ProctoringEvent) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'proctoring', data: event }));
    }
  }, [socket]);
  
  return { isConnected, sendProctoringEvent };
}
```

---

## Phase 8: Testing & Quality Assurance

### 8.1 Load Testing Suite
**New Feature**: Verify system handles traffic

```typescript
// backend/tests/load/execution.load.test.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 200 }, // Ramp to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
  },
};

const code = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
`;

export default function () {
  const response = http.post(`${BASE_URL}/api/interview/run`, {
    sessionId: 'test-session',
    questionIndex: 0,
    code,
    language: 'javascript'
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
}
```

### 8.2 Security Audit Checklist
**New Process**: Automated security testing

```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Dependency vulnerability scan
      - name: Audit Dependencies
        run: npm audit --audit-level=moderate
      
      # Static analysis
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      
      # Secrets detection
      - name: Detect Secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
      
      # Container scanning
      - name: Build and Scan Container
        run: |
          docker build -t interview-simulator:latest .
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image interview-simulator:latest
```

### 8.3 Chaos Engineering
**New Feature**: Test resilience

```typescript
// backend/tests/chaos/execution.chaos.test.ts
describe('Execution Service Chaos Tests', () => {
  it('should handle Docker daemon restart', async () => {
    // Start long-running execution
    const jobPromise = executionQueue.enqueue('javascript', longRunningCode, []);
    
    // Simulate Docker daemon failure
    await simulateDockerFailure();
    
    // Should gracefully handle and retry
    const result = await jobPromise;
    expect(result.status).toBe('completed');
  });
  
  it('should handle Redis failover', async () => {
    // Kill Redis master
    await killRedisMaster();
    
    // System should continue with degraded cache
    const result = await questionService.getQuestion('test-id');
    expect(result).toBeDefined();
  });
  
  it('should handle AI service degradation', async () => {
    // Slow down AI responses
    await simulateAISlowdown(10000); // 10s latency
    
    // Should timeout and use fallback
    const question = await questionService.generateQuestion('easy', ['array']);
    expect(question).toBeDefined();
    expect(question.source).toBe('cache_fallback');
  });
});
```

---

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Redis infrastructure
- [ ] Database schema redesign
- [ ] Circuit breaker implementation
- [ ] Structured AI outputs

### Week 3-4: Security & Proctoring
- [ ] Server-side proctoring attestation
- [ ] HMAC verification
- [ ] Behavioral biometrics
- [ ] Anti-debug measures

### Week 5-6: Execution Engine
- [ ] Docker sandboxing
- [ ] Resource limits (cgroups)
- [ ] Async queue implementation
- [ ] Multi-language support expansion

### Week 7-8: Question Database
- [ ] Import pipeline (LeetCode, HackerRank)
- [ ] 500+ question seeding
- [ ] Smart selection algorithm
- [ ] Test case generation

### Week 9-10: Evaluation Engine
- [ ] Semantic system design evaluation
- [ ] Code quality analysis
- [ ] Weighted scoring
- [ ] Edge case categorization

### Week 11-12: Frontend & Integration
- [ ] Optimistic UI
- [ ] WebSocket real-time
- [ ] Conflict resolution
- [ ] Performance optimization

### Week 13-14: Testing & Hardening
- [ ] Load testing
- [ ] Security audit
- [ ] Chaos engineering
- [ ] Documentation

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Questions in DB | 4 | 1000+ |
| Code execution failures | ~10% | <1% |
| AI generation success | ~70% | >95% |
| Proctoring accuracy | ~30% (client-side) | >90% (verified) |
| Avg response time | ~3s | <500ms (cached) |
| Concurrent users | ~10 | 1000+ |
| Security vulnerabilities | Unknown | 0 critical |

---

## Files to Create/Modify

### New Files (50+)
```
backend/src/
├── services/
│   ├── proctoring/
│   │   ├── attestation.service.ts
│   │   ├── behavioralAnalysis.service.ts
│   │   └── tamperDetection.service.ts
│   ├── ai/
│   │   ├── structuredQuestion.service.ts
│   │   ├── circuitBreaker.service.ts
│   │   ├── cachedQuestion.service.ts
│   │   └── embeddingCache.service.ts
│   ├── evaluation/
│   │   ├── weightedScoring.service.ts
│   │   ├── semanticSystemDesign.service.ts
│   │   └── codeQuality.service.ts
│   └── execution/
│       ├── sandboxedExecution.service.ts
│       ├── executionQueue.service.ts
│       └── languageRuntimes/
│           ├── javascriptRunner.ts
│           ├── pythonRunner.ts
│           └── ...
├── infrastructure/
│   ├── redis.ts
│   ├── monitoring.ts
│   └── websocket/
│       ├── connectionManager.ts
│       └── messageHandlers/
├── models/
│   └── Question.ts (major refactor)
└── scripts/
    ├── seedProductionQuestions.ts
    ├── importers/
    │   ├── leetcode.importer.ts
    │   └── hackerrank.importer.ts
    └── validators/
        └── question.validator.ts

frontend/src/
├── hooks/
│   ├── useSecureProctoring.ts
│   ├── useInterviewState.ts
│   └── useInterviewWebSocket.ts
├── components/
│   └── ConflictResolutionDialog.tsx
└── services/
    └── optimisticUpdate.ts

infrastructure/
├── docker/
│   └── execution-environments/
│       ├── Dockerfile.javascript
│       ├── Dockerfile.python
│       └── ...
└── k8s/
    ├── deployment.yaml
    ├── hpa.yaml
    └── redis-sentinel.yaml
```

### Major Refactors (10+)
```
backend/src/
├── services/
│   ├── interview.service.ts (add proctoring verification)
│   ├── interviewJudge.service.ts (add semantic evaluation)
│   ├── questionGeneration.service.ts (use structured outputs)
│   └── execution.service.ts (move to sandboxed)
├── routes/
│   └── interview.ts (add WebSocket endpoint)
└── domain/
    └── interview.domain.ts (update scoring logic)

frontend/src/
├── pages/
│   └── Interview/
│       ├── InterviewRoom.tsx (optimistic updates)
│       └── InterviewSetup.tsx (improved UX)
└── hooks/
    └── useStrictProctoring.ts (replace with secure version)
```

---

## Cost Estimates

| Component | Monthly Cost |
|-----------|--------------|
| Compute (2x 8GB nodes) | $200 |
| Redis (Elasticache) | $150 |
| OpenAI API (100k questions) | $500 |
| Docker Hub (private repos) | $20 |
| Monitoring (DataDog) | $100 |
| Load Balancer | $25 |
| **Total** | **~$995/mo** |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI generation unreliable | Medium | High | Cache fallback + manual curation |
| Docker sandbox escape | Low | Critical | Use Firecracker microVMs |
| Redis single point of failure | Medium | High | Redis Sentinel cluster |
| Proctoring false positives | Medium | Medium | Human review queue |
| AI costs ballooning | Medium | Medium | Rate limits + aggressive caching |

---

## Conclusion

This plan addresses **every single issue** identified in the review:

1. ✅ Security/Proctoring: Server-side verification, tamper-proof client
2. ✅ AI Integration: Structured outputs, retries, caching
3. ✅ Question DB: 1000+ questions with proper test cases
4. ✅ Code Execution: Resource limits, sandboxing, queues
5. ✅ Evaluation: Semantic system design, weighted scoring
6. ✅ Infrastructure: Redis, monitoring, rate limiting
7. ✅ State Management: Optimistic UI, conflict resolution
8. ✅ Testing: Load, security, chaos engineering

**Timeline: 14 weeks to production grade.**
**Zero shortcuts. Zero compromises.**
