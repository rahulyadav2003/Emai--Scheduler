import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { authenticateToken } from '../middleware/auth.middleware';

export const authRouter = Router();

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

/**
 * Direct Google OAuth Redirect
 * GET /api/auth/google
 */
authRouter.get('/google', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      error: 'Google OAuth is not configured on this server. Use /api/auth/dev-login for local development.',
    });
    return;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });

  res.redirect(authUrl);
});

/**
 * Generate Google OAuth authorization URL
 * GET /api/auth/google/url
 */
authRouter.get('/google/url', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      error: 'Google OAuth is not configured on this server. Use /api/auth/dev-login for local development.',
    });
    return;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });

  res.json({ url: authUrl });
});

/**
 * Google OAuth Callback
 * GET /api/auth/google/callback
 */
authRouter.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.id_token) {
      res.status(400).json({ error: 'Failed to obtain ID token from Google' });
      return;
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Failed to retrieve profile from Google token' });
      return;
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { email: payload.email.toLowerCase() },
      update: {
        googleId: payload.sub,
        name: payload.name || undefined,
        avatar: payload.picture || undefined,
      },
      create: {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        name: payload.name || 'Google User',
        avatar: payload.picture || null,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend dashboard or send response
    if (env.FRONTEND_URL) {
      res.redirect(`${env.FRONTEND_URL}/?token=${token}`);
    } else {
      res.json({ user, token });
    }
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * Mock Dev Login Endpoint
 * POST /api/auth/dev-login
 * Allows instant login without requiring live Google OAuth credentials
 */
authRouter.post('/dev-login', async (req: Request, res: Response): Promise<void> => {
  try {
    const email = (req.body.email || 'developer@example.com').toLowerCase().trim();
    const name = req.body.name || 'Lead Developer';

    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EmailDev',
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Logged in successfully via Dev Login',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        hasSlackWebhook: !!user.slackWebhookUrl,
        hasSlackToken: !!user.slackToken,
        slackConnected: Boolean(user.slackWebhookUrl || user.slackToken),
      },
      token,
    });
  } catch (error: any) {
    console.error('Dev login error:', error);
    res.status(500).json({ error: 'Dev login failed', details: error.message });
  }
});

/**
 * Get Current User Profile
 * GET /api/auth/me
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackWebhookUrl: true,
        slackToken: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        hasSlackWebhook: !!user.slackWebhookUrl,
        hasSlackToken: !!user.slackToken,
        slackConnected: Boolean(user.slackWebhookUrl || user.slackToken),
        totalCampaigns: user._count.campaigns,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', details: error.message });
  }
});

/**
 * Logout
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.json({ success: true, message: 'Logged out successfully' });
});

export default authRouter;
