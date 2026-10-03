'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { adminApi, settingsApi, auditApi, bannedIpApi } from '@/lib/api';
import { SystemSettings, AuditLogItem, BannedIp } from '@/types';
import Badge from '@/components/ui/Badge';
import {
  ShieldAlert, Users, CreditCard, RefreshCw,
  CheckCircle, Loader2, Search, ChevronLeft, ChevronRight,
  BarChart3, DollarSign, Scale, X, Sliders, FileText, Ban, Save, Power, ShieldCheck, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── User Detail Modal ──────────────────────────────────────────────────────
function UserDetailModal({
  userId, onClose, onAction, formatPrice
}: {
  userId: string;
  onClose: () => void;
  onAction: () => void;
  formatPrice: (v: number) => string;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceType, setBalanceType] = useState<'main' | 'ad'>('main');
  const [balanceNote, setBalanceNote] = useState('');
  const [roleInput, setRoleInput] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'social'>('overview');

  useEffect(() => {
    adminApi.userDetail(userId)
      .then((res) => {
        setDetail(res.data.data);
        setRoleInput(res.data.data.user.roles || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const doAction = async (label: string, fn: () => Promise<any>) => {
    setMsg('');
    setActionLoading(label);
    try {
      await fn();
      const res = await adminApi.userDetail(userId);
      setDetail(res.data.data);
      setMsg(`✅ ${label} applied.`);
      onAction();
    } catch (err: any) {
      setMsg(`❌ ${err.response?.data?.message || 'Action failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const u = detail?.user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl v-card p-0 animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {loading ? 'Loading...' : `👤 ${u?.username}`}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : !u ? (
            <p className="text-center text-slate-400">User not found.</p>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
                {(['overview', 'history', 'social'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`pb-2.5 border-b-2 capitalize transition-all ${
                      activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                    }`}
                  >{t}</button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="v-card p-3">
                      <p className="text-[10px] font-bold text-slate-400">MAIN BAL</p>
                      <p className="text-lg font-black text-emerald-600">{formatPrice(u.balances?.main || 0)}</p>
                    </div>
                    <div className="v-card p-3">
                      <p className="text-[10px] font-bold text-slate-400">AD BAL</p>
                      <p className="text-lg font-black text-blue-600">{formatPrice(u.balances?.ad || 0)}</p>
                    </div>
                    <div className="v-card p-3">
                      <p className="text-[10px] font-bold text-slate-400">TASKS</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{u.stats?.tasksCompleted || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-400">Email: </span><span className="font-semibold text-slate-800 dark:text-slate-200">{u.email}</span></div>
                    <div><span className="text-slate-400">Level: </span><span className="font-semibold">{u.gamification?.level} ({u.gamification?.xp} XP)</span></div>
                    <div><span className="text-slate-400">Roles: </span><span className="font-semibold">{u.roles?.join(', ')}</span></div>
                    <div><span className="text-slate-400">Status: </span>
                      <span className={`font-bold ${u.isBanned ? 'text-red-600' : 'text-emerald-600'}`}>
                        {u.isBanned ? 'Banned' : 'Active'}
                      </span>
                    </div>
                    <div><span className="text-slate-400">Reg IP: </span><span className="font-mono text-slate-700 dark:text-slate-300">{u.registrationIp || '—'}</span></div>
                    <div><span className="text-slate-400">Last IP: </span><span className="font-mono text-slate-700 dark:text-slate-300">{u.lastLoginIp || '—'}</span></div>
                    {u.deviceFingerprint && (
                      <div className="col-span-2"><span className="text-slate-400">Device Fingerprint: </span><span className="font-mono text-[10px] text-slate-500 break-all">{u.deviceFingerprint}</span></div>
                    )}
                  </div>

                  {/* Balance Adjust */}
                  <div className="v-card p-4 space-y-3">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">⚡ ADJUST BALANCE</h4>
                    <div className="flex gap-2">
                      <select value={balanceType} onChange={(e) => setBalanceType(e.target.value as any)} className="v-input text-xs py-1.5 flex-none w-24">
                        <option value="main">Main</option>
                        <option value="ad">Ad</option>
                      </select>
                      <input type="number" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} placeholder="+10 or -5" step={0.01} className="v-input text-xs flex-1" />
                    </div>
                    <input type="text" value={balanceNote} onChange={(e) => setBalanceNote(e.target.value)} placeholder="Note (optional)" className="v-input text-xs w-full" />
                    <button
                      disabled={actionLoading === 'balance'}
                      onClick={() => doAction('balance', () => adminApi.adjustBalance(u._id, parseFloat(balanceInput), balanceType, balanceNote))}
                      className="v-btn-primary text-xs py-1.5 w-full flex justify-center items-center gap-1.5"
                    >
                      {actionLoading === 'balance' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Apply Adjustment
                    </button>
                  </div>

                  {/* Role Change */}
                  <div className="v-card p-4 space-y-3">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">🎭 CHANGE ROLES</h4>
                    <div className="flex gap-2 flex-wrap">
                      {['worker', 'advertiser', 'admin'].map((r) => (
                        <button key={r} onClick={() => setRoleInput(prev => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${roleInput.includes(r) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-300'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <button disabled={actionLoading === 'role'} onClick={() => doAction('role', () => adminApi.changeRole(u._id, roleInput))}
                      className="v-btn-secondary text-xs py-1.5 w-full flex justify-center items-center gap-1.5">
                      {actionLoading === 'role' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Update Roles
                    </button>
                  </div>

                  {msg && <p className="text-xs text-center font-semibold text-slate-600 dark:text-slate-300">{msg}</p>}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500">RECENT COMPLETIONS ({detail.completions?.length})</h4>
                  {detail.completions?.length === 0 ? (
                    <p className="text-xs text-slate-400">No completions yet.</p>
                  ) : detail.completions?.slice(0, 10).map((c: any) => (
                    <div key={c._id} className="flex items-center justify-between text-xs p-2.5 v-card">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">{c.campaign?.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge status={c.status} />
                        <span className="font-bold text-emerald-600">{formatPrice(c.payoutAmount * 0.75)}</span>
                      </div>
                    </div>
                  ))}
                  <h4 className="text-xs font-bold text-slate-500 mt-3">DEPOSIT HISTORY</h4>
                  {detail.deposits?.slice(0, 5).map((d: any) => (
                    <div key={d._id} className="flex items-center justify-between text-xs p-2.5 v-card">
                      <span className="text-slate-600 dark:text-slate-300">{d.note || 'Deposit'}</span>
                      <span className="font-bold text-emerald-600">{formatPrice(d.amount)}</span>
                    </div>
                  ))}
                  <h4 className="text-xs font-bold text-slate-500 mt-3">WITHDRAWAL HISTORY</h4>
                  {detail.withdrawals?.slice(0, 5).map((w: any) => (
                    <div key={w._id} className="flex items-center justify-between text-xs p-2.5 v-card">
                      <span className="text-slate-600 dark:text-slate-300">{w.note || 'Withdrawal'}</span>
                      <div className="flex items-center gap-2">
                        <Badge status={w.status} />
                        <span className="font-bold text-red-600">-{formatPrice(w.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'social' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500">LINKED SOCIAL ACCOUNTS</h4>
                  {['instagram', 'tiktok', 'youtube', 'twitter', 'telegram', 'vk', 'facebook', 'threads'].map((p) => (
                    <div key={p} className="flex items-center justify-between text-xs p-3 v-card">
                      <div>
                        <span className="font-bold capitalize text-slate-700 dark:text-slate-300">{p}: </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {u.socialAccounts?.[p] ? `@${u.socialAccounts[p]}` : <span className="italic text-slate-400">Not linked</span>}
                        </span>
                      </div>
                      {u.socialAccounts?.[p] && (
                        <button onClick={() => doAction(`unlink-${p}`, () => adminApi.adminSocialLink(u._id, p, null))} className="text-red-500 hover:text-red-700 font-bold text-xs">
                          Unlink
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'payouts' | 'deposits' | 'disputes' | 'users' | 'settings' | 'audit' | 'bannedIps' | 'analytics'>('payouts');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  // Banned IPs State
  const [bannedIps, setBannedIps] = useState<BannedIp[]>([]);
  const [newIp, setNewIp] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const [banningIp, setBanningIp] = useState(false);

  const isAdmin = Boolean(user?.role === 'admin' || user?.roles?.includes('admin'));

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, payoutsRes, disputesRes, analyticsRes, paymentsRes, settingsRes, bannedRes, auditRes] = await Promise.allSettled([
        adminApi.stats(),
        adminApi.payouts(),
        adminApi.disputes(),
        adminApi.analytics(),
        adminApi.payments({ status: 'pending' }),
        settingsApi.get(),
        bannedIpApi.list(),
        auditApi.list({ page: 1 }),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data);
      if (payoutsRes.status === 'fulfilled') setPayouts(payoutsRes.value.data.data.payouts || []);
      if (disputesRes.status === 'fulfilled') setDisputes(disputesRes.value.data.data.disputes || []);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data.data);
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value.data.data.requests || []);
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data.data.settings || null);
      if (bannedRes.status === 'fulfilled') setBannedIps(bannedRes.value.data.data.bannedIps || []);
      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value.data.data.logs || []);
        setAuditTotalPages(auditRes.value.data.data.pagination?.pages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadAuditLogs = useCallback(async (p: number) => {
    if (!isAdmin) return;
    setAuditLoading(true);
    try {
      const res = await auditApi.list({ page: p });
      setAuditLogs(res.data.data.logs || []);
      setAuditTotalPages(res.data.data.pagination?.pages || 1);
      setAuditPage(p);
    } catch {}
    finally { setAuditLoading(false); }
  }, [isAdmin]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await adminApi.users(userPage, userSearch || undefined);
      setUsersList(res.data.data.users || []);
      setUserTotalPages(res.data.data.pagination?.pages || 1);
    } catch { /* ignore */ }
  }, [isAdmin, userPage, userSearch]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (!isAdmin) {
      router.replace('/worker');
    } else {
      loadData();
      loadUsers();
    }
  }, [user, authLoading, isAdmin, router, loadData, loadUsers]);

  useEffect(() => {
    if (!authLoading && isAdmin) loadUsers();
  }, [userPage, userSearch, loadUsers, isAdmin, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500 font-semibold">Access Restricted. Admins only.</p>
      </div>
    );
  }

  const handlePayoutAction = async (id: string, action: 'approve' | 'reject') => {
    let reason = '';
    if (action === 'reject') { reason = prompt('Rejection reason:') || ''; if (!reason) return; }
    setActionLoading(id);
    try { await adminApi.handlePayout(id, action, reason); await loadData(); }
    catch { alert('Failed.'); } finally { setActionLoading(null); }
  };

  const handleDisputeResolution = async (id: string, resolution: 'approve_worker' | 'reject_worker') => {
    setActionLoading(id);
    try { await adminApi.resolveDispute(id, resolution); await loadData(); }
    catch { alert('Failed.'); } finally { setActionLoading(null); }
  };

  const handleToggleBan = async (uid: string, banned: boolean) => {
    const reason = !banned ? prompt('Ban reason:') || 'Terms violation' : '';
    setActionLoading(uid);
    try { await adminApi.banUser(uid, !banned, reason); await loadUsers(); }
    catch { alert('Failed.'); } finally { setActionLoading(null); }
  };

  const handlePaymentAction = async (id: string, action: 'approve' | 'reject') => {
    let adminNote = '';
    if (action === 'reject') {
      adminNote = prompt('Enter rejection reason:') || '';
      if (!adminNote) return;
    }
    setActionLoading(id);
    try {
      if (action === 'approve') {
        const res = await adminApi.approveDeposit(id);
        alert(res?.data?.message || 'Deposit approved! User balance updated.');
      } else {
        const res = await adminApi.rejectDeposit(id, adminNote);
        alert(res?.data?.message || 'Deposit rejected. User balance remains unchanged.');
      }
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const res = await settingsApi.update(settings);
      setSettings(res.data.data.settings);
      setSettingsMsg('✅ Settings updated successfully and applied across platform.');
    } catch (err: any) {
      setSettingsMsg(`❌ ${err.response?.data?.message || 'Failed to update settings'}`);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) return;
    setBanningIp(true);
    try {
      await bannedIpApi.ban({ ip: newIp.trim(), reason: newIpReason.trim() || undefined });
      setNewIp('');
      setNewIpReason('');
      const res = await bannedIpApi.list();
      setBannedIps(res.data.data.bannedIps || []);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to ban IP');
    } finally {
      setBanningIp(false);
    }
  };

  const handleUnbanIp = async (ip: string) => {
    if (!confirm(`Unban IP ${ip}?`)) return;
    try {
      await bannedIpApi.unban(ip);
      const res = await bannedIpApi.list();
      setBannedIps(res.data.data.bannedIps || []);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unban IP');
    }
  };

  const TABS = [
    { id: 'payouts',   label: 'Withdrawals',     Icon: CreditCard,  count: payouts.length },
    { id: 'deposits',  label: 'Deposits Queue',  Icon: DollarSign,  count: payments.length },
    { id: 'disputes',  label: 'Disputes',         Icon: Scale,       count: disputes.length },
    { id: 'users',     label: 'Users',            Icon: Users,       count: stats?.totalUsers || 0 },
    { id: 'settings',  label: 'System Settings',  Icon: Sliders,     count: null },
    { id: 'audit',     label: 'Audit Logs',       Icon: FileText,    count: null },
    { id: 'bannedIps', label: 'Banned IPs',       Icon: Ban,         count: bannedIps.length },
    { id: 'analytics', label: 'Analytics',        Icon: BarChart3,   count: null },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header title="Admin" />

      <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-blue-600" /> Platform Administration
            </h1>
            <p className="text-xs text-slate-500">Payouts · Deposits · Disputes · Users · Analytics</p>
          </div>
          <button onClick={() => { loadData(); loadUsers(); }} disabled={loading} className="v-btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Platform Revenue (25%)</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{formatPrice(analytics?.totalPlatformRevenue || 0)}</p>
          </div>
          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Worker Payouts (75%)</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{formatPrice(analytics?.totalWorkerPayouts || 0)}</p>
          </div>
          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Pending Payments</span>
            <p className="text-2xl font-black text-amber-500 mt-1">{(stats?.pendingWithdrawals || 0) + payments.length}</p>
          </div>
          <div className="v-card p-4">
            <span className="text-xs font-semibold text-slate-400">Registered Users</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats?.totalUsers || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-sm font-semibold gap-1 overflow-x-auto">
          {TABS.map(({ id, label, Icon, count }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 px-3 whitespace-nowrap ${
                activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}{count !== null ? ` (${count})` : ''}
            </button>
          ))}
        </div>

        {/* Withdrawals */}
        {activeTab === 'payouts' && (
          <div className="v-card overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3.5">User</th><th className="p-3.5">Amount</th>
                  <th className="p-3.5">Destination</th><th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th><th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payouts.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">No withdrawal requests.</td></tr>
                ) : payouts.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 font-bold">{p.user?.username || '—'}</td>
                    <td className="p-3.5 font-bold text-emerald-600">{formatPrice(p.amount)}</td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">{p.note || '—'}</td>
                    <td className="p-3.5"><Badge status={p.status} /></td>
                    <td className="p-3.5 text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="p-3.5 text-right">
                      {p.status === 'pending' && (
                        actionLoading === p._id ? <Loader2 className="w-4 h-4 animate-spin ml-auto" /> : (
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => handlePayoutAction(p._id, 'approve')} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700">Approve</button>
                            <button onClick={() => handlePayoutAction(p._id, 'reject')} className="px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">Reject</button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Deposits */}
        {activeTab === 'deposits' && (
          <div className="v-card overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3.5">User</th><th className="p-3.5">Type</th><th className="p-3.5">Amount</th>
                  <th className="p-3.5">Method</th><th className="p-3.5">TXID / Address</th>
                  <th className="p-3.5">Status</th><th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">No pending deposit requests.</td></tr>
                ) : payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 font-bold">{p.user?.username || '—'}</td>
                    <td className="p-3.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{p.type}</span></td>
                    <td className="p-3.5 font-bold">{formatPrice(p.amount)}</td>
                    <td className="p-3.5 text-slate-600">{p.paymentMethod}</td>
                    <td className="p-3.5 font-mono text-[10px] text-slate-400 max-w-[120px] truncate">{p.txid || p.destinationAddress || '—'}</td>
                    <td className="p-3.5"><Badge status={p.status} /></td>
                    <td className="p-3.5 text-right">
                      {p.status === 'pending' && (
                        actionLoading === p._id ? <Loader2 className="w-4 h-4 animate-spin ml-auto" /> : (
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => handlePaymentAction(p._id, 'approve')} className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 whitespace-nowrap">Approve Request</button>
                            <button onClick={() => handlePaymentAction(p._id, 'reject')} className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 whitespace-nowrap">Reject Request</button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Disputes */}
        {activeTab === 'disputes' && (
          <div className="space-y-3">
            {disputes.length === 0 ? (
              <div className="v-card p-12 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-slate-400">No active disputes!</p>
              </div>
            ) : disputes.map((d) => (
              <div key={d._id} className="v-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{d.campaign?.title}</h4>
                    <p className="text-xs text-slate-400">Worker: <strong>{d.worker?.username}</strong> • {formatPrice(d.payoutAmount * 0.75)} net</p>
                  </div>
                  <div className="flex gap-2">
                    {actionLoading === d._id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <button onClick={() => handleDisputeResolution(d._id, 'approve_worker')} className="v-btn-primary py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700">Force Pay</button>
                        <button onClick={() => handleDisputeResolution(d._id, 'reject_worker')} className="v-btn-secondary py-1.5 px-3 text-xs text-red-600">Reject</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
                  <p className="font-semibold text-slate-500">Complaint:</p>
                  <p className="text-slate-700 dark:text-slate-200 mt-1">{d.dispute?.reason || '—'}</p>
                  {d.proof?.screenshotUrl && (
                    <a href={d.proof.screenshotUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs mt-2 block">View Proof ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                placeholder="Search by username, email, or IP address..." className="v-input pl-9 w-full text-sm" />
            </div>

            <div className="v-card overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-3.5">User</th><th className="p-3.5">Roles</th>
                    <th className="p-3.5">Balances</th><th className="p-3.5">Level/XP</th>
                    <th className="p-3.5">Status</th><th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usersList.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900 dark:text-white">{u.username}</p>
                        <p className="text-slate-400 text-[10px]">{u.email}</p>
                        {(u.lastLoginIp || u.registrationIp) && (
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            IP: {u.lastLoginIp || u.registrationIp}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">{u.roles?.join(', ')}</td>
                      <td className="p-3.5 font-bold">
                        <span className="text-emerald-600">{formatPrice(u.balances?.main || 0)}</span>
                        <span className="mx-1 text-slate-400">/</span>
                        <span className="text-blue-600">{formatPrice(u.balances?.ad || 0)}</span>
                      </td>
                      <td className="p-3.5">L{u.gamification?.level} ({u.gamification?.xp} XP)</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isBanned ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {u.isBanned ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setSelectedUserId(u._id)} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 text-[10px]">View</button>
                          {actionLoading === u._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                            <button onClick={() => handleToggleBan(u._id, u.isBanned)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${u.isBanned ? 'bg-slate-200 dark:bg-slate-700 text-slate-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {userTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={userPage === 1} className="v-btn-secondary p-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-semibold text-slate-600">Page {userPage} / {userTotalPages}</span>
                <button onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))} disabled={userPage === userTotalPages} className="v-btn-secondary p-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        )}

        {/* System Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="v-card p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-blue-600" /> Platform Configuration & Monetization
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control global fees, timer limits, automation switches, and maintenance status</p>
                </div>
              </div>

              {settingsMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold mb-4 ${settingsMsg.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                  {settingsMsg}
                </div>
              )}

              {settings ? (
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* Financial & Commission Rates */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">💰 Financial & Fee Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Platform Admin Cut (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={settings.platformFeePercent}
                          onChange={(e) => setSettings({ ...settings, platformFeePercent: parseFloat(e.target.value) || 0 })}
                          className="v-input text-sm w-full"
                          required
                        />
                        <span className="text-[10px] text-slate-400">Worker automatically gets (100 - Cut) = {100 - (settings.platformFeePercent || 0)}%</span>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Referral Commission (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={settings.referralCommissionPercent}
                          onChange={(e) => setSettings({ ...settings, referralCommissionPercent: parseFloat(e.target.value) || 0 })}
                          className="v-input text-sm w-full"
                          required
                        />
                        <span className="text-[10px] text-slate-400">Awarded automatically to referrer on earnings & deposits</span>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Min. Deposit ($)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.01"
                          value={settings.minDeposit}
                          onChange={(e) => setSettings({ ...settings, minDeposit: parseFloat(e.target.value) || 1 })}
                          className="v-input text-sm w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Min. Withdrawal ($)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.01"
                          value={settings.minWithdrawal}
                          onChange={(e) => setSettings({ ...settings, minWithdrawal: parseFloat(e.target.value) || 1 })}
                          className="v-input text-sm w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Auto-Approve Threshold (Hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={settings.autoApproveHours}
                          onChange={(e) => setSettings({ ...settings, autoApproveHours: parseInt(e.target.value) || 48 })}
                          className="v-input text-sm w-full"
                          required
                        />
                        <span className="text-[10px] text-slate-400">Pending proofs older than this are approved automatically</span>
                      </div>
                    </div>
                  </div>

                  {/* Automation & Security Toggles */}
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">🛡️ Auto-Pilot & Anti-Cheat Toggles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Auto-Approve Cron</p>
                          <p className="text-[10px] text-slate-500">Hourly automated approval sweep</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.autoApproveEnabled}
                          onChange={(e) => setSettings({ ...settings, autoApproveEnabled: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Anti-Cheat Task Guard</p>
                          <p className="text-[10px] text-slate-500">Block duplicate IP/fingerprint per task</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.antiCheatEnabled}
                          onChange={(e) => setSettings({ ...settings, antiCheatEnabled: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Maintenance Mode</p>
                          <p className="text-[10px] text-slate-500">Block non-admin traffic with 503</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.maintenanceMode}
                          onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                          className="w-4 h-4 text-red-600 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Webhook Credentials */}
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">⚡ Crypto Auto-Deposit Webhooks (NOWPayments / CoinPayments)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          NOWPayments API Key
                        </label>
                        <input
                          type="password"
                          value={settings.nowPaymentsApiKey || ''}
                          onChange={(e) => setSettings({ ...settings, nowPaymentsApiKey: e.target.value })}
                          placeholder="Configured via env or set here"
                          className="v-input text-xs w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          NOWPayments IPN Secret
                        </label>
                        <input
                          type="password"
                          value={settings.nowPaymentsIpnSecret || ''}
                          onChange={(e) => setSettings({ ...settings, nowPaymentsIpnSecret: e.target.value })}
                          placeholder="Used to verify HMAC-SHA512 callbacks"
                          className="v-input text-xs w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="v-btn-primary py-2 px-6 flex items-center gap-2 text-xs font-bold"
                    >
                      {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Configuration
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" /> System Audit Trail
                </h3>
                <p className="text-xs text-slate-500">Immutable ledger of administrative actions, balance adjustments, bans, and automation sweeps</p>
              </div>
              <button
                onClick={() => loadAuditLogs(auditPage)}
                disabled={auditLoading}
                className="v-btn-secondary text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            <div className="v-card overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Performed By</th>
                    <th className="p-3.5">Target</th>
                    <th className="p-3.5">IP Address</th>
                    <th className="p-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">No audit logs recorded yet.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3.5 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-bold font-mono">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                          {log.performedBy?.username || 'System Automation'}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          {log.targetUser?.username || '—'}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-400">
                          {log.ip || '—'}
                        </td>
                        <td className="p-3.5 text-slate-500 max-w-xs truncate font-mono text-[10px]">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {auditTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => loadAuditLogs(Math.max(1, auditPage - 1))}
                  disabled={auditPage === 1}
                  className="v-btn-secondary p-2 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-600">Page {auditPage} / {auditTotalPages}</span>
                <button
                  onClick={() => loadAuditLogs(Math.min(auditTotalPages, auditPage + 1))}
                  disabled={auditPage === auditTotalPages}
                  className="v-btn-secondary p-2 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Banned IPs */}
        {activeTab === 'bannedIps' && (
          <div className="space-y-6">
            {/* Add IP Block Form */}
            <div className="v-card p-5">
              <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-3">
                <Ban className="w-4 h-4 text-red-600" /> Block IP Address
              </h3>
              <form onSubmit={handleBanIp} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.100"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="v-input text-xs font-mono flex-1"
                  required
                />
                <input
                  type="text"
                  placeholder="Reason (e.g. Multiple fake accounts / bot network)"
                  value={newIpReason}
                  onChange={(e) => setNewIpReason(e.target.value)}
                  className="v-input text-xs flex-1"
                />
                <button
                  type="submit"
                  disabled={banningIp}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
                >
                  {banningIp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  Block IP
                </button>
              </form>
            </div>

            {/* Banned IPs List */}
            <div className="v-card overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  Active IP Blacklist ({bannedIps.length})
                </h3>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-3.5">IP Address</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5">Banned By</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bannedIps.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No IP addresses are currently blacklisted.
                      </td>
                    </tr>
                  ) : (
                    bannedIps.map((b) => (
                      <tr key={b._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3.5 font-bold font-mono text-red-600 dark:text-red-400">
                          {b.ip}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          {b.reason}
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {b.bannedBy?.username || 'Admin'}
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleUnbanIp(b.ip)}
                            className="px-2.5 py-1 rounded-lg font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 hover:text-emerald-700"
                          >
                            Unban
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Tasks Paid', value: analytics?.totalTasksPaid || 0, format: false, color: 'text-slate-900 dark:text-white' },
                { label: 'Worker Payouts (75%)', value: analytics?.totalWorkerPayouts || 0, format: true, color: 'text-blue-600' },
                { label: 'Platform Revenue (25%)', value: analytics?.totalPlatformRevenue || 0, format: true, color: 'text-emerald-600' },
                { label: 'Total Deposits', value: analytics?.totalDeposits || 0, format: true, color: 'text-purple-600' },
                { label: 'Total Withdrawals', value: analytics?.totalWithdrawals || 0, format: true, color: 'text-orange-600' },
                { label: 'Commission Rate', value: analytics?.platformProfitMargin || '25%', format: false, color: 'text-slate-700 dark:text-slate-300' },
              ].map(({ label, value, format, color }) => (
                <div key={label} className="v-card p-4">
                  <span className="text-xs font-semibold text-slate-400">{label}</span>
                  <p className={`text-2xl font-black mt-1 ${color}`}>{format ? formatPrice(value as number) : value}</p>
                </div>
              ))}
            </div>

            <div className="v-card overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">🏆 Top Workers by Earnings</h3>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase">
                  <tr><th className="p-3">#</th><th className="p-3">Username</th><th className="p-3">Tasks</th><th className="p-3">Earned</th><th className="p-3">Level</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(analytics?.topWorkers || []).map((w: any, i: number) => (
                    <tr key={w._id}>
                      <td className="p-3 font-bold text-slate-400">#{i + 1}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{w.username}</td>
                      <td className="p-3">{w.stats?.tasksCompleted || 0}</td>
                      <td className="p-3 text-emerald-600 font-bold">{formatPrice(w.stats?.totalEarned || 0)}</td>
                      <td className="p-3">L{w.gamification?.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="v-card overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">📊 Campaign Category Breakdown</h3>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase">
                  <tr><th className="p-3">Category</th><th className="p-3">Campaigns</th><th className="p-3">Total Budget</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(analytics?.categoryBreakdown || []).map((c: any) => (
                    <tr key={c._id}>
                      <td className="p-3 font-mono capitalize">{c._id?.replace(/_/g, ' ')}</td>
                      <td className="p-3 font-bold">{c.campaigns}</td>
                      <td className="p-3 text-blue-600 font-bold">{formatPrice(c.totalBudget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onAction={loadUsers}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}
