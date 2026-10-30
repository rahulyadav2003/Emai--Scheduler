import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';

function buildRedisConfig(): RedisOptions {
  const cleanHost = env.REDIS_HOST.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const isCloudHost = cleanHost.includes('upstash.io') || cleanHost.includes('redislabs.com') || cleanHost.includes('aivencloud.com');
  const needsTls = env.REDIS_TLS || env.REDIS_URL.startsWith('rediss://') || isCloudHost;

  const baseOptions: RedisOptions = {
    host: cleanHost,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      // Reconnect with exponential backoff capped at 2 seconds
      const delay = Math.min(times * 100, 2000);
      return delay;
    },
    lazyConnect: true,
  };

  if (needsTls) {
    baseOptions.tls = {
      rejectUnauthorized: false,
    };
  }

  if (env.REDIS_PASSWORD) {
    baseOptions.password = env.REDIS_PASSWORD;
  }

  return baseOptions;
}

export const redisConfig: RedisOptions = buildRedisConfig();

/**
 * Factory function to create a new Redis connection (useful for BullMQ workers and queues)
 */
export function createRedisConnection(): Redis {
  let client: Redis;

  if (env.REDIS_URL) {
    client = new Redis(env.REDIS_URL, redisConfig);
  } else {
    const cleanHost = env.REDIS_HOST.replace(/^https?:\/\//, '').replace(/\/$/, '');
    client = new Redis({
      host: cleanHost,
      port: env.REDIS_PORT,
      ...redisConfig,
    });
  }

  client.on('error', (err) => {
    console.error('⚠️ Redis error:', err.message);
  });

  return client;
}

/**
 * Singleton Redis client for application-wide queries and rate limiting counters
 */
export const redisClient = createRedisConnection();

export async function connectRedis(): Promise<void> {
  if (redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
    await redisClient.connect();
    console.log('✅ Connected to Redis successfully');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
    await redisClient.quit();
    console.log('🔌 Disconnected from Redis');
  }
}

export default redisClient;
