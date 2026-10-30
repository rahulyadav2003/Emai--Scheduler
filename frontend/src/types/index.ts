export type EmailStatus = 'SCHEDULED' | 'PENDING' | 'SENT' | 'FAILED' | 'RESCHEDULED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  slackConnected?: boolean;
  hasSlackWebhook?: boolean;
  hasSlackToken?: boolean;
  slackChannel?: string;
  createdAt?: string;
}

export interface Campaign {
  id: string;
  title?: string;
  subject: string;
  body: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledCount: number;
  delayBetweenSeconds: number;
  hourlyLimit: number;
  scheduledStartTime: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface EmailJob {
  id: string;
  campaignId?: string;
  recipientEmail: string;
  subject: string;
  body?: string;
  scheduledTime: string; // ISO string
  sentAt?: string | null;
  status: EmailStatus;
  attempts?: number;
  maxAttempts?: number;
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  jobId?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalScheduled: number;
  sentToday: number;
  totalSent: number;
  failedToday: number;
  totalFailed: number;
  currentQueueCount: number;
  hourlyLimitRemaining: number;
  isWorkerActive: boolean;
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail?: string;
  startTime?: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
}
