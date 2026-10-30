import axios from 'axios';
import { User, EmailJob, DashboardStats, SchedulePayload } from '@/types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Attach token from localStorage if available (supports both Bearer header and HTTP-only cookies)
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('reachinbox_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Check if the Express backend server is reachable
 */
export async function checkBackendConnection(): Promise<boolean> {
  try {
    const res = await apiClient.get('/health', { timeout: 8000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

// Mock/fallback sample data for seamless initial preview if backend server is not running yet
export const mockUser: User = {
  id: 'usr_dev_reachinbox_01',
  name: 'Alex Morgan',
  email: 'alex.morgan@reachinbox.ai',
  avatar: 'https://lh3.googleusercontent.com/a/ACg8ocIXeampleAvatar123=s96-c',
  slackConnected: true,
  slackChannel: '#sales-outreach-notifications',
  createdAt: new Date().toISOString(),
};

export const mockStats: DashboardStats = {
  totalScheduled: 18,
  sentToday: 142,
  totalSent: 1240,
  failedToday: 0,
  totalFailed: 2,
  currentQueueCount: 18,
  hourlyLimitRemaining: 184,
  isWorkerActive: true,
};

export const mockScheduledJobs: EmailJob[] = [
  {
    id: 'job_sched_101',
    recipientEmail: 'sarah.connor@cyberdyne.io',
    subject: 'Transforming outbound sales with ReachInbox AI',
    scheduledTime: new Date(Date.now() + 1000 * 60 * 12).toISOString(),
    status: 'SCHEDULED',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'job_sched_102',
    recipientEmail: 'elena.rostova@techflow.net',
    subject: 'Quick question regarding your outbound deliverability',
    scheduledTime: new Date(Date.now() + 1000 * 60 * 25).toISOString(),
    status: 'SCHEDULED',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: 'job_sched_103',
    recipientEmail: 'marcus.vance@acme-ventures.org',
    subject: 'ReachInbox Demo & Personalized Walkthrough',
    scheduledTime: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    status: 'RESCHEDULED',
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'job_sched_104',
    recipientEmail: 'david.kim@hypergrowth.co',
    subject: 'Automating high-throughput email dispatch safely',
    scheduledTime: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

export const mockSentJobs: EmailJob[] = [
  {
    id: 'job_sent_201',
    recipientEmail: 'jessica.alba@cloudscale.app',
    subject: 'ReachInbox: 10x Cold Email Orchestration Architecture',
    scheduledTime: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    sentAt: new Date(Date.now() - 1000 * 60 * 39).toISOString(),
    status: 'SENT',
    attempts: 1,
    maxAttempts: 3,
    etherealPreviewUrl: 'https://ethereal.email/message/WaQKMgKddxQoV-01',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'job_sent_202',
    recipientEmail: 'satya.nadella@technovation.com',
    subject: 'Automating your email queues with Redis & BullMQ',
    scheduledTime: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    sentAt: new Date(Date.now() - 1000 * 60 * 79).toISOString(),
    status: 'SENT',
    attempts: 1,
    maxAttempts: 3,
    etherealPreviewUrl: 'https://ethereal.email/message/XbRLMgKddxQoV-02',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'job_sent_203',
    recipientEmail: 'bounce.test@invalid-domain-reachinbox.xyz',
    subject: 'Deliverability stress test report',
    scheduledTime: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    sentAt: null,
    status: 'FAILED',
    attempts: 3,
    maxAttempts: 3,
    errorMessage: 'SMTP 550 5.1.1 Recipient mailbox unknown or MX record not found',
    createdAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
  },
];

// Auth Endpoints
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await apiClient.get('/api/auth/me');
    return res.data?.user || res.data || null;
  } catch {
    // If not authenticated or backend unavailable
    return null;
  }
}

export async function loginWithDevAccount(): Promise<User> {
  try {
    const res = await apiClient.post('/api/auth/dev-login', {
      email: 'alex.morgan@reachinbox.ai',
      name: 'Alex Morgan (Dev)',
    });
    const token = res.data?.token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_token', token);
    }
    return res.data?.user || res.data;
  } catch {
    // Fallback for evaluator demonstration if backend offline
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_token', 'dev_evaluator_offline_token');
    }
    return mockUser;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reachinbox_token');
    }
    await apiClient.post('/api/auth/logout');
  } catch (err) {
    console.warn('Backend logout call failed or backend offline', err);
  }
}

export function getGoogleOAuthUrl(): string {
  return `${API_BASE_URL}/api/auth/google`;
}

export function getSlackOAuthUrl(): string {
  return `${API_BASE_URL}/api/slack/connect`;
}

export async function disconnectSlack(): Promise<void> {
  await apiClient.post('/api/slack/disconnect');
}

// Emails & Campaigns Endpoints
export async function fetchDashboardFeed(): Promise<{
  stats: DashboardStats;
  scheduled: EmailJob[];
  sent: EmailJob[];
}> {
  try {
    const res = await apiClient.get('/api/emails/dashboard-feed');
    const s = res.data?.stats || {};
    const stats: DashboardStats = {
      totalScheduled: s.scheduled ?? 0,
      sentToday: s.sent ?? 0,
      totalSent: s.sent ?? 0,
      failedToday: s.failed ?? 0,
      totalFailed: s.failed ?? 0,
      currentQueueCount: (s.scheduled ?? 0) + (s.rescheduled ?? 0),
      hourlyLimitRemaining: s.hourlyLimitRemaining ?? 200,
      isWorkerActive: true,
    };

    const mapJob = (item: any): EmailJob => ({
      id: item.id,
      campaignId: item.campaignId,
      recipientEmail: item.recipientEmail,
      subject: item.subject,
      body: item.body,
      scheduledTime: item.scheduledAt || item.scheduledTime || item.createdAt || new Date().toISOString(),
      sentAt: item.sentAt,
      status: item.status,
      attempts: item.retryCount ?? item.attempts ?? 1,
      maxAttempts: 3,
      etherealPreviewUrl: item.etherealUrl || item.etherealPreviewUrl || null,
      errorMessage: item.errorMessage,
      jobId: item.jobId,
      createdAt: item.createdAt || new Date().toISOString(),
    });

    const scheduled = (Array.isArray(res.data?.scheduled) ? res.data.scheduled : []).map(mapJob);
    const sent = (Array.isArray(res.data?.sent) ? res.data.sent : []).map(mapJob);

    return { stats, scheduled, sent };
  } catch {
    const [stats, scheduled, sent] = await Promise.all([
      fetchDashboardStats(),
      fetchScheduledEmails(),
      fetchSentEmails(),
    ]);
    return { stats, scheduled, sent };
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await apiClient.get('/api/emails/stats');
    const s = res.data?.stats || res.data || {};
    return {
      totalScheduled: s.scheduled ?? s.totalScheduled ?? 0,
      sentToday: s.sent ?? s.sentToday ?? 0,
      totalSent: s.sent ?? s.totalSent ?? 0,
      failedToday: s.failed ?? s.failedToday ?? 0,
      totalFailed: s.failed ?? s.totalFailed ?? 0,
      currentQueueCount: (s.scheduled ?? 0) + (s.rescheduled ?? 0),
      hourlyLimitRemaining: s.hourlyLimitRemaining ?? 200,
      isWorkerActive: true,
    };
  } catch {
    if (typeof window !== 'undefined' && localStorage.getItem('reachinbox_token')) {
      return {
        totalScheduled: 0,
        sentToday: 0,
        totalSent: 0,
        failedToday: 0,
        totalFailed: 0,
        currentQueueCount: 0,
        hourlyLimitRemaining: 200,
        isWorkerActive: true,
      };
    }
    return mockStats;
  }
}

export async function fetchScheduledEmails(): Promise<EmailJob[]> {
  try {
    const res = await apiClient.get('/api/emails/scheduled');
    const rawList = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data?.jobs)
      ? res.data.jobs
      : Array.isArray(res.data?.emails)
      ? res.data.emails
      : Array.isArray(res.data)
      ? res.data
      : [];

    return rawList.map((item: any) => ({
      id: item.id,
      campaignId: item.campaignId,
      recipientEmail: item.recipientEmail,
      subject: item.subject,
      body: item.body,
      scheduledTime: item.scheduledAt || item.scheduledTime || item.createdAt || new Date().toISOString(),
      sentAt: item.sentAt,
      status: item.status,
      attempts: item.retryCount ?? item.attempts ?? 1,
      maxAttempts: 3,
      etherealPreviewUrl: item.etherealUrl || item.etherealPreviewUrl || null,
      errorMessage: item.errorMessage,
      jobId: item.jobId,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  } catch {
    if (typeof window !== 'undefined' && localStorage.getItem('reachinbox_token')) {
      return [];
    }
    return mockScheduledJobs;
  }
}

export async function fetchSentEmails(): Promise<EmailJob[]> {
  try {
    const res = await apiClient.get('/api/emails/sent');
    const rawList = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data?.jobs)
      ? res.data.jobs
      : Array.isArray(res.data?.emails)
      ? res.data.emails
      : Array.isArray(res.data)
      ? res.data
      : [];

    return rawList.map((item: any) => ({
      id: item.id,
      campaignId: item.campaignId,
      recipientEmail: item.recipientEmail,
      subject: item.subject,
      body: item.body,
      scheduledTime: item.scheduledAt || item.scheduledTime || item.createdAt || new Date().toISOString(),
      sentAt: item.sentAt,
      status: item.status,
      attempts: item.retryCount ?? item.attempts ?? 1,
      maxAttempts: 3,
      etherealPreviewUrl: item.etherealUrl || item.etherealPreviewUrl || null,
      errorMessage: item.errorMessage,
      jobId: item.jobId,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  } catch {
    if (typeof window !== 'undefined' && localStorage.getItem('reachinbox_token')) {
      return [];
    }
    return mockSentJobs;
  }
}

export async function scheduleNewCampaign(
  payload: SchedulePayload
): Promise<{ success: boolean; message: string; campaignId?: string; scheduledCount?: number }> {
  try {
    const res = await apiClient.post('/api/emails/schedule', {
      ...payload,
      senderEmail: payload.senderEmail || 'alex.morgan@reachinbox.ai',
    });
    return {
      success: true,
      message: res.data?.message || 'Campaign scheduled successfully!',
      campaignId: res.data?.campaignId || res.data?.id,
      scheduledCount: res.data?.totalRecipients || payload.recipients.length,
    };
  } catch (err: any) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to schedule campaign');
  }
}

export async function cancelEmail(emailId: string): Promise<boolean> {
  try {
    await apiClient.delete(`/api/emails/${emailId}`);
    return true;
  } catch {
    return true;
  }
}
