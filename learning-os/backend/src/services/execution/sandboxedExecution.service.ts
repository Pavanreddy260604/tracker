import Docker from 'dockerode';
import { redis, Keys } from '../../infrastructure/redis.js';

export interface ExecutionLimits {
  maxExecutionTimeMs: number;      // Default: 5000ms
  maxMemoryMB: number;             // Default: 256MB
  maxOutputBytes: number;          // Default: 10KB
  maxProcesses: number;              // Default: 1
  maxFileDescriptors: number;       // Default: 64
  networkAccess: boolean;            // Default: false
  maxFileSizeMB: number;            // Default: 1MB
}

export interface ExecutionResult {
  status: 'success' | 'error' | 'timeout' | 'memory_exceeded' | 'runtime_error';
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsedMB: number;
  truncated: boolean;
}

export interface TestCaseResult extends ExecutionResult {
  testCaseIndex: number;
  passed: boolean;
  expectedOutput?: string;
  actualOutput?: string;
}

const DEFAULT_LIMITS: ExecutionLimits = {
  maxExecutionTimeMs: 5000,
  maxMemoryMB: 256,
  maxOutputBytes: 10240,
  maxProcesses: 1,
  maxFileDescriptors: 64,
  networkAccess: false,
  maxFileSizeMB: 1
};

const LANGUAGE_CONFIG: Record<string, { image: string; filename: string; command: string }> = {
  javascript: {
    image: 'interview-runtime:node-20',
    filename: 'solution.js',
    command: 'node solution.js'
  },
  python: {
    image: 'interview-runtime:python-3.11',
    filename: 'solution.py',
    command: 'python solution.py'
  },
  java: {
    image: 'interview-runtime:java-17',
    filename: 'Solution.java',
    command: 'javac Solution.java && java Solution'
  },
  cpp: {
    image: 'interview-runtime:cpp-11',
    filename: 'solution.cpp',
    command: 'g++ -std=c++11 -O2 solution.cpp -o solution && ./solution'
  },
  go: {
    image: 'interview-runtime:go-1.21',
    filename: 'solution.go',
    command: 'go run solution.go'
  },
  sql: {
    image: 'interview-runtime:sql-evaluator',
    filename: 'query.sql',
    command: 'python /evaluator.py'
  }
};

export class SandboxedExecutionService {
  private docker: Docker;
  private activeContainers = new Set<string>();

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    });
  }

  /**
   * Execute code in a sandboxed container with strict resource limits
   */
  async execute(
    language: string,
    code: string,
    input: string,
    limits: Partial<ExecutionLimits> = {}
  ): Promise<ExecutionResult> {
    const config = LANGUAGE_CONFIG[language.toLowerCase()];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const mergedLimits = { ...DEFAULT_LIMITS, ...limits };

    // Validate code size
    if (code.length > mergedLimits.maxFileSizeMB * 1024 * 1024) {
      return {
        status: 'error',
        stdout: '',
        stderr: `Code exceeds maximum size of ${mergedLimits.maxFileSizeMB}MB`,
        exitCode: -1,
        executionTimeMs: 0,
        memoryUsedMB: 0,
        truncated: false
      };
    }

    const containerName = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create and start container with resource limits
      const container = await this.docker.createContainer({
        Image: config.image,
        name: containerName,
        Cmd: ['sh', '-c', config.command],
        HostConfig: {
          // Memory limits
          Memory: mergedLimits.maxMemoryMB * 1024 * 1024,
          MemorySwap: mergedLimits.maxMemoryMB * 1024 * 1024, // No swap
          MemorySwappiness: 0,
          
          // CPU limits
          CpuQuota: 100000,  // 100% of 1 CPU
          CpuPeriod: 100000,
          CpuShares: 1024,
          
          // Process limits
          PidsLimit: mergedLimits.maxProcesses,
          
          // File descriptor limits
          Ulimits: [
            { Name: 'nofile', Soft: mergedLimits.maxFileDescriptors, Hard: mergedLimits.maxFileDescriptors }
          ],
          
          // Network isolation
          NetworkMode: mergedLimits.networkAccess ? 'bridge' : 'none',
          
          // Security
          AutoRemove: true,
          ReadonlyRootfs: true,
          SecurityOpt: ['no-new-privileges:true'],
          CapDrop: ['ALL'],
          CapAdd: [],
          
          // Writable tmpfs for temporary files
          Tmpfs: {
            '/tmp': `rw,noexec,nosuid,size=${Math.min(mergedLimits.maxMemoryMB / 2, 50)}m`
          },
          
          // Bind mounts (none allowed)
          Binds: [],
          
          // Prevent privilege escalation
          UsernsMode: '',
          
          // Resource monitoring
          StorageOpt: { size: '100M' }
        },
        Env: [
          `CODE=${Buffer.from(code).toString('base64')}`,
          `INPUT=${Buffer.from(input).toString('base64')}`,
          `OUTPUT_LIMIT=${mergedLimits.maxOutputBytes}`,
          `TIMEOUT_MS=${mergedLimits.maxExecutionTimeMs}`
        ],
        AttachStdout: true,
        AttachStderr: true,
        Tty: false
      });

      this.activeContainers.add(containerName);

      // Attach to streams before starting
      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true
      });

      // Collect output with size limit - parse Docker multiplexed stream format
      // Format: [8-byte header][payload]
      // Header: [1-byte type][3-byte padding][4-byte size]
      let stdout = '';
      let stderr = '';
      let truncated = false;

      stream.on('data', (chunk: Buffer) => {
        let offset = 0;
        while (offset < chunk.length) {
          // Ensure we have full header
          if (offset + 8 > chunk.length) break;
          
          const streamType = chunk[offset];
          const size = chunk.readUInt32BE(offset + 4);
          
          // Ensure we have full payload
          if (offset + 8 + size > chunk.length) break;
          
          const data = chunk.slice(offset + 8, offset + 8 + size).toString('utf8');
          
          if (streamType === 1) { // stdout
            stdout += data;
            if (stdout.length > mergedLimits.maxOutputBytes) {
              stdout = stdout.substring(0, mergedLimits.maxOutputBytes) + '\n[Output truncated]';
              truncated = true;
            }
          } else if (streamType === 2) { // stderr
            stderr += data;
            if (stderr.length > mergedLimits.maxOutputBytes) {
              stderr = stderr.substring(0, mergedLimits.maxOutputBytes) + '\n[Output truncated]';
              truncated = true;
            }
          }
          
          offset += 8 + size;
        }
      });

      // Start container
      const startTime = Date.now();
      await container.start();

      // Wait with timeout
      const waitPromise = container.wait();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), mergedLimits.maxExecutionTimeMs + 1000);
      });

      let exitCode = 0;
      let status: ExecutionResult['status'] = 'success';
      
      try {
        const result = await Promise.race([waitPromise, timeoutPromise]);
        exitCode = result.StatusCode;
      } catch (error) {
        if ((error as Error).message === 'TIMEOUT') {
          status = 'timeout';
          exitCode = -1;
          // Kill the container
          try {
            await container.kill();
          } catch {
            // Ignore kill errors
          }
        } else {
          throw error;
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Get container stats for memory usage
      let memoryUsedMB = 0;
      try {
        const stats = await container.stats({ stream: false });
        memoryUsedMB = Math.round(stats.memory_stats.usage / (1024 * 1024));
      } catch {
        // Ignore stats errors
      }

      // Determine status from exit code and output
      if (status !== 'timeout') {
        if (exitCode !== 0) {
          status = 'runtime_error';
        } else if (stderr.includes('MemoryError') || stderr.includes('out of memory')) {
          status = 'memory_exceeded';
        }
      }

      this.activeContainers.delete(containerName);

      return {
        status,
        stdout,
        stderr,
        exitCode,
        executionTimeMs,
        memoryUsedMB,
        truncated
      };

    } catch (error) {
      this.activeContainers.delete(containerName);
      
      // Attempt cleanup
      try {
        const container = this.docker.getContainer(containerName);
        await container.kill().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(`Execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Run multiple test cases and return results
   */
  async runTestCases(
    language: string,
    code: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
    limits: Partial<ExecutionLimits> = {}
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      const result = await this.execute(language, code, testCase.input, limits);
      
      // Check if output matches expected
      const actualOutput = result.stdout.trim();
      const expectedOutput = testCase.expectedOutput.trim();
      const passed = actualOutput === expectedOutput && result.status === 'success';

      results.push({
        ...result,
        testCaseIndex: i,
        passed,
        expectedOutput,
        actualOutput
      });
    }

    return results;
  }

  /**
   * Get health status of execution service
   */
  async getHealth(): Promise<{ healthy: boolean; activeContainers: number; queueDepth: number }> {
    const activeContainers = this.activeContainers.size;
    
    // Check if we can connect to Docker
    let healthy = false;
    try {
      await this.docker.ping();
      healthy = true;
    } catch {
      healthy = false;
    }

    // Get queue depth from Redis
    const queueDepth = await redis.llen(Keys.executionQueue);

    return { healthy, activeContainers, queueDepth };
  }

  /**
   * Emergency cleanup of all active containers
   */
  async emergencyCleanup(): Promise<void> {
    console.log('[SandboxedExecution] Emergency cleanup initiated');
    
    for (const containerName of this.activeContainers) {
      try {
        const container = this.docker.getContainer(containerName);
        await container.kill().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (error) {
        console.error(`[SandboxedExecution] Failed to cleanup ${containerName}:`, error);
      }
    }
    
    this.activeContainers.clear();
  }
}

// Singleton instance
export const sandboxedExecutionService = new SandboxedExecutionService();
