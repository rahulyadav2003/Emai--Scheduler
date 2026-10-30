import { Queue } from 'bullmq';
import { redisConfig } from '../redis/redis';

export interface EmailJobData {
  emailJobId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderEmail: string;
  userId: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
  retryCount?: number;
}

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000, // keep last 1000 completed jobs for inspection
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 2000, // keep failed jobs for debugging
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('⚠️ BullMQ Email Queue error:', err.message);
});

export async function closeEmailQueue(): Promise<void> {
  await emailQueue.close();
  console.log('🛑 BullMQ Email Queue closed');
}

export default emailQueue;
