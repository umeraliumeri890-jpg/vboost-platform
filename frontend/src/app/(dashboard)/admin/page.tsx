'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { adminApi } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import {
  ShieldAlert, Users, CreditCard, DollarSign,
  CheckCircle, XCircle, RefreshCw, AlertTriangle,
  Loader2, Ban, UserCheck, Scale
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'payouts' | 'disputes' | 'users'>('payouts');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check role
  const isAdmin = user?.roles?.includes('admin');

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, payoutsRes, disputesRes, usersRes] = await Promise.all([
        adminApi.stats(),
        adminApi.payouts(),
        adminApi.disputes(),
        adminApi.users(),
      ]);
      setStats(statsRes.data.data);
      setPayouts(payoutsRes.data.data.payouts || []);
      setDisputes(disputesRes.data.data.disputes || []);
      setUsersList(usersRes.data.data.users || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (user && !isAdmin) {
      router.replace('/worker');
    } else if (isAdmin) {
      loadData();
    }
  }, [user, isAdmin, router, loadData]);

  const handlePayoutAction = async (id: string, action: 'approve' | 'reject') => {
    let reason = '';
    if (action === 'reject') {
      reason = prompt('Enter rejection reason (will be logged in ledger):') || '';
      if (!reason) return;
    }
    setActionLoading(id);
    try {
      await adminApi.handlePayout(id, action, reason);
      await loadData();
    } catch {
      alert('Failed to process payout.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisputeResolution = async (id: string, resolution: 'approve_worker' | 'reject_worker') => {
    setActionLoading(id);
    try {
      await adminApi.resolveDispute(id, resolution);
      await loadData();
    } catch {
      alert('Failed to resolve dispute.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    const reason = !currentBanned ? prompt('Enter reason for ban:') || 'Terms violation' : '';
    setActionLoading(userId);
    try {
      await adminApi.banUser(userId, !currentBanned, reason);
      await loadData();
    } catch {
      alert('Failed to toggle ban.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-slate-500">Access Restricted. Admins only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header title="Super Admin Control Center" />

      <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-blue-600" />
              Platform Administration
            </h1>
            <p className="text-xs text-slate-500">
              Live payouts queue, worker disputes arbitration, and financial monitoring.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="v-btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Total Platform Earnings (15%)</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {formatPrice(stats?.totalRevenue || 0)}
            </p>
          </div>

          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Pending Withdrawals</span>
            <p className="text-2xl font-black text-amber-500 mt-1">
              {stats?.pendingWithdrawals || 0}
            </p>
          </div>

          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Disputed Tasks</span>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {stats?.disputedCompletions || 0}
            </p>
          </div>

          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Registered Users</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {stats?.totalUsers || 0}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-sm font-semibold gap-6">
          <button
            onClick={() => setActiveTab('payouts')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'payouts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Withdrawals Queue ({payouts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'disputes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Disputes Arbitration ({disputes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Bans ({usersList.length})</span>
          </button>
        </div>

        {/* TAB 1: Payouts */}
        {activeTab === 'payouts' && (
          <div className="v-card overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Destination Details</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No withdrawal requests at this moment.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => {
                    const isPending = p.status === 'pending';
                    const isActing = actionLoading === p._id;
                    return (
                      <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {p.user?.username || 'Unknown'}
                        </td>
                        <td className="p-3.5 font-bold text-emerald-600">
                          {formatPrice(p.amount)}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {p.note || 'Direct Bank/Wallet'}
                        </td>
                        <td className="p-3.5">
                          <Badge status={p.status} />
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-1.5">
                              {isActing ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              ) : (
                                <>
                                  <button
                                    onClick={() => handlePayoutAction(p._id, 'approve')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                                  >
                                    Approve & Pay
                                  </button>
                                  <button
                                    onClick={() => handlePayoutAction(p._id, 'reject')}
                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Disputes */}
        {activeTab === 'disputes' && (
          <div className="space-y-3">
            {disputes.length === 0 ? (
              <div className="v-card p-12 text-center text-slate-400">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p>No active disputes. All worker tasks are peaceful!</p>
              </div>
            ) : (
              disputes.map((d) => (
                <div key={d._id} className="v-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {d.campaign?.title}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Worker: <strong className="text-slate-700 dark:text-slate-200">{d.worker?.username}</strong> • Payout: {formatPrice(d.payoutAmount)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDisputeResolution(d._id, 'approve_worker')}
                        className="v-btn-primary py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        Force Pay Worker
                      </button>
                      <button
                        onClick={() => handleDisputeResolution(d._id, 'reject_worker')}
                        className="v-btn-secondary py-1.5 px-3 text-xs text-red-600 hover:bg-red-50"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                    <p className="text-slate-500 font-semibold">Worker Complaint:</p>
                    <p className="text-slate-800 dark:text-slate-200">{d.dispute?.reason || 'Task was done properly.'}</p>
                    {d.proof?.screenshotUrl && (
                      <div className="pt-2">
                        <a
                          href={d.proof.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline font-medium"
                        >
                          View Uploaded Screenshot Proof ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: Users */}
        {activeTab === 'users' && (
          <div className="v-card overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Roles</th>
                  <th className="p-3.5">Balances (Main / Ad)</th>
                  <th className="p-3.5">XP / Level</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersList.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 dark:text-white">{u.username}</p>
                      <p className="text-slate-400 text-[10px]">{u.email}</p>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {u.roles?.join(', ')}
                    </td>
                    <td className="p-3.5 font-bold">
                      <span className="text-emerald-600">${u.balances?.main?.toFixed(2)}</span>
                      <span className="mx-1 text-slate-400">/</span>
                      <span className="text-blue-600">${u.balances?.ad?.toFixed(2)}</span>
                    </td>
                    <td className="p-3.5">
                      Level {u.gamification?.level} ({u.gamification?.xp} XP)
                    </td>
                    <td className="p-3.5">
                      {u.isBanned ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          Banned
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleToggleBan(u._id, u.isBanned)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                          u.isBanned
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {u.isBanned ? 'Unban' : 'Ban User'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
