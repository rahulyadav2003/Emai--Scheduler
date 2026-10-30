'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient, API_BASE_URL } from '@/lib/api';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Hash,
  Send,
  Loader2,
  Trash2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [status, setStatus] = useState<{
    connected: boolean;
    hasWebhook: boolean;
    hasToken: boolean;
    maskedWebhookUrl: string | null;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSlackStatus = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/slack/status');
      setStatus(res.data);
      if (onStatusChange) onStatusChange();
    } catch {
      setStatus({
        connected: false,
        hasWebhook: false,
        hasToken: false,
        maskedWebhookUrl: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSlackStatus();
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      setMessage({
        text: 'Please enter a valid Slack webhook URL (https://hooks.slack.com/services/...)',
        type: 'error',
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      await apiClient.post('/api/slack/webhook', { webhookUrl });
      setMessage({ text: 'Slack webhook connected successfully!', type: 'success' });
      setWebhookUrl('');
      await fetchSlackStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.error || 'Failed to save Slack webhook',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    try {
      setTesting(true);
      setMessage(null);
      const res = await apiClient.post('/api/slack/test');
      if (res.data?.success) {
        setMessage({
          text: res.data.message || 'Test rate-limit alert sent! Check your Slack channel.',
          type: 'success',
        });
      } else {
        setMessage({
          text: res.data?.error || 'Failed to dispatch test Slack alert',
          type: 'error',
        });
      }
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.error || err.message || 'Failed to dispatch test Slack alert',
        type: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setSaving(true);
      await apiClient.post('/api/slack/disconnect');
      setMessage({ text: 'Slack disconnected', type: 'success' });
      await fetchSlackStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.error || 'Failed to disconnect Slack',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto my-auto rounded-2xl border border-slate-800 bg-[#0F172A] shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A154B]/30 text-[#E01E5A] border border-[#E01E5A]/30">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Slack Rate-Limit Telemetry
              </h2>
              <p className="text-xs text-slate-400">
                Receive live alerts the moment a sender breaches their hourly quota
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

        {/* Feedback message */}
        {message && (
          <div
            className={`flex items-center space-x-2 rounded-xl p-3 text-xs ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Status Display */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Connection Status:</span>
            {loading ? (
              <span className="text-xs text-slate-500 animate-pulse">Checking...</span>
            ) : status?.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                <span>Connected &amp; Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400 border border-slate-700">
                <span>Not Connected</span>
              </span>
            )}
          </div>

          {status?.connected && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-400 truncate max-w-xs font-mono text-[11px]">
                {status.maskedWebhookUrl || 'Slack Bot OAuth Token'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={testing}
                  className="rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 px-2.5 py-1 text-xs font-semibold border border-emerald-500/30 transition-all flex items-center gap-1"
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  <span>Test Alert</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={saving}
                  className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                  title="Disconnect Slack"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Connect via Webhook Form */}
        {!status?.connected && (
          <form onSubmit={handleSaveWebhook} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Connect via Slack Incoming Webhook
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Paste your Slack channel webhook URL to receive live rate-limit cards directly in your team channel.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !webhookUrl.trim()}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-500 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hash className="h-3.5 w-3.5" />}
              <span>Save &amp; Connect Webhook</span>
            </button>

            {/* Alternative OAuth Connect */}
            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-500 block mb-2">or connect via OAuth</span>
              <a
                href={`${API_BASE_URL}/api/slack/connect`}
                className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 underline"
              >
                <span>Authorize via Slack App OAuth</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SlackModal;

