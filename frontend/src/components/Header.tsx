'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { User } from '@/types';
import { API_BASE_URL } from '@/lib/api';
import { SlackModal } from './SlackModal';
import {
  LogOut,
  ExternalLink,
  Zap,
  CheckCircle2,
  AlertCircle,
  Hash,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onRefresh,
  isRefreshing = false,
}) => {
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatar]);
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const bullBoardUrl = `${API_BASE_URL}/admin/queues`;
  const isSlackConnected = Boolean(
    user?.slackConnected || user?.hasSlackToken || user?.hasSlackWebhook
  );

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Product */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 text-white shadow-lg shadow-brand-500/25">
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-white">
                ReachInbox
              </span>
              <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-400 border border-brand-500/20">
                Outbound Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Intelligent Email Scheduler &amp; Rate-Limiter
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Refresh Data Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh queue and email stats"
              className="hidden sm:inline-flex items-center space-x-1.5 rounded-lg border border-slate-700/60 bg-surface-100/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-surface-200 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`}
              />
              <span>Sync</span>
            </button>
          )}

          {/* BullMQ Admin Dashboard Link */}
          <a
            href={bullBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20 hover:border-brand-500/50 transition-all shadow-sm shadow-brand-500/10"
            title="Inspect Redis BullMQ Queues in real-time"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
            <span className="font-semibold">Bull-Board</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>

          {/* Slack Integration Status Badge */}
          {isSlackConnected ? (
            <button
              onClick={() => setIsSlackOpen(true)}
              className="hidden md:flex items-center space-x-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
              title="Click to manage Slack rate-limit telemetry"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="flex items-center gap-0.5">
                <Hash className="h-3 w-3 inline text-emerald-400/80" />
                <span>Slack Alerting Active</span>
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsSlackOpen(true)}
              className="hidden md:flex items-center space-x-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
              title="Connect Slack for instant rate-limit alerts"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>Connect Slack</span>
            </button>
          )}

          {/* User Profile */}
          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="relative">
                {user.avatar && !imgError ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-brand-500/30 shadow-sm"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-md ring-2 ring-brand-500/30">
                    {getInitials(user.name)}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0B0F17]" />
              </div>

              <div className="hidden lg:block text-left leading-tight">
                <p className="text-xs font-semibold text-slate-200">
                  {user.name}
                </p>
                <p className="text-[11px] text-slate-400 max-w-[150px] truncate">
                  {user.email}
                </p>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="rounded-lg p-2 text-slate-400 hover:bg-surface-200 hover:text-rose-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Slack Configuration & Live Test Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        onStatusChange={onRefresh}
      />
    </header>
  );
};
