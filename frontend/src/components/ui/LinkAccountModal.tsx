'use client';
import { useState, useEffect } from 'react';
import { dashboardApi } from '@/lib/api';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';

const PLATFORM_INFO: Record<string, { label: string; placeholder: string; icon: string; urlPrefix: string }> = {
  instagram:  { label: 'Instagram',      placeholder: 'yourhandle (without @)', icon: '📸', urlPrefix: 'instagram.com/' },
  tiktok:     { label: 'TikTok',         placeholder: 'yourhandle (without @)', icon: '🎵', urlPrefix: 'tiktok.com/@' },
  youtube:    { label: 'YouTube',        placeholder: 'channel handle or ID',  icon: '▶️', urlPrefix: 'youtube.com/@' },
  twitter:    { label: 'Twitter / X',    placeholder: 'yourhandle (without @)', icon: '✕',  urlPrefix: 'x.com/' },
  telegram:   { label: 'Telegram',       placeholder: 'yourusername',            icon: '✈️', urlPrefix: 't.me/' },
  vk:         { label: 'VKontakte',      placeholder: 'id or username',          icon: '🔷', urlPrefix: 'vk.com/' },
  facebook:   { label: 'Facebook',       placeholder: 'profile name or ID',      icon: '👤', urlPrefix: 'facebook.com/' },
  threads:    { label: 'Threads',        placeholder: 'yourhandle (without @)', icon: '🧵', urlPrefix: 'threads.net/@' },
  general:    { label: 'Social Account', placeholder: 'Enter your handle',       icon: '🔗', urlPrefix: '' },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  platform: string;
  currentHandle: string;
  onSuccess?: () => void;
}

export default function LinkAccountModal({ isOpen, onClose, platform, currentHandle, onSuccess }: Props) {
  const info = PLATFORM_INFO[platform] || PLATFORM_INFO.general;
  const [handle, setHandle] = useState(currentHandle || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync handle when the modal opens or currentHandle changes
  useEffect(() => {
    if (isOpen) {
      setHandle(currentHandle || '');
      setError('');
      setSuccess(false);
    }
  }, [isOpen, currentHandle]);

  const handleSave = async () => {
    setError('');
    const cleaned = handle.replace(/^@/, '').trim();

    if (!cleaned) {
      setError('Please enter a valid handle or username.');
      return;
    }
    if (cleaned.length < 2) {
      setError('Handle must be at least 2 characters.');
      return;
    }
    if (cleaned.includes(' ')) {
      setError('Handle cannot contain spaces.');
      return;
    }

    const resolvedPlatform = platform === 'general' ? 'instagram' : platform;

    setLoading(true);
    try {
      await dashboardApi.linkSocialAccount({ platform: resolvedPlatform, handle: cleaned });
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to link account. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setError('');
    setLoading(true);
    const resolvedPlatform = platform === 'general' ? 'instagram' : platform;
    try {
      await dashboardApi.linkSocialAccount({ platform: resolvedPlatform, handle: '' });
      setHandle('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to unlink.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-sm v-card p-0 animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>{info.icon}</span> Link {info.label}
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6 space-y-2">
              <Check className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-900 dark:text-white">Account Linked!</p>
              <p className="text-xs text-slate-500">@{handle.replace(/^@/, '')} is now linked to your profile.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  {info.label.toUpperCase()} HANDLE
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">@</span>
                  <input
                    type="text"
                    value={handle.replace(/^@/, '')}
                    onChange={(e) => setHandle(e.target.value.replace(/^@/, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder={info.placeholder}
                    autoFocus
                    className="v-input w-full pl-7 text-sm"
                  />
                </div>
                {handle && !handle.includes(' ') && (
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <span>Profile:</span>
                    <a
                      href={`https://${info.urlPrefix}${handle.replace(/^@/, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {info.urlPrefix}{handle.replace(/^@/, '')}
                    </a>
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="v-btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? 'Saving...' : 'Save'}
                </button>
                {currentHandle && (
                  <button
                    onClick={handleUnlink}
                    disabled={loading}
                    className="v-btn-secondary px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs"
                  >
                    Unlink
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
