// src/components/advertiser/CampaignForm.tsx
'use client';
import { useState } from 'react';
import { offersApi } from '@/lib/api';
import { AlertCircle, Loader2, Plus } from 'lucide-react';

const CATEGORIES = [
  { value: 'vk_follow', label: 'VK — Follow' },
  { value: 'vk_like', label: 'VK — Like' },
  { value: 'vk_repost', label: 'VK — Repost' },
  { value: 'instagram_follow', label: 'Instagram — Follow' },
  { value: 'instagram_like', label: 'Instagram — Like' },
  { value: 'instagram_comment', label: 'Instagram — Comment' },
  { value: 'youtube_subscribe', label: 'YouTube — Subscribe' },
  { value: 'youtube_like', label: 'YouTube — Like' },
  { value: 'youtube_watch', label: 'YouTube — Watch' },
  { value: 'tiktok_follow', label: 'TikTok — Follow' },
  { value: 'tiktok_like', label: 'TikTok — Like' },
  { value: 'telegram_join', label: 'Telegram — Join Channel' },
  { value: 'telegram_view', label: 'Telegram — View Post' },
  { value: 'facebook_like', label: 'Facebook — Like Page' },
  { value: 'facebook_follow', label: 'Facebook — Follow' },
  { value: 'twitter_follow', label: 'X/Twitter — Follow' },
  { value: 'twitter_like', label: 'X/Twitter — Like' },
  { value: 'twitter_retweet', label: 'X/Twitter — Retweet' },
  { value: 'threads_follow', label: 'Threads — Follow' },
  { value: 'app_install_android', label: 'App Install — Android' },
  { value: 'app_install_ios', label: 'App Install — iOS' },
  { value: 'site_visit', label: 'Website — Visit/Surf' },
  { value: 'site_signup', label: 'Website — Sign Up' },
  { value: 'google_review', label: 'Google — Review' },
  { value: 'yandex_review', label: 'Yandex — Review' },
  { value: 'custom', label: 'Custom Task' },
];

const defaultForm = {
  title: '',
  description: '',
  category: 'instagram_follow',
  targetUrl: '',
  instructions: '',
  proofInstructions: '',
  proofType: 'screenshot',
  payoutPerTask: '0.05',
  totalLimit: '100',
  autoApprove: false,
  autoApproveDelay: '3600',
  targeting: { minLevel: '1', maxCompletionsPerUser: '1', countries: '' },
};

interface CampaignFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function CampaignForm({ onSuccess, onClose }: CampaignFormProps) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const setTarget = (key: string, value: string) =>
    setForm((f) => ({ ...f, targeting: { ...f.targeting, [key]: value } }));

  const payout = parseFloat(form.payoutPerTask) || 0;
  const limit = parseInt(form.totalLimit) || 0;
  const grossPerTask = payout / (1 - 0.15);
  const totalCost = grossPerTask * limit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const countries = form.targeting.countries
        ? form.targeting.countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
        : [];
      await offersApi.create({
        title: form.title,
        description: form.description,
        category: form.category,
        targetUrl: form.targetUrl,
        instructions: form.instructions,
        proofInstructions: form.proofInstructions || undefined,
        proofType: form.proofType,
        payoutPerTask: parseFloat(form.payoutPerTask),
        totalLimit: parseInt(form.totalLimit),
        autoApprove: form.autoApprove,
        autoApproveDelay: parseInt(form.autoApproveDelay),
        targeting: {
          minLevel: parseInt(form.targeting.minLevel),
          maxCompletionsPerUser: parseInt(form.targeting.maxCompletionsPerUser),
          countries,
        },
      });
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to create campaign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Campaign Title</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Follow our Instagram page" required minLength={5} maxLength={120} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Proof Type</label>
          <select className="input" value={form.proofType} onChange={(e) => set('proofType', e.target.value)}>
            <option value="screenshot">Screenshot</option>
            <option value="username">Username / Handle</option>
            <option value="text">Text Description</option>
            <option value="url">Result URL</option>
            <option value="none">No Proof Required</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Target URL</label>
          <input className="input" type="url" value={form.targetUrl}
            onChange={(e) => set('targetUrl', e.target.value)}
            placeholder="https://instagram.com/youraccount" required />
        </div>
        <div className="col-span-2">
          <label className="label">Description <span className="text-slate-500">(shown to workers)</span></label>
          <textarea className="input h-20 resize-none" value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Brief description of the task..." required minLength={10} />
        </div>
        <div className="col-span-2">
          <label className="label">Step-by-Step Instructions</label>
          <textarea className="input h-28 resize-none" value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            placeholder="1. Go to the URL above&#10;2. Click Follow&#10;3. Screenshot your profile page showing you followed..." required minLength={10} />
        </div>
        <div className="col-span-2">
          <label className="label">Proof Instructions <span className="text-slate-500">(optional)</span></label>
          <input className="input" value={form.proofInstructions}
            onChange={(e) => set('proofInstructions', e.target.value)}
            placeholder="What to screenshot / what text to enter..." />
        </div>
        <div>
          <label className="label">Payout per Worker ($)</label>
          <input className="input" type="number" min="0.01" step="0.001" value={form.payoutPerTask}
            onChange={(e) => set('payoutPerTask', e.target.value)} required />
          <p className="text-xs text-slate-500 mt-1">Worker earns: <span className="text-emerald-400">${payout.toFixed(3)}</span></p>
        </div>
        <div>
          <label className="label">Max Workers</label>
          <input className="input" type="number" min="1" value={form.totalLimit}
            onChange={(e) => set('totalLimit', e.target.value)} required />
        </div>
      </div>

      {/* Cost summary */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <p className="text-sm font-semibold text-white mb-3">💰 Cost Summary</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Workers × payout</span>
            <span>{limit} × ${payout.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Platform fee (15%)</span>
            <span>${(totalCost - payout * limit).toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-700 pt-1.5 flex justify-between font-semibold text-white">
            <span>Total Budget Locked</span>
            <span className="text-brand-400">${totalCost.toFixed(2)}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Deducted from your Ad Balance on creation.</p>
      </div>

      {/* Advanced */}
      <details>
        <summary className="text-sm text-slate-400 cursor-pointer hover:text-white transition-colors select-none">
          ⚙️ Advanced Targeting Settings
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Min. Worker Level</label>
            <input className="input" type="number" min="1" max="10" value={form.targeting.minLevel}
              onChange={(e) => setTarget('minLevel', e.target.value)} />
          </div>
          <div>
            <label className="label">Max per User</label>
            <input className="input" type="number" min="1" value={form.targeting.maxCompletionsPerUser}
              onChange={(e) => setTarget('maxCompletionsPerUser', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Target Countries <span className="text-slate-500">(ISO codes, empty = all)</span></label>
            <input className="input" value={form.targeting.countries}
              onChange={(e) => setTarget('countries', e.target.value)}
              placeholder="US, GB, DE, RU" />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <input type="checkbox" id="autoApprove" checked={form.autoApprove}
              onChange={(e) => set('autoApprove', e.target.checked)}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600 accent-brand-600" />
            <label htmlFor="autoApprove" className="text-sm text-slate-300 cursor-pointer">
              Auto-approve submissions
            </label>
          </div>
          {form.autoApprove && (
            <div>
              <label className="label">Auto-approve Delay (seconds)</label>
              <input className="input" type="number" min="0" value={form.autoApproveDelay}
                onChange={(e) => set('autoApproveDelay', e.target.value)} />
            </div>
          )}
        </div>
      </details>

      <div className="flex gap-3 pt-2 border-t border-slate-800">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {loading ? 'Creating Campaign...' : 'Create Campaign'}
        </button>
      </div>
    </form>
  );
}
