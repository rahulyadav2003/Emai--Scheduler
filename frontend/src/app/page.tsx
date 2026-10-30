'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, EmailJob, DashboardStats, SchedulePayload } from '@/types';
import {
  fetchCurrentUser,
  fetchDashboardFeed,
  fetchDashboardStats,
  fetchScheduledEmails,
  fetchSentEmails,
  loginWithDevAccount,
  logoutUser,
  scheduleNewCampaign,
  cancelEmail,
  checkBackendConnection,
  mockUser,
  mockStats,
  mockScheduledJobs,
  mockSentJobs,
} from '@/lib/api';
import { Header } from '@/components/Header';
import { StatsCards } from '@/components/StatsCards';
import { ComposeModal } from '@/components/ComposeModal';
import { ScheduledTable } from '@/components/ScheduledTable';
import { SentTable } from '@/components/SentTable';
import { AuthModal } from '@/components/AuthModal';
import {
  Plus,
  Search,
  CalendarClock,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalScheduled: 0,
    sentToday: 0,
    totalSent: 0,
    failedToday: 0,
    totalFailed: 0,
    currentQueueCount: 0,
    hourlyLimitRemaining: 200,
    isWorkerActive: true,
  });
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToastMessage({ text, type });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    []
  );

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setIsRefreshing(true);

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('reachinbox_token')
          : null;

      // If user is not authenticated (no token), immediately show Login Page
      if (!token) {
        setUser(null);
        setScheduledJobs([]);
        setSentJobs([]);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const isOnline = await checkBackendConnection();
      setIsBackendConnected(isOnline);

      if (isOnline) {
        // Backend connected -> load authenticated profile & live queue data
        const [feedData, userData] = await Promise.all([
          fetchDashboardFeed(),
          isInitial ? fetchCurrentUser() : Promise.resolve(null),
        ]);

        if (userData) {
          setUser((prev) => {
            if (
              prev &&
              prev.id === userData.id &&
              prev.email === userData.email &&
              prev.name === userData.name &&
              prev.avatar === userData.avatar &&
              Boolean(prev.slackConnected) === Boolean(userData.slackConnected) &&
              Boolean(prev.hasSlackToken) === Boolean(userData.hasSlackToken) &&
              Boolean(prev.hasSlackWebhook) === Boolean(userData.hasSlackWebhook)
            ) {
              return prev;
            }
            return userData;
          });
        } else if (isInitial) {
          // Token expired or invalid
          if (typeof window !== 'undefined') {
            localStorage.removeItem('reachinbox_token');
          }
          setUser(null);
          setLoading(false);
          setIsRefreshing(false);
          return;
        }

        if (feedData?.stats) setStats(feedData.stats);
        if (feedData?.scheduled) setScheduledJobs(feedData.scheduled);
        if (feedData?.sent) setSentJobs(feedData.sent);
      } else {
        // Backend temporarily unreachable but user was authenticated
        setUser(mockUser);
        setStats(mockStats);
        setScheduledJobs(mockScheduledJobs);
        setSentJobs(mockSentJobs);
      }
    } catch (err) {
      console.error('Error refreshing dashboard data', err);
      setIsBackendConnected(false);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        localStorage.setItem('reachinbox_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const slack = params.get('slack');
      if (slack === 'connected') {
        showToast('Slack connected successfully! Live rate-limit alerts active.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    loadData(true);
  }, [loadData]);

  // Periodic polling every 10 seconds to keep queue stats fresh (only when authenticated)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, user]);

  const handleDevLogin = async () => {
    try {
      setLoading(true);
      const devUser = await loginWithDevAccount();
      setUser(devUser);
      showToast(`Welcome back, ${devUser.name}!`, 'success');
      await loadData(false);
    } catch {
      showToast('Dev login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reachinbox_token');
    }
    await logoutUser();
    setUser(null);
    setScheduledJobs([]);
    setSentJobs([]);
    showToast('Signed out successfully', 'info');
  };

  const handleScheduleCampaign = async (payload: SchedulePayload) => {
    const res = await scheduleNewCampaign(payload);
    showToast(
      `Campaign scheduled! ${res.scheduledCount || payload.recipients.length} emails dispatched to BullMQ.`,
      'success'
    );
    await loadData(false);
  };

  const handleCancelJob = async (jobId: string) => {
    const success = await cancelEmail(jobId);
    if (success) {
      setScheduledJobs((prev) => prev.filter((j) => j.id !== jobId));
      setStats((prev) => ({
        ...prev,
        totalScheduled: Math.max(0, prev.totalScheduled - 1),
      }));
      showToast('Scheduled email cancelled from queue', 'info');
    } else {
      showToast('Failed to cancel email job', 'error');
    }
  };

  // Filter lists based on Search Query
  const filteredScheduled = useMemo(() => {
    if (!searchQuery.trim()) return scheduledJobs;
    const q = searchQuery.toLowerCase();
    return scheduledJobs.filter(
      (job) =>
        job.recipientEmail.toLowerCase().includes(q) ||
        job.subject.toLowerCase().includes(q)
    );
  }, [scheduledJobs, searchQuery]);

  const filteredSent = useMemo(() => {
    if (!searchQuery.trim()) return sentJobs;
    const q = searchQuery.toLowerCase();
    return sentJobs.filter(
      (job) =>
        job.recipientEmail.toLowerCase().includes(q) ||
        job.subject.toLowerCase().includes(q)
    );
  }, [sentJobs, searchQuery]);

  // Full-page branded loading splash while resolving initial session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-400 text-white shadow-xl shadow-brand-500/30 animate-pulse">
            <Zap className="h-7 w-7 fill-white text-white" />
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">Loading Session...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render ReachInbox Login first
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-center items-center selection:bg-brand-500 selection:text-white relative">
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 flex items-center space-x-2.5 rounded-xl border border-slate-700 bg-surface-100/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-in text-xs font-medium">
            {toastMessage.type === 'success' && (
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            {toastMessage.type === 'error' && (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            {toastMessage.type === 'info' && (
              <Info className="h-4 w-4 text-brand-400 shrink-0" />
            )}
            <span className="text-slate-200">{toastMessage.text}</span>
          </div>
        )}
        <AuthModal onDevLogin={handleDevLogin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center space-x-2.5 rounded-xl border border-slate-700 bg-surface-100/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-in text-xs font-medium">
          {toastMessage.type === 'success' && (
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          {toastMessage.type === 'error' && (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          {toastMessage.type === 'info' && (
            <Info className="h-4 w-4 text-brand-400 shrink-0" />
          )}
          <span className="text-slate-200">{toastMessage.text}</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Banner & Quick Compose Action */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Email Outreach Dashboard
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Live
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Redis-backed BullMQ scheduling pipeline with rate limiting &amp; deliverability protection.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-500/25 hover:from-brand-500 hover:to-indigo-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Disconnection Warning Alert */}
        {!isBackendConnected && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 shadow-xl shadow-amber-500/5 animate-fade-in">
            <div className="flex items-start space-x-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  Backend Not Connected — Showing Simulated Preview Data
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                    Offline Demo
                  </span>
                </h4>
                <p className="text-xs text-amber-200/80 mt-1 max-w-2xl leading-relaxed">
                  Unable to connect to the Express server at <code className="bg-amber-950/70 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-amber-800/40">http://localhost:3001</code>. The dashboard is currently displaying hardcoded sample records. Start the backend with <code className="bg-amber-950/70 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-amber-800/40">npm run dev</code> in the backend folder to connect to live BullMQ queues.
                </p>
              </div>
            </div>
            <button
              onClick={() => loadData(false)}
              className="shrink-0 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-all border border-amber-500/40 flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

        {/* Metrics Row */}
        <StatsCards stats={stats} loading={loading} />

        {/* Tab Controls & Search Filter */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
            {/* Tabs */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'scheduled'
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <CalendarClock className="h-4 w-4" />
                <span>Scheduled Emails</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                  {scheduledJobs.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('sent')}
                className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'sent'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Send className="h-4 w-4" />
                <span>Sent Emails</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                  {sentJobs.length}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by email or subject..."
                className="w-full rounded-xl border border-slate-800 bg-[#0F172A] pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>
          </div>

          {/* Tables Content */}
          {activeTab === 'scheduled' ? (
            <ScheduledTable
              jobs={filteredScheduled}
              loading={loading}
              onCancelJob={handleCancelJob}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          ) : (
            <SentTable jobs={filteredSent} loading={loading} />
          )}
        </div>
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSchedule={handleScheduleCampaign}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0B0F17] py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 ReachInbox Scheduler. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-brand-400" />
              BullMQ + Redis 7 + PostgreSQL + Ethereal SMTP
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
