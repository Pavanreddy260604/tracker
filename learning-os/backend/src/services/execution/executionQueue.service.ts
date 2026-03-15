import Bull from 'bull';
import { redis } from '../../infrastructure/redis.js';
import { SandboxedExecutionService, ExecutionLimits, TestCaseResult } from './sandboxedExecution.service.js';

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

interface ExecutionJobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'cancelled';
  results?: TestCaseResult[];
  error?: string;
  executionTimeMs: number;
  completedAt: Date;
}

export class ExecutionQueueService {
  private queue: Bull.Queue<ExecutionJob>;
  private executionService: SandboxedExecutionService;
  private readonly MAX_CONCURRENT = 5;
  private readonly JOB_TIMEOUT_MS = 30000; // 30 seconds max

  constructor() {
    this.executionService = new SandboxedExecutionService();
    
    this.queue = new Bull('code-execution', {
      redis: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
          count: 100
        },
        removeOnFail: {
          age: 7200, // Keep for 2 hours
          count: 50
        },
        timeout: this.JOB_TIMEOUT_MS
      }
    });

    this.setupWorkers();
    this.setupEventHandlers();
  }

  private setupWorkers(): void {
    // Process jobs with concurrency limit
    this.queue.process(this.MAX_CONCURRENT, async (job) => {
      const startTime = Date.now();
      
      try {
        console.log(`[ExecutionQueue] Processing job ${job.id} for session ${job.data.sessionId}`);
        
        const results = await this.executionService.runTestCases(
          job.data.language,
          job.data.code,
          job.data.testCases,
          job.data.limits
        );

        const executionTimeMs = Date.now() - startTime;

        // Store result in Redis for quick retrieval
        const result: ExecutionJobResult = {
          jobId: String(job.id),
          status: 'completed',
          results,
          executionTimeMs,
          completedAt: new Date()
        };

        await redis.setex(
          `execution:result:${job.id}`,
          3600, // 1 hour TTL
          JSON.stringify(result)
        );

        return result;
      } catch (error) {
        const executionTimeMs = Date.now() - startTime;
        
        console.error(`[ExecutionQueue] Job ${job.id} failed:`, error);
        
        const result: ExecutionJobResult = {
          jobId: String(job.id),
          status: 'failed',
          error: (error as Error).message,
          executionTimeMs,
          completedAt: new Date()
        };

        await redis.setex(
          `execution:result:${job.id}`,
          3600,
          JSON.stringify(result)
        );

        throw error; // Let Bull handle retry
      }
    });
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', (job) => {
      console.log(`[ExecutionQueue] Job ${job.id} completed`);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`[ExecutionQueue] Job ${job.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`[ExecutionQueue] Job ${job.id} stalled`);
    });

    this.queue.on('error', (error) => {
      console.error('[ExecutionQueue] Queue error:', error);
    });
  }

  /**
   * Enqueue a code execution job
   */
  async enqueue(
    language: string,
    code: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
    sessionId: string,
    userId: string,
    questionId: string,
    limits?: Partial<ExecutionLimits>,
    priority: number = 5
  ): Promise<string> {
    // Calculate priority based on code length (shorter = faster)
    const lengthPriority = Math.max(1, 10 - Math.floor(code.length / 1000));
    const finalPriority = Math.min(priority, lengthPriority);

    const job = await this.queue.add({
      language,
      code,
      testCases,
      limits: {
        maxExecutionTimeMs: 5000,
        maxMemoryMB: 256,
        maxOutputBytes: 10240,
        maxProcesses: 1,
        maxFileDescriptors: 64,
        networkAccess: false,
        maxFileSizeMB: 1,
        ...limits
      },
      priority: finalPriority,
      sessionId,
      userId,
      questionId
    }, {
      priority: finalPriority
    });

    console.log(`[ExecutionQueue] Enqueued job ${job.id} with priority ${finalPriority}`);
    
    return String(job.id);
  }

  /**
   * Get job result (checks Redis cache first)
   */
  async getResult(jobId: string): Promise<ExecutionJobResult | null> {
    // Check Redis first
    const cached = await redis.get(`execution:result:${jobId}`);
    if (cached) {
      return JSON.parse(cached) as ExecutionJobResult;
    }

    // Check Bull job
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    
    if (state === 'completed') {
      return job.returnvalue as ExecutionJobResult;
    }
    
    if (state === 'failed') {
      return {
        jobId,
        status: 'failed',
        error: job.failedReason || 'Unknown error',
        executionTimeMs: 0,
        completedAt: new Date()
      };
    }

    return null; // Still pending
  }

  /**
   * Wait for job completion with timeout
   */
  async waitForResult(
    jobId: string,
    timeoutMs: number = 10000
  ): Promise<ExecutionJobResult> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.getResult(jobId);
      
      if (result && (result.status === 'completed' || result.status === 'failed')) {
        return result;
      }

      await this.sleep(checkInterval);
    }

    throw new Error(`Timeout waiting for job ${jobId}`);
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      
      await redis.setex(
        `execution:result:${jobId}`,
        3600,
        JSON.stringify({
          jobId,
          status: 'cancelled',
          executionTimeMs: 0,
          completedAt: new Date()
        })
      );
      
      return true;
    }

    return false;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Clean up old jobs
   */
  async cleanup(): Promise<void> {
    await this.queue.clean(3600000, 'completed'); // Remove completed older than 1 hour
    await this.queue.clean(7200000, 'failed');    // Remove failed older than 2 hours
    console.log('[ExecutionQueue] Cleanup completed');
  }

  /**
   * Pause queue processing
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('[ExecutionQueue] Paused');
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('[ExecutionQueue] Resumed');
  }

  /**
   * Drain all jobs (use with caution)
   */
  async drain(): Promise<void> {
    await this.queue.drain();
    console.log('[ExecutionQueue] Drained');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const executionQueueService = new ExecutionQueueService();
