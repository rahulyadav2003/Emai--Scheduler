import axios from 'axios';

export interface RateLimitAlertPayload {
  senderEmail: string;
  currentCount: number;
  hourlyLimit: number;
  nextWindowStart: Date;
  campaignId?: string;
  webhookUrl?: string | null;
  slackToken?: string | null;
  channel?: string | null;
}

export interface SlackSendResult {
  success: boolean;
  channel?: string;
  error?: string;
}

class SlackService {
  /**
   * Sends rate-limit alert to Slack.
   * Supports both Slack Incoming Webhook and Bot Token.
   */
  async sendRateLimitAlert(payload: RateLimitAlertPayload): Promise<SlackSendResult> {
    const {
      senderEmail,
      currentCount,
      hourlyLimit,
      nextWindowStart,
      campaignId,
      webhookUrl,
      slackToken,
      channel,
    } = payload;

    const formattedTime = nextWindowStart.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Hourly Rate Limit Exceeded',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender Email:*\n\`${senderEmail}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Limit / Sent:*\n${hourlyLimit} / ${currentCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Resuming At:*\n${formattedTime}`,
          },
          {
            type: 'mrkdwn',
            text: `*Campaign ID:*\n\`${campaignId || 'N/A'}\``,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `⚠️ Subsequent emails will be automatically rescheduled into the next hour window without loss.`,
          },
        ],
      },
    ];

    const fallbackText = `🚨 Rate limit exceeded for ${senderEmail}! Hourly limit: ${hourlyLimit}. Resuming at ${formattedTime}.`;

    // 1. Try sending via Slack Incoming Webhook if configured
    if (webhookUrl && webhookUrl.startsWith('https://hooks.slack.com/')) {
      try {
        const webhookRes = await axios.post(
          webhookUrl,
          {
            text: fallbackText,
            blocks,
          },
          { timeout: 8000 }
        );

        if (webhookRes.status === 200) {
          console.log(`📣 Slack alert sent via webhook for sender: ${senderEmail}`);
          return { success: true, channel: 'webhook' };
        }
      } catch (err: any) {
        console.warn(
          `⚠️ Failed to send Slack alert via webhook for ${senderEmail}:`,
          err.response?.data || err.message
        );
      }
    }

    // 2. Try sending via Slack Bot Token
    if (slackToken) {
      let lastSlackError = 'Unknown error';
      const candidateChannels: string[] = [];
      if (channel) candidateChannels.push(channel);

      // Attempt to discover real public channel IDs from workspace
      try {
        const convListRes = await axios.get(
          'https://slack.com/api/conversations.list?types=public_channel&limit=25',
          {
            headers: { Authorization: `Bearer ${slackToken}` },
            timeout: 5000,
          }
        );
        if (convListRes.data?.ok && Array.isArray(convListRes.data.channels)) {
          for (const ch of convListRes.data.channels) {
            if (ch.id) candidateChannels.push(ch.id);
          }
        }
      } catch {
        // Missing channels:read scope is common, proceed to fallback names
      }

      // Add common default channel targets
      candidateChannels.push('#general', 'general', '#random', 'random', '#alerts', 'alerts');
      const uniqueChannels = Array.from(new Set(candidateChannels));

      for (const target of uniqueChannels) {
        try {
          const postRes = await axios.post(
            'https://slack.com/api/chat.postMessage',
            {
              channel: target,
              text: fallbackText,
              blocks,
            },
            {
              headers: {
                Authorization: `Bearer ${slackToken}`,
                'Content-Type': 'application/json',
              },
              timeout: 6000,
            }
          );

          if (postRes.data?.ok) {
            console.log(`📣 Slack alert successfully posted to ${target} for sender: ${senderEmail}`);
            return { success: true, channel: target };
          } else {
            lastSlackError = postRes.data?.error || 'Failed to post message';
            console.warn(`⚠️ Slack rejected post to channel "${target}":`, postRes.data?.error);
          }
        } catch (postErr: any) {
          lastSlackError = postErr.response?.data?.error || postErr.message;
        }
      }

      return {
        success: false,
        error: `Slack rejected delivery (${lastSlackError}). Ensure your bot is invited to a channel (type /invite @YourBot in Slack), or connect using a Slack Incoming Webhook URL.`,
      };
    }

    return {
      success: false,
      error: 'No Slack credentials configured (missing both Webhook and Token)',
    };
  }
}

export const slackService = new SlackService();
export default slackService;
