import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from '../queues/email.queue';
import { redisConfig, redisClient } from '../redis/redis';
import { prisma } from '../db/prisma';
import { etherealService } from '../services/ethereal.service';
import { rateLimitService } from '../services/ratelimit.service';
import { env } from '../config/env';

/**
 * Worker processor for single email job
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<any> {
  const {
    emailJobId,
    campaignId,
    recipientEmail,
    subject,
    body,
    senderEmail,
    userId,
    delayBetweenSeconds,
    hourlyLimit,
  } = job.data;

  console.log(`[Worker] Processing Job ID: ${job.id} | EmailJob: ${emailJobId} -> ${recipientEmail}`);

  // 1. Check current status in DB for idempotency
  const emailJobRecord = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: {
      campaign: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!emailJobRecord) {
    console.warn(`[Worker] EmailJob ${emailJobId} not found in database. Skipping.`);
    return { skipped: true, reason: 'Record not found' };
  }

  // Idempotency: If already sent, do not resend
  if (emailJobRecord.status === 'SENT') {
    console.log(`[Worker] EmailJob ${emailJobId} already marked as SENT. Skipping.`);
    return { skipped: true, reason: 'Already sent' };
  }

  // Mark campaign as PROCESSING if it's currently SCHEDULED
  if (emailJobRecord.campaign.status === 'SCHEDULED') {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PROCESSING' },
    });
  }

  // 2. Sender rate limiting check
  const user = emailJobRecord.campaign.user;
  const slackInfo = {
    webhookUrl: user?.slackWebhookUrl,
    slackToken: user?.slackToken,
    campaignId,
  };

  const limitCheck = await rateLimitService.checkAndIncrementRateLimit(
    senderEmail,
    hourlyLimit || env.DEFAULT_HOURLY_LIMIT,
    slackInfo
  );

  // If rate limit exceeded, reschedule into next hour window (DO NOT DROP)
  if (!limitCheck.allowed) {
    const nextRetry = (job.data.retryCount || 0) + 1;
    const rescheduleJobId = `email-${emailJobId}-r${nextRetry}-${limitCheck.nextWindowStart.getTime()}`;

    console.warn(
      `[Worker] Hourly limit reached for ${senderEmail}. Rescheduling job ${emailJobId} in ${Math.round(
        limitCheck.msUntilNextHour / 1000
      )}s (at ${limitCheck.nextWindowStart.toISOString()})`
    );

    // Update DB status to RESCHEDULED
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'RESCHEDULED',
        scheduledAt: limitCheck.nextWindowStart,
        retryCount: nextRetry,
      },
    });

    // Enqueue rescheduled job for next window
    await emailQueue.add(
      'send-email',
      {
        ...job.data,
        retryCount: nextRetry,
      },
      {
        delay: limitCheck.msUntilNextHour,
        jobId: rescheduleJobId,
      }
    );

    return {
      rescheduled: true,
      nextWindowStart: limitCheck.nextWindowStart,
      msUntilNextHour: limitCheck.msUntilNextHour,
    };
  }

  // 3. Sender delay spacing enforcement
  const delayMs = Math.max(env.DEFAULT_MIN_DELAY_MS, (delayBetweenSeconds || 0) * 1000);
  const lastSentKey = `last_sent:${senderEmail.toLowerCase().trim()}`;
  const lastSentTimestamp = await redisClient.get(lastSentKey);

  if (lastSentTimestamp) {
    const elapsed = Date.now() - parseInt(lastSentTimestamp, 10);
    if (elapsed < delayMs) {
      const waitTime = delayMs - elapsed;
      console.log(`[Worker] Enforcing sender pacing delay: waiting ${waitTime}ms for ${senderEmail}`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // 4. Send email via Ethereal SMTP
  try {
    const sendResult = await etherealService.sendEmail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body,
    });

    // Record last sent time in Redis (TTL 1 hour)
    await redisClient.set(lastSentKey, Date.now().toString(), 'EX', 3600);

    const now = new Date();
    // Update DB EmailJob to SENT
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'SENT',
        sentAt: now,
        etherealUrl: sendResult.previewUrl ? String(sendResult.previewUrl) : null,
        errorMessage: null,
      },
    });

    // Increment campaign sent count and check completion
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: { increment: 1 },
      },
      select: {
        id: true,
        sentCount: true,
        failedCount: true,
        totalRecipients: true,
      },
    });

    if (updatedCampaign.sentCount + updatedCampaign.failedCount >= updatedCampaign.totalRecipients) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      });
      console.log(`🎉 Campaign ${campaignId} COMPLETED! (${updatedCampaign.sentCount} sent, ${updatedCampaign.failedCount} failed)`);
    }

    return {
      success: true,
      messageId: sendResult.messageId,
      etherealUrl: sendResult.previewUrl,
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to send email';
    console.error(`❌ [Worker] Error sending email ${emailJobId} to ${recipientEmail}:`, errorMessage);

    // Update DB EmailJob to FAILED
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });

    // Increment campaign failed count and check completion
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        failedCount: { increment: 1 },
      },
      select: {
        id: true,
        sentCount: true,
        failedCount: true,
        totalRecipients: true,
      },
    });

    if (updatedCampaign.sentCount + updatedCampaign.failedCount >= updatedCampaign.totalRecipients) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      });
    }

    throw err;
  }
}

/**
 * BullMQ Worker instance
 */
export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConfig,
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: 60000,
    stalledInterval: 60000,
    maxStalledCount: 3,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`✅ [Worker] Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('⚠️ [Worker] Worker internal error:', err.message);
});

export async function stopEmailWorker(): Promise<void> {
  console.log('🛑 Closing BullMQ email worker...');
  await emailWorker.close();
  console.log('✅ BullMQ email worker stopped');
}

export default emailWorker;
