'use client';

import React from 'react';
import { DashboardStats } from '@/types';
import {
  CalendarClock,
  Send,
  AlertTriangle,
  Layers,
  Gauge,
  Activity,
} from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats;
  loading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Scheduled */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Scheduled Queue
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <CalendarClock className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-white">
            {loading ? (
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-800" />
            ) : (
              stats.totalScheduled
            )}
          </div>
          <span className="inline-flex items-center text-xs font-medium text-brand-300">
            Pending dispatch
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-ping" />
          <span>BullMQ delayed state</span>
        </div>
      </div>

      {/* 2. Sent Today */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Sent Today
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Send className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-white">
            {loading ? (
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-800" />
            ) : (
              stats.sentToday
            )}
          </div>
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            Lifetime: <span className="ml-1 text-slate-200 font-semibold">{stats.totalSent}</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Ethereal SMTP delivered</span>
        </div>
      </div>

      {/* 3. Failed / Bounces */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Failed / Retrying
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-white">
            {loading ? (
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-800" />
            ) : (
              stats.failedToday
            )}
          </div>
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            Total failed: <span className="ml-1 text-rose-300 font-semibold">{stats.totalFailed}</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${stats.failedToday > 0 ? 'bg-rose-400' : 'bg-slate-600'}`} />
          <span>Exponential backoff retries</span>
        </div>
      </div>

      {/* 4. Current Queue & Rate Limit Status */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Rate Limit &amp; Worker
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Gauge className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            {loading ? (
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-800" />
            ) : (
              <span>{stats.hourlyLimitRemaining} / hr</span>
            )}
          </div>
          <span className="inline-flex items-center text-xs font-medium text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            Leaky Bucket
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Activity className="h-3 w-3 animate-pulse" />
            Worker active
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <Layers className="h-3 w-3" />
            Queue: {stats.currentQueueCount}
          </span>
        </div>
      </div>
    </div>
  );
};
