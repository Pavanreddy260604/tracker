import { redis } from './redis.js';
import { logger } from './monitoring.js';

export interface HealthStatus {
  redis: { connected: boolean; latency: number; error?: string };
  ready: boolean;
}

/**
 * Validate Redis connection on application startup
 */
export async function validateInfrastructure(): Promise<HealthStatus> {
  const status: HealthStatus = {
    redis: { connected: false, latency: -1 },
    ready: false
  };

  // Test Redis connection
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    status.redis.connected = true;
    status.redis.latency = latency;
    
    logger.info('Redis connection established', {
      latency: `${latency}ms`
    });
  } catch (error) {
    status.redis.connected = false;
    status.redis.error = (error as Error).message;
    
    logger.error('Redis connection failed', error as Error);
    
    // In production, this should fail fast
    // In development, we might want to continue without caching
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Redis connection required in production: ${status.redis.error}`);
    }
  }

  status.ready = status.redis.connected;
  
  return status;
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');
    
    // Allow time for ongoing requests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason as Error);
  });
}
