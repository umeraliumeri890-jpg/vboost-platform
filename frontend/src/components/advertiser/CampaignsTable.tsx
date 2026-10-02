// src/components/advertiser/CampaignsTable.tsx
'use client';
import { useState } from 'react';
import { Campaign } from '@/types';
import Badge from '@/components/ui/Badge';
import { Eye, Pause, Play, Trash2, Loader2 } from 'lucide-react';
import { offersApi } from '@/lib/api';

interface CampaignsTableProps {
  campaigns: Campaign[];
  onReviewClick: (campaign: Campaign) => void;
  onRefresh: () => void;
}

export default function CampaignsTable({ campaigns, onReviewClick, onRefresh }: CampaignsTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePause = async (campaign: Campaign) => {
    setLoadingId(campaign._id);
    try { await offersApi.pause(campaign._id); onRefresh(); } catch { /* ignore */ }
    finally { setLoadingId(null); }
  };

  const handleCancel = async (campaign: Campaign) => {
    if (!confirm(`Cancel "${campaign.title}"? Remaining budget will be refunded to your Ad Balance.`)) return;
    setLoadingId(campaign._id);
    try { await offersApi.cancel(campaign._id); onRefresh(); } catch { /* ignore */ }
    finally { setLoadingId(null); }
  };

  if (campaigns.length === 0) {
    return (
      <div className="card p-14 text-center">
        <p className="text-5xl mb-3">📢</p>
        <p className="text-white font-semibold mb-1">No campaigns yet</p>
        <p className="text-slate-400 text-sm">Create your first campaign to start getting workers.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800">
              {['Campaign', 'Category', 'Progress', 'Payout', 'Budget', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {campaigns.map((c) => {
              const progress = c.totalLimit > 0 ? (c.completionsCount / c.totalLimit) * 100 : 0;
              const isLoading = loadingId === c._id;
              return (
                <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-white truncate max-w-[180px]">{c.title}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[180px] mt-0.5">{c.targetUrl}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-300 capitalize">{c.category.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3.5 min-w-[140px]">
                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-400">{c.completionsCount} / {c.totalLimit}</span>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden w-28">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{Math.round(progress)}% filled</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-emerald-400 font-semibold">${c.payoutPerTask.toFixed(3)}</span>
                    <p className="text-xs text-slate-500 mt-0.5">per task</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-white">${c.spentBudget.toFixed(2)} <span className="text-slate-500 text-xs">spent</span></p>
                    <p className="text-xs text-slate-500">${c.totalBudget.toFixed(2)} total</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge status={c.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                      ) : (
                        <>
                          <button
                            onClick={() => onReviewClick(c)}
                            title="Review Proofs"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-900/30 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {['active', 'paused'].includes(c.status) && (
                            <button
                              onClick={() => handlePause(c)}
                              title={c.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-yellow-900/30 transition-all"
                            >
                              {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                          {!['completed', 'cancelled'].includes(c.status) && (
                            <button
                              onClick={() => handleCancel(c)}
                              title="Cancel & Refund"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/30 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
