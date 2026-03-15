import { AIServiceError } from '../aiClient.service.js';

interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  resetTimeoutMs: number;          // Time before attempting reset
  halfOpenMaxCalls: number;       // Max calls in half-open state
  successThreshold: number;       // Successes needed to close
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  halfOpenCalls: number;
}

export class AICircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
    lastFailureTime: 0,
    halfOpenCalls: 0
  };

  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,  // 30 seconds
      halfOpenMaxCalls: 3,
      successThreshold: 2,
      ...config
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    // Check if we should transition from open to half-open
    if (this.state.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
      
      if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
        this.transitionTo('half-open');
      } else {
        // Circuit is open, use fallback or throw
        if (fallback) {
          return fallback();
        }
        throw new AIServiceError(
          `Circuit breaker is OPEN. Retry after ${this.getRemainingCooldown()}ms`,
          { recoverable: true, context: 'circuit_breaker' }
        );
      }
    }

    // Limit half-open calls
    if (this.state.state === 'half-open') {
      if (this.state.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new AIServiceError(
          'Circuit breaker half-open limit reached',
          { recoverable: true, context: 'circuit_breaker' }
        );
      }
      this.state.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute with automatic retries
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000,
    retryableErrors: string[] = ['ETIMEDOUT', 'ECONNRESET', 'rate_limit_exceeded']
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(fn);
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        const errorMessage = lastError.message.toLowerCase();
        const isRetryable = retryableErrors.some(e => errorMessage.includes(e.toLowerCase()));
        
        if (!isRetryable || attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelayMs
        );
        
        console.log(`[CircuitBreaker] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  private onSuccess(): void {
    if (this.state.state === 'half-open') {
      this.state.successCount++;
      
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else {
      this.state.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.state.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: 'closed' | 'open' | 'half-open'): void {
    const oldState = this.state.state;
    this.state.state = newState;
    
    // Reset counters
    if (newState === 'closed') {
      this.state.failureCount = 0;
      this.state.successCount = 0;
      this.state.halfOpenCalls = 0;
    } else if (newState === 'half-open') {
      this.state.successCount = 0;
      this.state.halfOpenCalls = 0;
    } else if (newState === 'open') {
      this.state.halfOpenCalls = 0;
    }
    
    console.log(`[CircuitBreaker] ${oldState} -> ${newState}`);
  }

  private getRemainingCooldown(): number {
    if (this.state.state !== 'open') return 0;
    const elapsed = Date.now() - this.state.lastFailureTime;
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  isClosed(): boolean {
    return this.state.state === 'closed';
  }

  isOpen(): boolean {
    return this.state.state === 'open';
  }
}

// Circuit breaker registry for multiple services
export class CircuitBreakerRegistry {
  private breakers = new Map<string, AICircuitBreaker>();

  get(name: string, config?: Partial<CircuitBreakerConfig>): AICircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new AICircuitBreaker(config));
    }
    return this.breakers.get(name)!;
  }

  getHealth(): Record<string, { state: string; failureCount: number }> {
    const health: Record<string, { state: string; failureCount: number }> = {};
    
    for (const [name, breaker] of this.breakers) {
      const state = breaker.getState();
      health[name] = {
        state: state.state,
        failureCount: state.failureCount
      };
    }
    
    return health;
  }

  resetAll(): void {
    this.breakers.clear();
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
