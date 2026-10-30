'use client';

import React from 'react';
import { EmailJob } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  Send,
  CheckCircle,
  XCircle,
  ExternalLink,
  Mail,
  AlertTriangle,
  Eye,
} from 'lucide-react';

interface SentTableProps {
  jobs: EmailJob[];
  loading?: boolean;
}

export const SentTable: React.FC<SentTableProps> = ({ jobs = [], loading = false }) => {
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
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
          <Send className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-white">No Emails Dispatched Yet</h3>
        <p className="mt-1.5 max-w-sm text-xs text-slate-400">
          Once your scheduled emails are picked up by the BullMQ worker and delivered through Ethereal SMTP, they will appear here with live preview links.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A]/70 shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-surface-100/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-6 py-3.5">Recipient</th>
              <th className="px-6 py-3.5">Subject</th>
              <th className="px-6 py-3.5">Sent Timestamp</th>
              <th className="px-6 py-3.5">Delivery Status</th>
              <th className="px-6 py-3.5 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {safeJobs.map((job) => {
              const isSent = job.status === 'SENT';
              const isFailed = job.status === 'FAILED';

              return (
                <tr
                  key={job.id}
                  className="transition-colors hover:bg-surface-100/50 group"
                >
                  {/* Recipient */}
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

                  {/* Subject */}
                  <td className="px-6 py-4 text-slate-300 max-w-xs truncate font-medium">
                    {job.subject}
                  </td>

                  {/* Sent Time */}
                  <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">
                        {formatDate(job.sentAt || job.scheduledTime)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatRelativeTime(job.sentAt || job.scheduledTime)}
                      </span>
                    </div>
                  </td>

                  {/* Delivery Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isSent && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="h-3 w-3" />
                        Delivered
                      </span>
                    )}
                    {isFailed && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20" title={job.errorMessage || 'Failed to deliver'}>
                        <XCircle className="h-3 w-3" />
                        <span>Failed</span>
                        {job.errorMessage && (
                          <span className="text-[10px] text-rose-300/80 max-w-[120px] truncate">
                            ({job.errorMessage})
                          </span>
                        )}
                      </div>
                    )}
                    {!isSent && !isFailed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                        {job.status}
                      </span>
                    )}
                  </td>

                  {/* Ethereal Preview Button */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {job.etherealPreviewUrl ? (
                      <a
                        href={job.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/60 transition-all shadow-sm"
                        title="Open interactive Ethereal email rendered preview in new tab"
                      >
                        <Eye className="h-3.5 w-3.5 text-indigo-400" />
                        <span>View Preview</span>
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    ) : isFailed ? (
                      <span className="text-xs text-rose-400/70 italic flex items-center justify-end gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Delivery error
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        Not available
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
