'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Badge from '@/components/ui/Badge';
import { completionsApi } from '@/lib/api';
import { Completion, Campaign } from '@/types';
import { CheckCircle, XCircle, RefreshCw, Eye, X } from 'lucide-react';
import clsx from 'clsx';

type StatusFilter = 'all' | 'pending_review' | 'approved' | 'rejected' | 'disputed';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'disputed', label: 'Disputed' },
];

export default function AnalyticsPage() {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('pending_review');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reviewing, setReviewing] = useState<Completion | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCompletions = useCallback(async (s: StatusFilter, p: number) => {
    setLoading(true);
    try {
      const params: { view: string; page: number; status?: string } = { view: 'advertiser', page: p };
      if (s !== 'all') params.status = s;
      const { data } = await completionsApi.list(params);
      const items: Completion[] = data.data.completions || [];
      setCompletions(p === 1 ? items : (prev) => [...prev, ...items]);
      setHasMore(data.data.hasMore || false);
    } catch {
      setCompletions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchCompletions(status, 1);
  }, [status, fetchCompletions]);

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!reviewing) return;
    setSubmitting(true);
    try {
      await completionsApi.review(reviewing._id, action, action === 'reject' ? rejectReason : undefined);
      setReviewing(null);
      setRejectReason('');
      fetchCompletions(status, 1);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const getWorkerName = (c: Completion) => {
    if (typeof c.worker === 'string') return 'Worker';
    return (c.worker as { username: string }).username;
  };

  const getCampaignTitle = (c: Completion) => {
    if (typeof c.campaign === 'string') return 'Campaign';
    return (c.campaign as Campaign).title;
  };

  return (
    <div>
      <Header title="Analytics & Reviews" />
      <div className="p-6 space-y-4 max-w-6xl">
        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatus(id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
                status === id ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Worker</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Proof</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">Payout</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && completions.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-3 bg-slate-700 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : completions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No submissions found
                    </td>
                  </tr>
                ) : (
                  completions.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4 font-medium text-white">{getWorkerName(c)}</td>
                      <td className="px-4 py-4 text-slate-300 max-w-[180px] truncate">{getCampaignTitle(c)}</td>
                      <td className="px-4 py-4">
                        {c.proof.screenshotUrl ? (
                          <a href={c.proof.screenshotUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                            <Eye className="w-3.5 h-3.5" />View
                          </a>
                        ) : c.proof.textContent ? (
                          <span className="text-xs text-slate-400 truncate max-w-[120px] block">{c.proof.textContent}</span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4"><Badge status={c.status} /></td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-400">
                        ${c.payoutAmount.toFixed(3)}
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        {c.status === 'pending_review' && (
                          <button
                            onClick={() => setReviewing(c)}
                            className="btn-secondary text-xs py-1 px-3"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="px-4 py-3 border-t border-slate-800 text-center">
              <button
                onClick={() => { const next = page + 1; setPage(next); fetchCompletions(status, next); }}
                className="btn-secondary text-xs flex items-center gap-2 mx-auto"
                disabled={loading}
              >
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                Load more
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewing(null)} />
          <div className="relative card p-6 w-full max-w-lg animate-slide-up space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Review Submission</h3>
              <button onClick={() => setReviewing(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="label">Worker</p>
                <p className="text-white">{getWorkerName(reviewing)}</p>
              </div>
              <div>
                <p className="label">Campaign</p>
                <p className="text-white">{getCampaignTitle(reviewing)}</p>
              </div>
              {reviewing.proof.screenshotUrl && (
                <div>
                  <p className="label">Screenshot</p>
                  <img src={reviewing.proof.screenshotUrl} alt="proof" className="w-full rounded-lg border border-slate-700 max-h-48 object-contain bg-slate-800" />
                </div>
              )}
              {reviewing.proof.textContent && (
                <div>
                  <p className="label">Text Proof</p>
                  <p className="text-sm text-slate-300 bg-slate-800 p-3 rounded-lg">{reviewing.proof.textContent}</p>
                </div>
              )}
              <div>
                <p className="label">Rejection Reason <span className="text-slate-500">(if rejecting)</span></p>
                <input className="input" placeholder="e.g. Screenshot does not show follow action..."
                  value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReview('reject')}
                disabled={submitting}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />Reject
              </button>
              <button
                onClick={() => handleReview('approve')}
                disabled={submitting}
                className="btn-success flex-1 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
