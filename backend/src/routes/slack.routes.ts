import { Router, Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../db/prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { slackService } from '../services/slack.service';

export const slackRouter = Router();

/**
 * Get Slack integration status
 * GET /api/slack/status
 */
slackRouter.get(
  '/status',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          slackWebhookUrl: true,
          slackToken: true,
        },
      });

      res.json({
        connected: Boolean(user?.slackWebhookUrl || user?.slackToken),
        hasWebhook: Boolean(user?.slackWebhookUrl),
        hasToken: Boolean(user?.slackToken),
        maskedWebhookUrl: user?.slackWebhookUrl
          ? user.slackWebhookUrl.replace(/(hooks\.slack\.com\/services\/[^\/]+\/[^\/]+\/).+/, '$1****')
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve Slack status', details: error.message });
    }
  }
);

/**
 * Generate Slack OAuth Connect URL
 * GET /api/slack/connect
 */
slackRouter.get('/connect', authenticateToken, (req: Request, res: Response): void => {
  if (!env.SLACK_CLIENT_ID) {
    res.status(503).json({
      error: 'Slack OAuth is not configured. You can configure a webhook directly via POST /api/slack/webhook',
    });
    return;
  }

  const scopes = ['chat:write', 'chat:write.public'];
  const state = req.user!.id; // Pass user ID in state to link on callback

  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${
    env.SLACK_CLIENT_ID
  }&scope=${scopes.join(',')}&redirect_uri=${encodeURIComponent(
    env.SLACK_REDIRECT_URI
  )}&state=${state}`;

  // Redirect browser directly or return JSON for API calls
  if (req.headers.accept?.includes('text/html') || !req.xhr) {
    res.redirect(slackAuthUrl);
  } else {
    res.json({ url: slackAuthUrl });
  }
});

/**
 * Slack OAuth Callback
 * GET /api/slack/callback
 */
slackRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  const userId = req.query.state as string;

  if (!code || !userId) {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  try {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID || '',
      client_secret: env.SLACK_CLIENT_SECRET || '',
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    const response = await axios.post('https://slack.com/api/oauth.v2.access', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;
    if (!data.ok) {
      throw new Error(data.error || 'Slack OAuth access failed');
    }

    const accessToken = data.access_token;
    const webhookUrl = data.incoming_webhook?.url || null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackToken: accessToken,
        slackWebhookUrl: webhookUrl,
      },
    });

    if (env.FRONTEND_URL) {
      res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
    } else {
      res.json({ success: true, message: 'Slack connected successfully' });
    }
  } catch (error: any) {
    console.error('Slack OAuth error:', error.message);
    res.status(500).json({ error: 'Failed to connect Slack', details: error.message });
  }
});

/**
 * Configure Direct Incoming Webhook (Useful for dev/local or custom channels)
 * POST /api/slack/webhook
 */
slackRouter.post(
  '/webhook',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { webhookUrl } = req.body;

      if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        res.status(400).json({
          error: 'Invalid Slack webhook URL. Expected format: https://hooks.slack.com/services/...',
        });
        return;
      }

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { slackWebhookUrl: webhookUrl },
      });

      res.json({
        success: true,
        message: 'Slack webhook URL configured successfully',
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update Slack webhook', details: error.message });
    }
  }
);

/**
 * Test Slack Alert
 * POST /api/slack/test
 */
slackRouter.post(
  '/test',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          email: true,
          slackWebhookUrl: true,
          slackToken: true,
        },
      });

      if (!user?.slackWebhookUrl && !user?.slackToken) {
        res.status(400).json({
          error: 'No Slack integration configured. Please connect Slack or configure a webhook URL first.',
        });
        return;
      }

      const result = await slackService.sendRateLimitAlert({
        senderEmail: user.email,
        currentCount: 101,
        hourlyLimit: 100,
        nextWindowStart: new Date(Date.now() + 3600000),
        webhookUrl: user.slackWebhookUrl,
        slackToken: user.slackToken,
      });

      if (result.success) {
        res.json({
          success: true,
          message: `Test alert dispatched to Slack (${result.channel || 'channel'}) successfully!`,
        });
      } else {
        res.status(400).json({
          error: result.error || 'Failed to dispatch Slack alert. Check bot permissions.',
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to send test alert', details: error.message });
    }
  }
);

/**
 * Disconnect Slack
 * POST /api/slack/disconnect
 */
slackRouter.post(
  '/disconnect',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          slackToken: null,
          slackWebhookUrl: null,
        },
      });

      res.json({
        success: true,
        message: 'Slack disconnected successfully',
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to disconnect Slack', details: error.message });
    }
  }
);

export default slackRouter;
