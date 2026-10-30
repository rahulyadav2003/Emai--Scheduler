'use client';

import React, { useState, useRef } from 'react';
import { SchedulePayload } from '@/types';
import { parseEmailsFromString, isValidEmail } from '@/lib/utils';
import {
  X,
  UploadCloud,
  FileText,
  Clock,
  Sparkles,
  Users,
  Timer,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  Trash2,
  Calendar,
  CalendarDays,
  Zap,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (payload: SchedulePayload) => Promise<void>;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(
    'Hi there,\n\nI noticed your team has been scaling outreach operations and wanted to share how ReachInbox helps schedule high-volume cold campaigns with automated rate-limiting, Ethereal preview testing, and zero deliverability drop.\n\nWould you be open to a 10-minute chat this week?\n\nBest,\nAlex Morgan'
  );
  const [recipientsInput, setRecipientsInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Scheduling controls
  const [scheduleType, setScheduleType] = useState<'now' | 'custom'>('now');

  // Separate Date & Time state
  const todayIso = new Date().toISOString().split('T')[0];

  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [scheduledTime, setScheduledTime] = useState<string>(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000); // 15 mins ahead
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  const [delaySeconds, setDelaySeconds] = useState<number>(3);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const parsedRecipients = parseEmailsFromString(recipientsInput);

  // Preset helpers for Time
  const setQuickTime = (minutesAhead: number) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    const dateStr = target.toISOString().split('T')[0];
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    setScheduledDate(dateStr);
    setScheduledTime(`${hh}:${mm}`);
  };

  const setTomorrowMorning = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setScheduledDate(dateStr);
    setScheduledTime('09:00');
  };

  // Calculate live readable summary
  const getReadableSchedule = () => {
    if (!scheduledDate || !scheduledTime) return null;
    try {
      const [year, month, day] = scheduledDate.split('-').map(Number);
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const d = new Date(year, month - 1, day, hours, minutes);
      if (isNaN(d.getTime())) return null;

      const dateStr = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const diffMs = d.getTime() - Date.now();
      const diffMins = Math.round(diffMs / 60000);

      let relativeStr = '';
      if (diffMins < 0) {
        relativeStr = 'time is in the past';
      } else if (diffMins < 60) {
        relativeStr = `in ${diffMins} min${diffMins === 1 ? '' : 's'}`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;
        relativeStr = `in ${diffHours}h ${remMins}m`;
      }

      return {
        formatted: `${dateStr} at ${timeStr}`,
        relative: relativeStr,
        isPast: diffMs < -60000,
      };
    } catch {
      return null;
    }
  };

  const scheduleInfo = getReadableSchedule();

  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMsg('Please upload a valid .csv or .txt file containing recipient emails.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setFileName(file.name);
        const existingEmails = parseEmailsFromString(recipientsInput);
        const newEmails = parseEmailsFromString(content);
        const combined = Array.from(new Set([...existingEmails, ...newEmails]));
        setRecipientsInput(combined.join('\n'));
        setErrorMsg(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!subject.trim()) {
      setErrorMsg('Please provide a campaign email subject.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Please provide the email body content.');
      return;
    }
    if (parsedRecipients.length === 0) {
      setErrorMsg('Please provide at least one valid recipient email address.');
      return;
    }
    if (delaySeconds < 1) {
      setErrorMsg('Minimum delay between emails must be at least 1 second.');
      return;
    }
    if (hourlyLimit < 1) {
      setErrorMsg('Hourly limit must be at least 1 email/hour.');
      return;
    }

    let startTimeIso: string | undefined = undefined;
    if (scheduleType === 'custom') {
      if (!scheduledDate) {
        setErrorMsg('Please select a scheduled start date from the calendar.');
        return;
      }
      if (!scheduledTime) {
        setErrorMsg('Please select a scheduled start time.');
        return;
      }
      const [year, month, day] = scheduledDate.split('-').map(Number);
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const chosen = new Date(year, month - 1, day, hours, minutes, 0);

      if (isNaN(chosen.getTime())) {
        setErrorMsg('Please select a valid scheduled start date and time.');
        return;
      }
      if (chosen.getTime() < Date.now() - 60000) {
        setErrorMsg('Scheduled start time cannot be in the past. Please select a future time.');
        return;
      }
      startTimeIso = chosen.toISOString();
    }

    try {
      setIsSubmitting(true);
      await onSchedule({
        subject: subject.trim(),
        body: body.trim(),
        recipients: parsedRecipients,
        startTime: startTimeIso,
        delayBetweenSeconds: delaySeconds,
        hourlyLimit: hourlyLimit,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message || 'Failed to schedule campaign.');
      } else {
        setErrorMsg('Failed to schedule campaign. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0F172A] shadow-2xl shadow-brand-500/10 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Compose Email Campaign</h2>
              <p className="text-xs text-slate-400">
                Configure recipients, delayed queue timing, and hourly provider safety caps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start space-x-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Subject Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Email Subject <span className="text-brand-400">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question regarding cold email infrastructure"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>

          {/* Recipients Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-brand-400" />
                <span>Recipients (Leads)</span>
              </label>

              {parsedRecipients.length > 0 && (
                <div className="flex items-center space-x-1.5 rounded-full bg-brand-500/15 px-2.5 py-0.5 border border-brand-500/30 text-[11px] font-semibold text-brand-300">
                  <CheckCircle2 className="h-3 w-3 text-brand-400" />
                  <span>{parsedRecipients.length} valid lead{parsedRecipients.length === 1 ? '' : 's'} detected</span>
                </div>
              )}
            </div>

            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-all ${
                isDragging
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center space-y-1">
                <UploadCloud className="h-6 w-6 text-brand-400" />
                <p className="text-xs font-medium text-slate-300">
                  <span className="text-brand-400 font-semibold underline">Click to upload</span> or drag and drop CSV / TXT
                </p>
                <p className="text-[11px] text-slate-500">
                  Auto-extracts any valid emails in CSV columns or plain text lists
                </p>
              </div>
            </div>

            {fileName && (
              <div className="flex items-center justify-between rounded-lg bg-surface-100 px-3 py-1.5 text-xs text-slate-300 border border-slate-700">
                <span className="flex items-center gap-1.5 truncate">
                  <FileText className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                  {fileName}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileName(null);
                  }}
                  className="text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Manual text area */}
            <textarea
              rows={3}
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              placeholder="Paste comma or newline separated email addresses..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all resize-none"
            />
          </div>

          {/* Body Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Email Content / Body <span className="text-brand-400">*</span>
            </label>
            <textarea
              rows={5}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body here..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3.5 text-sm text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>

          {/* Scheduling & Rate Limits Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
              <Clock className="h-4 w-4" />
              <span>Scheduling &amp; Rate-Limiting Parameters</span>
            </div>

            {/* 3 Parameter Columns */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Start Time Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Start Time</label>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`flex items-center justify-center gap-1 rounded-md py-1.5 font-medium transition-all ${
                      scheduleType === 'now'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Zap className="h-3 w-3" />
                    <span>Send Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('custom')}
                    className={`flex items-center justify-center gap-1 rounded-md py-1.5 font-medium transition-all ${
                      scheduleType === 'custom'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Schedule</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  {scheduleType === 'now' ? 'Sends immediately via queue' : 'Pick future date & time'}
                </p>
              </div>

              {/* Delay between each email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-brand-400" />
                  <span>Delay Between Emails</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">
                    seconds
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Prevents bursts &amp; spam triggers
                </p>
              </div>

              {/* Hourly limit per sender */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Hourly Rate Limit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">
                    emails/hr
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Auto-enforces sender mailbox safety
                </p>
              </div>
            </div>

            {/* Expanded Dedicated Date & Time Picker */}
            {scheduleType === 'custom' && (
              <div className="rounded-xl border border-brand-500/20 bg-slate-950/80 p-3.5 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-brand-400" />
                    <span>Select Scheduled Launch Date &amp; Time</span>
                  </span>
                  {scheduleInfo && (
                    <span
                      className={`text-[11px] font-medium flex items-center gap-1 ${
                        scheduleInfo.isPast
                          ? 'text-rose-400 font-semibold'
                          : 'text-emerald-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${scheduleInfo.isPast ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
                      {scheduleInfo.isPast ? 'Selected time is in the past' : `Starts ${scheduleInfo.relative}`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Date Input with Calendar */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-brand-400" />
                      <span>Calendar Date</span>
                    </label>
                    <input
                      type="date"
                      min={todayIso}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-brand-500 focus:outline-none [color-scheme:dark]"
                    />
                  </div>

                  {/* Time Input with Clock */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-brand-400" />
                      <span>Time (24h or AM/PM)</span>
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-brand-500 focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Quick Presets Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => setQuickTime(15)}
                    className="rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:border-brand-500 hover:text-white transition-all"
                  >
                    +15 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(30)}
                    className="rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:border-brand-500 hover:text-white transition-all"
                  >
                    +30 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(60)}
                    className="rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:border-brand-500 hover:text-white transition-all"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => setTomorrowMorning()}
                    className="rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:border-brand-500 hover:text-white transition-all"
                  >
                    Tomorrow 9:00 AM
                  </button>
                </div>

                {/* Confirmation Box */}
                {scheduleInfo && !scheduleInfo.isPast && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-300 flex items-center justify-between">
                    <span>🗓️ Scheduled for: <strong>{scheduleInfo.formatted}</strong></span>
                    <span className="font-semibold text-emerald-400">({scheduleInfo.relative})</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-700 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedRecipients.length === 0 || (scheduleType === 'custom' && Boolean(scheduleInfo?.isPast))}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-500/20 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enqueuing Campaign...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Schedule Campaign ({parsedRecipients.length})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
