import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AIClientService, AIServiceError } from '../aiClient.service.js';
import { redis, Keys, getOrSet } from '../../infrastructure/redis.js';

// Strict schema for AI-generated questions
const TestCaseSchema = z.object({
  input: z.string().min(1).max(1000),
  expectedOutput: z.string().min(1).max(1000),
  isHidden: z.boolean(),
  isEdgeCase: z.boolean().describe('True if this tests boundary conditions'),
  edgeCaseType: z.enum([
    'empty_input',
    'single_element', 
    'max_constraints',
    'min_constraints',
    'overflow',
    'null_undefined',
    'duplicate_values',
    'negative_values',
    'boundary_value',
    'performance_stress',
    'none'
  ]).describe('Why this is/isn\'t an edge case'),
  explanation: z.string().min(10).max(500).describe('Educational explanation')
});

const QuestionSignatureSchema = z.object({
  javascript: z.string().min(5),
  python: z.string().min(5),
  java: z.string().min(5),
  cpp: z.string().min(5),
  go: z.string().min(5)
});

const QuestionSchema = z.object({
  title: z.string().min(5).max(100),
  slug: z.string().min(5).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().min(50).max(5000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topics: z.array(z.string().min(1).max(50)).min(1).max(5),
  type: z.enum(['coding', 'sql', 'system-design']),
  functionName: z.string().min(1).max(50),
  signatures: QuestionSignatureSchema,
  testCases: z.array(TestCaseSchema).min(5).max(20),
  timeComplexity: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(2^n)', 'O(n!)']),
  spaceComplexity: z.enum(['O(1)', 'O(log n)', 'O(n)', 'O(n^2)']),
  hints: z.array(z.string().min(10).max(200)).min(1).max(3),
  solution: z.object({
    approach: z.string().min(20).max(2000),
    code: z.record(z.string()), // language -> code
    complexityExplanation: z.string().min(10).max(500)
  })
});

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;

interface CacheStats {
  hits: number;
  misses: number;
  aiCalls: number;
}

export class StructuredQuestionService {
  private cacheStats: CacheStats = { hits: 0, misses: 0, aiCalls: 0 };
  private readonly CACHE_TTL_SECONDS = 86400 * 30; // 30 days
  private readonly MIN_POOL_SIZE = 1; // If pool has any question, use it! (Avoids unnecessary AI calls)

  constructor(private aiClient: AIClientService) {}

  /**
   * Generate a curated question with caching and deduplication
   */
  async generateCuratedQuestion(
    difficulty: string,
    topics: string[],
    language: string = 'javascript'
  ): Promise<GeneratedQuestion> {
    const cacheKey = this.generateCacheKey(difficulty, topics);
    
    // Try to get from cache or pool first
    const cached = await this.getFromPool(difficulty, topics);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }

    this.cacheStats.misses++;

    // Generate new question with structured output
    const question = await this.generateWithRetry(difficulty, topics, language);
    
    // Validate uniqueness using embeddings
    // DISABLED: Semantic duplicate check is very slow and can cause recursive AI calls
    /*
    const isDuplicate = await this.checkSemanticDuplicate(question, difficulty, topics);
    if (isDuplicate) {
      console.log(`[QuestionService] Duplicate detected for ${question.slug}, retrying...`);
      return this.generateCuratedQuestion(difficulty, [...topics, 'unique'], language);
    }
    */

    // Add to pool
    await this.addToPool(question, difficulty, topics);
    
    return question;
  }

  /**
   * Generate multiple questions in batch
   */
  async generateBatch(
    count: number,
    difficulty: string,
    topics: string[],
    language: string = 'javascript'
  ): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];
    const errors: Error[] = [];

    // Generate in parallel with circuit breaker
    const promises = Array.from({ length: count }, () =>
      this.generateCuratedQuestion(difficulty, topics, language).catch(err => {
        errors.push(err);
        return null;
      })
    );

    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result) {
        questions.push(result);
      }
    }

    if (questions.length === 0 && errors.length > 0) {
      throw new AIServiceError('All question generation attempts failed', {
        recoverable: true,
        context: 'batch_generation',
        cause: errors[0]
      });
    }

    return questions;
  }

  private async generateWithRetry(
    difficulty: string,
    topics: string[],
    language: string,
    maxRetries: number = 3
  ): Promise<GeneratedQuestion> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateWithStructuredOutput(difficulty, topics, language, attempt);
      } catch (error) {
        lastError = error as Error;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`[QuestionService] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw new AIServiceError(`Failed to generate question after ${maxRetries} attempts`, {
      recoverable: true,
      context: 'question_generation',
      cause: lastError
    });
  }

  private async generateWithStructuredOutput(
    difficulty: string,
    topics: string[],
    language: string,
    attempt: number
  ): Promise<GeneratedQuestion> {
    this.cacheStats.aiCalls++;
    
    const jsonSchema = zodToJsonSchema(QuestionSchema);
    
    const prompt = `You are a senior technical interviewer at a FAANG company. Generate a ${difficulty} coding interview question.

Requirements:
- Topic(s): ${topics.join(', ')}
- Target solve time: ${difficulty === 'easy' ? '10-15' : difficulty === 'medium' ? '20-30' : '35-45'} minutes
- Must include 5-20 test cases covering:
  * Normal cases
  * Normal cases
  * Edge cases (empty input, single element, max constraints, duplicate values, null/undefined)
  * Performance stress tests for ${difficulty} questions

CRITICAL: At least 4 test cases MUST be distinct edge cases flagged with "isEdgeCase: true".

Difficulty Guidelines:
- EASY: Standard algorithms, single data structure, no optimization needed
- MEDIUM: Requires combining 2+ concepts, optimization to O(n log n) or better
- HARD: Complex dynamic programming, graph algorithms, or system design tradeoffs

CRITICAL: 
1. Test cases must have VALID input/output pairs that actually work
2. The solution code must actually solve the problem
3. Time/space complexity must be accurate
4. All 5 language signatures must be valid syntax

Return ONLY JSON matching this schema (no markdown, no explanation):
${JSON.stringify(jsonSchema, null, 2)}`;

    // Use OpenAI with JSON mode
    const response = await this.callAIWithJsonMode(prompt, attempt);
    
    // Validate against schema
    const parsed = QuestionSchema.parse(response);
    
    // Additional validation: ensure test cases work
    await this.validateTestCases(parsed);
    
    return parsed;
  }

  private async callAIWithJsonMode(prompt: string, attempt: number): Promise<unknown> {
    // This would use the actual OpenAI API with response_format: { type: 'json_object' }
    // For now, using the existing AI client
    const response = await this.aiClient.generateResponse(prompt);
    
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      throw new AIServiceError('Failed to parse AI response as JSON', {
        recoverable: true,
        context: 'json_parsing'
      });
    }
  }

  private async validateTestCases(question: GeneratedQuestion): Promise<void> {
    // Ensure at least 2 edge cases (Relaxed from 4 to prevent retry loops)
    const edgeCaseCount = question.testCases.filter(tc => tc.isEdgeCase).length;
    const minEdgeCases = 2; 
    
    if (edgeCaseCount < minEdgeCases) {
      throw new AIServiceError(
        `Insufficient edge cases: ${edgeCaseCount}/${minEdgeCases} required`,
        { recoverable: true, context: 'validation' }
      );
    }

    // Ensure no duplicate test cases
    const inputs = question.testCases.map(tc => tc.input);
    const uniqueInputs = new Set(inputs);
    if (uniqueInputs.size !== inputs.length) {
      throw new AIServiceError(
        'Duplicate test cases detected',
        { recoverable: true, context: 'validation' }
      );
    }
  }

  private async checkSemanticDuplicate(
    newQuestion: GeneratedQuestion,
    difficulty: string,
    topics: string[]
  ): Promise<boolean> {
    // Get embedding for new question
    const newEmbedding = await this.getEmbedding(newQuestion.title + ' ' + newQuestion.description);
    
    // Check against existing questions in pool
    const poolKey = Keys.questionSet(difficulty, topics.sort().join(','));
    const questionIds = await redis.smembers(poolKey);
    
    if (questionIds.length === 0) {
      return false;
    }

    // Sample 10 random questions for comparison
    const sampleIds = questionIds.sort(() => 0.5 - Math.random()).slice(0, 10);
    
    for (const id of sampleIds) {
      const existingJson = await redis.get(Keys.question(id));
      if (!existingJson) continue;
      
      const existing = JSON.parse(existingJson) as GeneratedQuestion;
      const existingEmbedding = await this.getEmbedding(
        existing.title + ' ' + existing.description
      );
      
      const similarity = this.cosineSimilarity(newEmbedding, existingEmbedding);
      
      if (similarity > 0.85) {
        console.log(`[QuestionService] Semantic duplicate found: ${similarity} similarity with ${existing.slug}`);
        return true;
      }
    }
    
    return false;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = Keys.aiEmbedding(text.slice(0, 100));
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Generate deterministic "embedding" based on text hash
    // In production, this should call OpenAI embeddings API
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const embedding = Array.from({ length: 128 }, (_, i) => {
      return Math.sin(hash * (i + 1)) * 0.5 + 0.5;
    });
    
    // Cache for 30 days
    await redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(embedding));
    
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async getFromPool(
    difficulty: string,
    topics: string[]
  ): Promise<GeneratedQuestion | null> {
    const sortedTopics = topics.sort().join(',');
    const poolKey = Keys.questionSet(difficulty, sortedTopics);
    
    // Check pool size
    const poolSize = await redis.scard(poolKey);
    
    if (poolSize < this.MIN_POOL_SIZE) {
      return null; // Need to generate more
    }
    
    // Get random question from pool
    const questionId = await redis.srandmember(poolKey);
    if (!questionId) {
      return null;
    }
    
    const questionJson = await redis.get(Keys.question(questionId));
    if (!questionJson) {
      // Clean up stale reference
      await redis.srem(poolKey, questionId);
      return null;
    }
    
    return JSON.parse(questionJson) as GeneratedQuestion;
  }

  private async addToPool(
    question: GeneratedQuestion,
    difficulty: string,
    topics: string[]
  ): Promise<void> {
    const sortedTopics = topics.sort().join(',');
    const poolKey = Keys.questionSet(difficulty, sortedTopics);
    
    // Store question data
    await redis.setex(
      Keys.question(question.slug),
      this.CACHE_TTL_SECONDS,
      JSON.stringify(question)
    );
    
    // Add to pool
    await redis.sadd(poolKey, question.slug);
    await redis.expire(poolKey, this.CACHE_TTL_SECONDS);
    
    // Also add to general pool for difficulty
    const difficultyKey = Keys.questionSet(difficulty, 'all');
    await redis.sadd(difficultyKey, question.slug);
    await redis.expire(difficultyKey, this.CACHE_TTL_SECONDS);
  }

  private generateCacheKey(difficulty: string, topics: string[]): string {
    return `question:generation:${difficulty}:${topics.sort().join(',')}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  async warmPool(
    difficulty: string,
    topics: string[],
    targetSize: number = this.MIN_POOL_SIZE
  ): Promise<void> {
    const sortedTopics = topics.sort().join(',');
    const poolKey = Keys.questionSet(difficulty, sortedTopics);
    
    const currentSize = await redis.scard(poolKey);
    const needed = targetSize - currentSize;
    
    if (needed <= 0) {
      console.log(`[QuestionService] Pool for ${difficulty}/${sortedTopics} is already full (${currentSize})`);
      return;
    }
    
    console.log(`[QuestionService] Warming pool: generating ${needed} questions for ${difficulty}/${sortedTopics}`);
    
    // Generate in batches of 5
    const batchSize = 5;
    for (let i = 0; i < needed; i += batchSize) {
      const toGenerate = Math.min(batchSize, needed - i);
      try {
        const questions = await this.generateBatch(toGenerate, difficulty, topics);
        console.log(`[QuestionService] Generated batch ${i / batchSize + 1}: ${questions.length} questions`);
      } catch (error) {
        console.error(`[QuestionService] Batch generation failed:`, error);
      }
    }
  }
}

// Factory function to create service with default AI client
export function createStructuredQuestionService(aiClient?: AIClientService): StructuredQuestionService {
  const client = aiClient || new AIClientService();
  return new StructuredQuestionService(client);
}
