import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { schedulerService } from '../services/scheduler.service';
import { env } from '../config/env';

export const emailRouter = Router();

// Configure Multer for in-memory CSV file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv or .txt files are supported'));
    }
  },
});

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  senderEmail: z.string().email('Valid sender email is required'),
  recipients: z.union([z.array(z.string().email()), z.string()]).optional(),
  startTime: z.string().optional(),
  delayBetweenSeconds: z.coerce.number().min(0).default(0),
  hourlyLimit: z.coerce.number().min(1).default(env.DEFAULT_HOURLY_LIMIT),
});

/**
 * Schedule Email Campaign
 * POST /api/emails/schedule
 * Supports JSON or Multipart/form-data with CSV file upload
 */
emailRouter.post(
  '/schedule',
  authenticateToken,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsedBody = scheduleSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parsedBody.error.format(),
        });
        return;
      }

      const { subject, body, senderEmail, startTime, delayBetweenSeconds, hourlyLimit } =
        parsedBody.data;

      let recipientsList: string[] = [];

      // 1. If CSV file is uploaded, extract emails from CSV
      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        recipientsList = schedulerService.parseRecipientsFromCsv(fileContent);
      }

      // 2. If recipients provided in body, merge/parse them
      if (parsedBody.data.recipients) {
        let directRecipients: string[] = [];
        if (Array.isArray(parsedBody.data.recipients)) {
          directRecipients = parsedBody.data.recipients;
        } else if (typeof parsedBody.data.recipients === 'string') {
          try {
            // Check if JSON array string
            const parsed = JSON.parse(parsedBody.data.recipients);
            if (Array.isArray(parsed)) directRecipients = parsed;
          } catch {
            // Comma or newline separated
            directRecipients = parsedBody.data.recipients.split(/[\r\n,]+/).map((e) => e.trim());
          }
        }
        recipientsList = Array.from(new Set([...recipientsList, ...directRecipients]));
      }

      if (recipientsList.length === 0) {
        res.status(400).json({
          error: 'No valid recipient email addresses found in file or recipients payload',
        });
        return;
      }

      // Schedule campaign and jobs
      const result = await schedulerService.scheduleCampaign({
        userId: req.user!.id,
        subject,
        body,
        senderEmail,
        recipients: recipientsList,
        startTime,
        delayBetweenSeconds,
        hourlyLimit,
      });

      res.status(201).json({
        message: 'Campaign scheduled successfully',
        campaignId: result.campaign.id,
        totalRecipients: result.recipientCount,
        startTime: result.campaign.startTime,
        delayBetweenSeconds,
        hourlyLimit,
      });
    } catch (error: any) {
      console.error('Error scheduling campaign:', error);
      res.status(500).json({
        error: 'Failed to schedule campaign',
        details: error.message,
      });
    }
  }
);

/**
 * List Scheduled and In-flight Emails
 * GET /api/emails/scheduled
 */
emailRouter.get(
  '/scheduled',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const skip = (page - 1) * limit;
      const statusParam = req.query.status as string;

      const whereClause: any = {
        campaign: {
          userId: req.user!.id,
        },
      };

      if (statusParam) {
        whereClause.status = statusParam.toUpperCase();
      } else {
        whereClause.status = { in: ['SCHEDULED', 'RESCHEDULED'] };
      }

      const jobs = await prisma.emailJob.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          campaign: {
            select: {
              id: true,
              subject: true,
              senderEmail: true,
              delayBetweenSeconds: true,
              hourlyLimit: true,
            },
          },
        },
      });
      const total = await prisma.emailJob.count({ where: whereClause });

      res.json({
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch scheduled emails', details: error.message });
    }
  }
);

/**
 * List Sent Emails
 * GET /api/emails/sent
 */
emailRouter.get(
  '/sent',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const skip = (page - 1) * limit;

      const whereClause = {
        campaign: {
          userId: req.user!.id,
        },
        status: 'SENT' as const,
      };

      const jobs = await prisma.emailJob.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          campaign: {
            select: {
              id: true,
              subject: true,
              senderEmail: true,
            },
          },
        },
      });
      const total = await prisma.emailJob.count({ where: whereClause });

      res.json({
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch sent emails', details: error.message });
    }
  }
);

/**
 * Consolidated Dashboard Feed
 * GET /api/emails/dashboard-feed
 * Efficient single-roundtrip query that avoids Neon connection pool contention
 */
emailRouter.get(
  '/dashboard-feed',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      // 1. Fetch campaigns for user
      const userCampaigns = await prisma.campaign.findMany({
        where: { userId },
        select: { id: true },
      });
      const campaignIds = userCampaigns.map((c) => c.id);
      const totalCampaigns = campaignIds.length;

      // 2. Fetch scheduled jobs
      const scheduledJobs = await prisma.emailJob.findMany({
        where: {
          campaign: { userId },
          status: { in: ['SCHEDULED', 'RESCHEDULED'] },
        },
        take: 50,
        orderBy: { scheduledAt: 'asc' },
        include: {
          campaign: {
            select: {
              id: true,
              subject: true,
              senderEmail: true,
              delayBetweenSeconds: true,
              hourlyLimit: true,
            },
          },
        },
      });

      // 3. Fetch sent jobs
      const sentJobs = await prisma.emailJob.findMany({
        where: {
          campaign: { userId },
          status: 'SENT',
        },
        take: 50,
        orderBy: { sentAt: 'desc' },
        include: {
          campaign: {
            select: {
              id: true,
              subject: true,
              senderEmail: true,
            },
          },
        },
      });

      // 4. Calculate status counts
      let scheduledCount = scheduledJobs.length;
      let rescheduledCount = 0;
      let sentCount = sentJobs.length;
      let failedCount = 0;

      if (campaignIds.length > 0) {
        const counts = await prisma.emailJob.groupBy({
          by: ['status'],
          where: { campaignId: { in: campaignIds } },
          _count: { _all: true },
        });
        for (const item of counts) {
          if (item.status === 'SCHEDULED') scheduledCount = item._count._all;
          if (item.status === 'RESCHEDULED') rescheduledCount = item._count._all;
          if (item.status === 'SENT') sentCount = item._count._all;
          if (item.status === 'FAILED') failedCount = item._count._all;
        }
      }

      const totalEmails = scheduledCount + rescheduledCount + sentCount + failedCount;

      res.json({
        stats: {
          totalCampaigns,
          totalEmails,
          scheduled: scheduledCount,
          rescheduled: rescheduledCount,
          sent: sentCount,
          failed: failedCount,
          successRate:
            sentCount + failedCount > 0
              ? `${Math.round((sentCount / (sentCount + failedCount)) * 100)}%`
              : '0%',
        },
        scheduled: scheduledJobs,
        sent: sentJobs,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch dashboard feed', details: error.message });
    }
  }
);

/**
 * Summary Statistics
 * GET /api/emails/stats
 */
emailRouter.get(
  '/stats',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const userCampaigns = await prisma.campaign.findMany({
        where: { userId },
        select: { id: true },
      });
      const campaignIds = userCampaigns.map((c) => c.id);
      const totalCampaigns = campaignIds.length;

      let scheduledJobs = 0;
      let rescheduledJobs = 0;
      let sentJobs = 0;
      let failedJobs = 0;

      if (campaignIds.length > 0) {
        const statusCounts = await prisma.emailJob.groupBy({
          by: ['status'],
          where: { campaignId: { in: campaignIds } },
          _count: { _all: true },
        });

        for (const item of statusCounts) {
          if (item.status === 'SCHEDULED') scheduledJobs = item._count._all;
          if (item.status === 'RESCHEDULED') rescheduledJobs = item._count._all;
          if (item.status === 'SENT') sentJobs = item._count._all;
          if (item.status === 'FAILED') failedJobs = item._count._all;
        }
      }

      const totalEmails = scheduledJobs + rescheduledJobs + sentJobs + failedJobs;

      res.json({
        stats: {
          totalCampaigns,
          totalEmails,
          scheduled: scheduledJobs,
          rescheduled: rescheduledJobs,
          sent: sentJobs,
          failed: failedJobs,
          successRate:
            sentJobs + failedJobs > 0
              ? `${Math.round((sentJobs / (sentJobs + failedJobs)) * 100)}%`
              : '0%',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch email statistics', details: error.message });
    }
  }
);

/**
 * List Campaigns
 * GET /api/emails/campaigns
 */
emailRouter.get(
  '/campaigns',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      });

      res.json({ campaigns });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
    }
  }
);

/**
 * Get Specific Campaign details
 * GET /api/emails/campaigns/:id
 */
emailRouter.get(
  '/campaigns/:id',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: req.params.id,
          userId: req.user!.id,
        },
        include: {
          recipients: {
            orderBy: { scheduledAt: 'asc' },
          },
        },
      });

      if (!campaign) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      res.json({ campaign });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch campaign details', details: error.message });
    }
  }
);

export default emailRouter;
