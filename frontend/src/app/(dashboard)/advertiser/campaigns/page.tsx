'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Campaign } from '@/types';
import { offersApi } from '@/lib/api';
import {
  PlusCircle, Pause, Play, Trash2, RefreshCw,
  DollarSign, Users, AlertCircle, Loader2
} from 'lucide-react';

const CATEGORIES = [
  'vk_follow', 'vk_like', 'vk_repost',
  'instagram_follow', 'instagram_like',
  'youtube_subscribe', 'youtube_like', 'youtube_watch',
  'tiktok_follow', 'tiktok_like',
  'telegram_join',
  'facebook_like', 'facebook_follow',
  'twitter_follow', 'twitter_like',
  'threads_follow',
  'app_install_android', 'app_install_ios',
  'site_visit', 'site_signup',
  'google_review', 'yandex_review',
  'custom',
];

const PROOF_TYPES = ['screenshot', 'text', 'username', 'url', 'none'];

interface CampaignFormData {
  title: string;
  description: string;
  category: string;
  targetUrl: string;
  instructions: string;
  proofType: string;
  proofInstructions: string;
  payoutPerTask: string;
  totalBudget: string;
  totalLimit: string;
  autoApprove: boolean;
  minLevel: string;
  maxCompletionsPerUser: string;
}

const defaultForm: CampaignFormData = {
  title: '',
  description: '',
  category: 'instagram_follow',
  targetUrl: '',
  instructions: '',
  proofType: 'screenshot',
  proofInstructions: '',
  payoutPerTask: '0.01',
  totalBudget: '10',
  totalLimit: '1000',
  autoApprove: false,
  minLevel: '1',
  maxCompletionsPerUser: '1',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CampaignFormData>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await offersApi.list({ view: 'advertiser' });
      setCampaigns(data.data.campaigns || data.data.offers || []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await offersApi.create({
        title: form.title,
        description: form.description,
        category: form.category,
        targetUrl: form.targetUrl,
        instructions: form.instructions,
        proofType: form.proofType,
        proofInstructions: form.proofInstructions,
        payoutPerTask: parseFloat(form.payoutPerTask),
        totalBudget: parseFloat(form.totalBudget),
        totalLimit: parseInt(form.totalLimit),
        autoApprove: form.autoApprove,
        targeting: {
          minLevel: parseInt(form.minLevel),
          maxCompletionsPerUser: parseInt(form.maxCompletionsPerUser),
        },
      });
      setShowCreate(false);
      setForm(defaultForm);
      fetchCampaigns();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'active') {
        await offersApi.pause(id);
      } else if (currentStatus === 'paused') {
        await offersApi.update(id, { status: 'active' });
      }
      fetchCampaigns();
    } catch { /* ignore */ }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await offersApi.cancel(id);
      fetchCampaigns();
    } catch { /* ignore */ }
  };

  const setField = (field: keyof CampaignFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div>
      <Header title="Campaigns" />
      <div className="p-6 space-y-4 max-w-6xl">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        {/* Campaign list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-slate-700 rounded w-2/3" />
                </div>
                <div className="h-8 bg-slate-700 rounded-lg w-20" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 card">
            <div className="text-4xl mb-3">📣</div>
            <p className="text-lg font-medium text-white">No campaigns yet</p>
            <p className="text-sm text-slate-400 mt-1">Create your first campaign to get started</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 flex items-center gap-2 mx-auto">
              <PlusCircle className="w-4 h-4" />Create Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const progress = c.totalLimit > 0 ? (c.completionsCount / c.totalLimit) * 100 : 0;
              return (
                <div key={c._id} className="card p-5 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{c.title}</h3>
                        <Badge status={c.status} />
                      </div>
                      <p className="text-sm text-slate-400 mt-1 capitalize">
                        {c.category.replace(/_/g, ' ')} • ${c.payoutPerTask.toFixed(3)}/task
                      </p>
                      <div className="flex items-center gap-6 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {c.completionsCount}/{c.totalLimit}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${c.spentBudget.toFixed(2)} / ${c.totalBudget.toFixed(2)} spent
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden w-64">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(c.status === 'active' || c.status === 'paused') && (
                        <button
                          onClick={() => handlePause(c._id, c.status)}
                          className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"
                        >
                          {c.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {c.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      )}
                      {['draft', 'active', 'paused'].includes(c.status) && (
                        <button
                          onClick={() => handleCancel(c._id)}
                          className="btn-danger flex items-center gap-1.5 text-xs py-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Refresh button */}
        <div className="text-center">
          <button onClick={fetchCampaigns} className="btn-secondary flex items-center gap-2 mx-auto text-xs">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </button>
        </div>
      </div>

      {/* Create campaign modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Campaign" size="xl">
        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Campaign Title</label>
              <input className="input" placeholder="Follow our Instagram page" value={form.title}
                onChange={(e) => setField('title', e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="Describe what workers need to do..."
                value={form.description} onChange={(e) => setField('description', e.target.value)} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setField('category', e.target.value)}>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Proof Type</label>
              <select className="input" value={form.proofType} onChange={(e) => setField('proofType', e.target.value)}>
                {PROOF_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Target URL</label>
              <input className="input" type="url" placeholder="https://instagram.com/youraccount"
                value={form.targetUrl} onChange={(e) => setField('targetUrl', e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Instructions for Workers</label>
              <textarea className="input min-h-[80px] resize-none"
                placeholder="1. Visit the link&#10;2. Follow the account&#10;3. Take a screenshot..."
                value={form.instructions} onChange={(e) => setField('instructions', e.target.value)} required />
            </div>
            {form.proofType !== 'none' && (
              <div className="md:col-span-2">
                <label className="label">Proof Instructions <span className="text-slate-500">(optional)</span></label>
                <input className="input" placeholder="e.g. Screenshot must show your username and the follow button..."
                  value={form.proofInstructions} onChange={(e) => setField('proofInstructions', e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Payout Per Task ($)</label>
              <input className="input" type="number" step="0.001" min="0.001"
                value={form.payoutPerTask} onChange={(e) => setField('payoutPerTask', e.target.value)} required />
            </div>
            <div>
              <label className="label">Total Budget ($)</label>
              <input className="input" type="number" step="0.01" min="1"
                value={form.totalBudget} onChange={(e) => setField('totalBudget', e.target.value)} required />
            </div>
            <div>
              <label className="label">Max Completions</label>
              <input className="input" type="number" min="1"
                value={form.totalLimit} onChange={(e) => setField('totalLimit', e.target.value)} required />
            </div>
            <div>
              <label className="label">Per-user Limit</label>
              <input className="input" type="number" min="1"
                value={form.maxCompletionsPerUser} onChange={(e) => setField('maxCompletionsPerUser', e.target.value)} required />
            </div>
            <div>
              <label className="label">Min. Worker Level</label>
              <input className="input" type="number" min="1"
                value={form.minLevel} onChange={(e) => setField('minLevel', e.target.value)} required />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input id="autoApprove" type="checkbox" className="w-4 h-4 accent-brand-500"
                checked={form.autoApprove} onChange={(e) => setField('autoApprove', e.target.checked)} />
              <label htmlFor="autoApprove" className="text-sm text-slate-300">
                Auto-approve completions
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
