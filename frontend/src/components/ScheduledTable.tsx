'use client';

import React, { useState } from 'react';
import { EmailJob } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  CalendarClock,
  Clock,
  Info,
  XCircle,
  Mail,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface ScheduledTableProps {
  jobs: EmailJob[];
  loading?: boolean;
  onCancelJob?: (id: string) => Promise<void>;
  onOpenCompose?: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  jobs = [],
  loading = false,
  onCancelJob,
  onOpenCompose,
}) => {
  const [selectedJob, setSelectedJob] = useState<EmailJob | null>(null);
  const safeJobs = Array.isArray(jobs) ? jobs : [];

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-slate-800 bg-[#0F172A]/80 p-6 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 w-full animate-pulse rounded-xl bg-slate-800/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (safeJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-surface-50/50 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-4">
          <CalendarClock className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-white">No Scheduled Emails in Queue</h3>
        <p className="mt-1.5 max-w-sm text-xs text-slate-400">
          Your Redis outbound queue is clean. Compose a campaign or upload a lead list to start scheduling personalized outreach.
        </p>
        {onOpenCompose && (
          <button
            onClick={onOpenCompose}
            className="mt-5 inline-flex items-center space-x-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-500 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Schedule Your Campaign</span>
          </button>
        )}
      </div>
    );
  }

  const getStatusBadge = (status: EmailJob['status']) => {
    switch (status) {
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
            <RotateCcw className="h-3 w-3" />
            Rescheduled (Rate Limit)
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-600/40">
            <Clock className="h-3 w-3" />
            Pending Dispatch
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-300 border border-brand-500/20">
            <CalendarClock className="h-3 w-3" />
            Scheduled
          </span>
        );
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A]/70 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-surface-100/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Recipient</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Scheduled For</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {safeJobs.map((job) => (
                <tr
                  key={job.id}
                  className="transition-colors hover:bg-surface-100/50 group"
                >
                  <td className="px-6 py-4 font-medium text-slate-200">
                    <div className="flex items-center space-x-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-semibold text-slate-100">
                        {job.recipientEmail}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-slate-300 max-w-xs truncate font-medium">
                    {job.subject}
                  </td>

                  <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">
                        {formatDate(job.scheduledTime)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatRelativeTime(job.scheduledTime)}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(job.status)}
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        title="View job details"
                      >
                        <Info className="h-4 w-4" />
                      </button>

                      {onCancelJob && (
                        <button
                          onClick={() => onCancelJob(job.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                          title="Cancel scheduled dispatch"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0F172A] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-semibold text-white">Job Details</h4>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Job ID:</span>{' '}
                <span className="font-mono text-slate-200">{selectedJob.id}</span>
              </div>
              <div>
                <span className="text-slate-400">Recipient:</span>{' '}
                <span className="font-semibold text-slate-200">
                  {selectedJob.recipientEmail}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Subject:</span>{' '}
                <span className="text-slate-200">{selectedJob.subject}</span>
              </div>
              <div>
                <span className="text-slate-400">Scheduled Time:</span>{' '}
                <span className="text-slate-200">
                  {formatDate(selectedJob.scheduledTime)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">BullMQ Status:</span>{' '}
                <span className="ml-1">{getStatusBadge(selectedJob.status)}</span>
              </div>
              {selectedJob.attempts !== undefined && (
                <div>
                  <span className="text-slate-400">Attempts:</span>{' '}
                  <span className="text-slate-200">
                    {selectedJob.attempts} / {selectedJob.maxAttempts || 3}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
