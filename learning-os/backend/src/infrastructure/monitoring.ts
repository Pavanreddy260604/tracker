import { metrics } from '@opentelemetry/api';

export class InterviewMetrics {
  private meter = metrics.getMeter('interview-simulator');
  
  // Counters
  public interviewStarted = this.meter.createCounter('interview.started', {
    description: 'Number of interviews started'
  });
  
  public interviewCompleted = this.meter.createCounter('interview.completed', {
    description: 'Number of interviews completed'
  });
  
  public interviewTerminated = this.meter.createCounter('interview.terminated', {
    description: 'Number of interviews terminated due to violations'
  });
  
  public codeExecuted = this.meter.createCounter('code.executed', {
    description: 'Number of code executions'
  });
  
  public codeExecutionFailed = this.meter.createCounter('code.execution.failed', {
    description: 'Number of failed code executions'
  });
  
  public proctoringViolation = this.meter.createCounter('proctoring.violation', {
    description: 'Number of proctoring violations'
  });
  
  public aiRequest = this.meter.createCounter('ai.request', {
    description: 'Number of AI API requests'
  });
  
  public aiRequestFailed = this.meter.createCounter('ai.request.failed', {
    description: 'Number of failed AI API requests'
  });
  
  public cacheHit = this.meter.createCounter('cache.hit', {
    description: 'Number of cache hits'
  });
  
  public cacheMiss = this.meter.createCounter('cache.miss', {
    description: 'Number of cache misses'
  });

  // Histograms
  public executionTime = this.meter.createHistogram('code.execution.duration', {
    description: 'Code execution duration in ms',
    unit: 'ms'
  });
  
  public scoreDistribution = this.meter.createHistogram('interview.score', {
    description: 'Interview score distribution',
    unit: '1'
  });
  
  public aiResponseTime = this.meter.createHistogram('ai.response.time', {
    description: 'AI API response time in ms',
    unit: 'ms'
  });
  
  public questionGenerationTime = this.meter.createHistogram('question.generation.time', {
    description: 'Question generation time in ms',
    unit: 'ms'
  });

  // Gauges (observable)
  private activeInterviewsValue = 0;
  private queueDepthValue = 0;
  private redisLatencyValue = 0;
  
  public activeInterviews = this.meter.createObservableGauge('interview.active', {
    description: 'Number of active interviews'
  });
  
  public queueDepth = this.meter.createObservableGauge('execution.queue.depth', {
    description: 'Number of jobs in execution queue'
  });
  
  public redisLatency = this.meter.createObservableGauge('redis.latency', {
    description: 'Redis operation latency in ms',
    unit: 'ms'
  });

  constructor() {
    // Set up observable callbacks with proper ObservableResult handling
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

  // Update gauge values
  setActiveInterviews(count: number): void {
    this.activeInterviewsValue = count;
  }
  
  setQueueDepth(count: number): void {
    this.queueDepthValue = count;
  }
  
  setRedisLatency(latency: number): void {
    this.redisLatencyValue = latency;
  }
}

// Singleton instance
export const interviewMetrics = new InterviewMetrics();

// Structured logging
interface LogContext {
  [key: string]: unknown;
  timestamp?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

export const logger = {
  info: (message: string, context: LogContext = {}): void => {
    const logEntry = {
      level: 'info',
      message,
      ...context,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(logEntry));
  },

  warn: (message: string, context: LogContext = {}): void => {
    const logEntry = {
      level: 'warn',
      message,
      ...context,
      timestamp: new Date().toISOString()
    };
    console.warn(JSON.stringify(logEntry));
  },

  error: (message: string, error: Error, context: LogContext = {}): void => {
    const logEntry = {
      level: 'error',
      message,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...context,
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(logEntry));
  },

  audit: (action: string, context: LogContext): void => {
    const logEntry = {
      level: 'audit',
      action,
      ...context,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(logEntry));
  },

  security: (event: string, context: LogContext): void => {
    const logEntry = {
      level: 'security',
      event,
      ...context,
      timestamp: new Date().toISOString()
    };
    console.warn(JSON.stringify(logEntry));
  }
};

// Request context for distributed tracing
export class RequestContext {
  private static asyncLocalStorage = new Map<string, unknown>();

  static set(key: string, value: unknown): void {
    RequestContext.asyncLocalStorage.set(key, value);
  }

  static get(key: string): unknown {
    return RequestContext.asyncLocalStorage.get(key);
  }

  static getRequestId(): string {
    return (RequestContext.get('requestId') as string) || 'unknown';
  }

  static getUserId(): string {
    return (RequestContext.get('userId') as string) || 'anonymous';
  }

  static clear(): void {
    RequestContext.asyncLocalStorage.clear();
  }
}
