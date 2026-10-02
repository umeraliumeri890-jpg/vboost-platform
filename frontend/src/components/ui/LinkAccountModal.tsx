'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi } from '@/lib/api';
import { CheckCircle, Loader2 } from 'lucide-react';

interface LinkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string;
  currentHandle?: string;
  onSuccess: () => void;
}

export default function LinkAccountModal({
  isOpen,
  onClose,
  platform,
  currentHandle = '',
  onSuccess,
}: LinkAccountModalProps) {
  const { refreshUser } = useAuth();
  const [handle, setHandle] = useState(currentHandle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await dashboardApi.linkSocialAccount({
        platform: platform.toLowerCase(),
        handle: handle.trim(),
      });
      await refreshUser();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to link account.');
    } finally {
      setLoading(false);
    }
  };

  const platformNames: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    vk: 'VKontakte',
    youtube: 'YouTube',
    telegram: 'Telegram',
    facebook: 'Facebook',
    threads: 'Threads',
    twitter: 'X (Twitter)',
  };

  const name = platformNames[platform.toLowerCase()] || platform;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Link ${name} Account`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Enter your {name} profile username or handle. This is used to verify your subscriptions and likes automatically.
        </p>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="label">{name} Username / Handle</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
            <input
              type="text"
              className="v-input pl-8"
              placeholder="your_handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="v-btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading || !handle.trim()} className="v-btn-primary flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
