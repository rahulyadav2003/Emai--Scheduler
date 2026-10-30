import { redisClient } from '../redis/redis';
import { slackService, RateLimitAlertPayload } from './slack.service';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  hourlyLimit: number;
  nextWindowStart: Date;
  msUntilNextHour: number;
}

export class RateLimitService {
  /**
   * Generates a deterministic hourly window string, e.g. "2026103014"
   */
  getHourWindowKey(date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}${month}${day}${hour}`;
  }

  /**
   * Calculates the exact start time of the next UTC hour window and ms remaining
   */
  getNextWindowTiming(now = new Date()): { nextWindowStart: Date; msUntilNextHour: number } {
    const nextWindowStart = new Date(now);
    nextWindowStart.setUTCHours(nextWindowStart.getUTCHours() + 1, 0, 0, 0);
    const msUntilNextHour = Math.max(1000, nextWindowStart.getTime() - now.getTime());
    return { nextWindowStart, msUntilNextHour };
  }

  /**
   * Atomically checks and reserves an email slot for the given sender in the current hour window.
   * If rate limit is exceeded:
   *  - Calculates next available window
   *  - Triggers Slack alert (deduplicated to once per sender per hour window)
   *  - Returns allowed: false with timing details
   */
  async checkAndIncrementRateLimit(
    senderEmail: string,
    hourlyLimit: number,
    slackInfo?: {
      webhookUrl?: string | null;
      slackToken?: string | null;
      campaignId?: string;
    }
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const windowId = this.getHourWindowKey(now);
    const rateLimitKey = `ratelimit:${senderEmail.toLowerCase().trim()}:${windowId}`;
    const alertDedupKey = `ratelimit_alert:${senderEmail.toLowerCase().trim()}:${windowId}`;
    const { nextWindowStart, msUntilNextHour } = this.getNextWindowTiming(now);

    // Check existing count before incrementing to avoid unbounded incrementing when throttled
    const rawCount = await redisClient.get(rateLimitKey);
    const currentCount = rawCount ? parseInt(rawCount, 10) : 0;

    if (currentCount >= hourlyLimit) {
      await this.handleRateLimitExceeded(
        senderEmail,
        currentCount,
        hourlyLimit,
        nextWindowStart,
        alertDedupKey,
        slackInfo
      );

      return {
        allowed: false,
        currentCount,
        hourlyLimit,
        nextWindowStart,
        msUntilNextHour,
      };
    }

    // Atomically increment counter
    const newCount = await redisClient.incr(rateLimitKey);
    if (newCount === 1) {
      // Set TTL to 2 hours (7200s) to automatically expire past windows
      await redisClient.expire(rateLimitKey, 7200);
    }

    if (newCount > hourlyLimit) {
      // Race condition caught across concurrent worker threads
      await this.handleRateLimitExceeded(
        senderEmail,
        newCount,
        hourlyLimit,
        nextWindowStart,
        alertDedupKey,
        slackInfo
      );

      return {
        allowed: false,
        currentCount: newCount,
        hourlyLimit,
        nextWindowStart,
        msUntilNextHour,
      };
    }

    return {
      allowed: true,
      currentCount: newCount,
      hourlyLimit,
      nextWindowStart,
      msUntilNextHour,
    };
  }

  /**
   * Helper to fire Slack alert once per hour window per sender using Redis SET NX
   */
  private async handleRateLimitExceeded(
    senderEmail: string,
    currentCount: number,
    hourlyLimit: number,
    nextWindowStart: Date,
    alertDedupKey: string,
    slackInfo?: {
      webhookUrl?: string | null;
      slackToken?: string | null;
      campaignId?: string;
    }
  ): Promise<void> {
    try {
      // Only fire alert if this key does not exist yet (deduplication)
      const acquiredLock = await redisClient.set(alertDedupKey, '1', 'EX', 7200, 'NX');
      if (acquiredLock) {
        console.warn(
          `⚠️ Rate limit exceeded for sender "${senderEmail}" (${currentCount}/${hourlyLimit}). Sending Slack alert.`
        );

        const alertPayload: RateLimitAlertPayload = {
          senderEmail,
          currentCount,
          hourlyLimit,
          nextWindowStart,
          campaignId: slackInfo?.campaignId,
          webhookUrl: slackInfo?.webhookUrl,
          slackToken: slackInfo?.slackToken,
        };

        await slackService.sendRateLimitAlert(alertPayload);
      }
    } catch (err: any) {
      console.error('Error during rate limit alert deduplication/send:', err.message);
    }
  }

  /**
   * Retrieve current rate limit usage for a sender in the current hour window
   */
  async getUsage(senderEmail: string): Promise<{ count: number; windowId: string }> {
    const windowId = this.getHourWindowKey();
    const rateLimitKey = `ratelimit:${senderEmail.toLowerCase().trim()}:${windowId}`;
    const raw = await redisClient.get(rateLimitKey);
    return {
      count: raw ? parseInt(raw, 10) : 0,
      windowId,
    };
  }
}

export const rateLimitService = new RateLimitService();
export default rateLimitService;
