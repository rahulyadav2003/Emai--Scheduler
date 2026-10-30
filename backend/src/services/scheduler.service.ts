import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma';
import { emailQueue, EmailJobData } from '../queues/email.queue';
import { env } from '../config/env';

export interface ScheduleCampaignOptions {
  userId: string;
  subject: string;
  body: string;
  senderEmail: string;
  recipients: string[];
  startTime?: Date | string;
  delayBetweenSeconds?: number;
  hourlyLimit?: number;
}

export class SchedulerService {
  /**
   * Parse recipients list from CSV string or buffer.
   * Handles email headers, raw email lists, quotes, and commas/newlines.
   */
  parseRecipientsFromCsv(csvContent: string): string[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const recipientsSet = new Set<string>();

    // Check if first row is a header
    let emailColIndex = -1;
    const headerCols = lines[0].split(/[,;\t]/).map((c) => c.replace(/["']/g, '').trim().toLowerCase());

    for (let i = 0; i < headerCols.length; i++) {
      if (['email', 'recipient', 'to', 'mail', 'emailaddress', 'email_address'].includes(headerCols[i])) {
        emailColIndex = i;
        break;
      }
    }

    const startIndex = emailColIndex !== -1 ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(/[,;\t]/).map((c) => c.replace(/["']/g, '').trim());

      let candidate = '';
      if (emailColIndex !== -1 && cols[emailColIndex]) {
        candidate = cols[emailColIndex];
      } else {
        // Find first column matching email regex
        for (const col of cols) {
          if (emailRegex.test(col)) {
            candidate = col;
            break;
          }
        }
      }

      if (candidate && emailRegex.test(candidate)) {
        recipientsSet.add(candidate.toLowerCase());
      }
    }

    return Array.from(recipientsSet);
  }

  /**
   * Schedule a new email campaign and enqueue its jobs with staggered delays
   */
  async scheduleCampaign(options: ScheduleCampaignOptions) {
    const {
      userId,
      subject,
      body,
      senderEmail,
      recipients,
      delayBetweenSeconds = 0,
      hourlyLimit = env.DEFAULT_HOURLY_LIMIT,
    } = options;

    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient email address is required');
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const validRecipients = recipients
      .map((r) => r.trim().toLowerCase())
      .filter((r) => emailRegex.test(r));

    if (validRecipients.length === 0) {
      throw new Error('No valid recipient email addresses provided');
    }

    const now = Date.now();
    const parsedStartTime = options.startTime ? new Date(options.startTime) : new Date(now);
    const startTimestamp = Math.max(now, parsedStartTime.getTime());
    const baseDelayMs = Math.max(0, startTimestamp - now);

    // 1. Create Campaign in DB
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        subject,
        body,
        senderEmail,
        startTime: new Date(startTimestamp),
        delayBetweenSeconds,
        hourlyLimit,
        totalRecipients: validRecipients.length,
        status: 'SCHEDULED',
      },
    });

    // 2. Prepare EmailJob records with pre-generated UUIDs and deterministic jobIds upfront
    const preparedRecords = validRecipients.map((recipientEmail, index) => {
      const id = randomUUID();
      const jobId = `email-${id}`;
      const jobStaggerDelayMs = baseDelayMs + index * (delayBetweenSeconds * 1000);
      const scheduledAt = new Date(now + jobStaggerDelayMs);

      return {
        id,
        jobId,
        campaignId: campaign.id,
        recipientEmail,
        subject,
        body,
        senderEmail,
        status: 'SCHEDULED' as const,
        scheduledAt,
        jobStaggerDelayMs,
      };
    });

    // Insert all EmailJobs in 1 single bulk insert with their final jobId
    await prisma.emailJob.createMany({
      data: preparedRecords.map(({ jobStaggerDelayMs, ...record }) => record),
    });

    // 3. Batch enqueue jobs into BullMQ with deterministic jobId for idempotency
    const bulkJobs = preparedRecords.map((record) => ({
      name: 'send-email',
      data: {
        emailJobId: record.id,
        campaignId: campaign.id,
        recipientEmail: record.recipientEmail,
        subject: record.subject,
        body: record.body,
        senderEmail: record.senderEmail,
        userId,
        delayBetweenSeconds,
        hourlyLimit,
        retryCount: 0,
      } as EmailJobData,
      opts: {
        jobId: record.jobId,
        delay: record.jobStaggerDelayMs,
      },
    }));

    // Enqueue all jobs in bulk into BullMQ Redis
    await emailQueue.addBulk(bulkJobs);

    console.log(
      `📅 Campaign "${campaign.id}" scheduled: ${validRecipients.length} emails staggered with ${delayBetweenSeconds}s delay`
    );

    return {
      campaign,
      recipientCount: validRecipients.length,
      scheduledJobsCount: preparedRecords.length,
    };
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
