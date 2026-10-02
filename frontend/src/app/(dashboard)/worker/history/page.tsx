'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Badge from '@/components/ui/Badge';
import { completionsApi } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { Completion, Campaign } from '@/types';
import { RefreshCw, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

type StatusFilter = 'all' | 'pending_review' | 'approved' | 'auto_approved' | 'rejected' | 'disputed';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'auto_approved', label: 'Auto-approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'disputed', label: 'Disputed' },
];

export default function HistoryPage() {
  const { formatPrice } = useCurrency();
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchHistory = useCallback(async (s: StatusFilter, p: number) => {
    setLoading(true);
    try {
      const params: { view: string; page: number; status?: string } = { view: 'worker', page: p };
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
    fetchHistory(status, 1);
  }, [status, fetchHistory]);

  const handleDispute = async () => {
    if (!disputeId || !disputeReason.trim()) return;
    setSubmitting(true);
    try {
      await completionsApi.dispute(disputeId, disputeReason);
      setDisputeId(null);
      setDisputeReason('');
      fetchHistory(status, 1);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const getCampaignTitle = (completion: Completion) => {
    if (typeof completion.campaign === 'string') return 'Task';
    return (completion.campaign as Campaign).title;
  };

  return (
    <div>
      <Header title="My History" />
      <div className="p-6 space-y-4 max-w-5xl">
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">Payout</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">XP</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && completions.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-3 bg-slate-700 rounded w-32" /></td>
                      <td className="px-4 py-4"><div className="h-5 bg-slate-700 rounded-full w-20" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-700 rounded w-16 ml-auto" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-700 rounded w-10 ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-3 bg-slate-700 rounded w-24" /></td>
                      <td className="px-4 py-4" />
                    </tr>
                  ))
                ) : completions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No submissions found
                    </td>
                  </tr>
                ) : (
                  completions.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-medium text-white text-sm">{getCampaignTitle(c)}</p>
                        {c.rejectionReason && (
                          <p className="text-xs text-red-400 mt-0.5">{c.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-4"><Badge status={c.status} /></td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(c.payoutAmount)}
                      </td>
                      <td className="px-4 py-4 text-right text-yellow-400 text-xs font-medium">
                        +{c.xpAwarded} XP
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        {c.status === 'rejected' && (
                          <button
                            onClick={() => setDisputeId(c._id)}
                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />Dispute
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
                onClick={() => { const next = page + 1; setPage(next); fetchHistory(status, next); }}
                className="btn-secondary text-xs flex items-center gap-2 mx-auto"
                disabled={loading}
              >
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                Load more
              </button>
            </div>
          )}
        </div>

        {/* Dispute modal */}
        {disputeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDisputeId(null)} />
            <div className="relative card p-6 w-full max-w-md animate-slide-up">
              <h3 className="text-lg font-semibold text-white mb-4">File a Dispute</h3>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Explain why this rejection was incorrect..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setDisputeId(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleDispute} disabled={!disputeReason.trim() || submitting}
                  className="btn-primary flex-1">
                  {submitting ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
