'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { dashboardApi } from '@/lib/api';
import { Megaphone, DollarSign, CheckCircle, TrendingUp, PlusCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import TopUpModal from '@/components/ui/TopUpModal';

export default function AdvertiserDashboard() {
  const { user, refreshUser } = useAuth();
  const { formatPrice } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: res } = await dashboardApi.summary();
        setData(res.data);
        refreshUser();
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshUser]);

  const stats = [
    {
      label: 'Campaigns Created',
      value: data?.campaignsCreated ?? user?.stats.campaignsCreated ?? 0,
      icon: Megaphone,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: 'Total Spent',
      value: formatPrice(data?.totalSpent ?? user?.stats.totalSpent ?? 0),
      icon: DollarSign,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      label: 'Completions Received',
      value: data?.completionsReceived ?? 0,
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: 'Ad Balance Available',
      value: formatPrice(user?.balances.ad ?? 0),
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      action: () => setIsTopUpOpen(true),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* CTA banner */}
        <div className="v-card p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between gap-4 flex-wrap shadow-md shadow-blue-500/20">
          <div>
            <h2 className="text-xl md:text-2xl font-black">Promote your Social Media & Tasks 🚀</h2>
            <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-lg leading-relaxed">
              Launch targeted campaigns for VK, Instagram, YouTube, TikTok, Telegram and get real active users.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTopUpOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors backdrop-blur-sm"
            >
              Top Up Balance
            </button>
            <Link
              href="/advertiser/campaigns"
              className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold text-xs hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Create Campaign
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg, action }) => (
            <div
              key={label}
              onClick={action}
              className={`v-card p-5 ${action ? 'cursor-pointer hover:border-blue-400' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                {loading ? '—' : value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/advertiser/campaigns"
            className="v-card p-5 flex items-center justify-between group hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center text-blue-600">
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">Campaigns Manager</p>
                <p className="text-xs text-slate-500 mt-0.5">Create, pause, edit and monitor live campaigns</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-all" />
          </Link>

          <Link
            href="/advertiser/analytics"
            className="v-card p-5 flex items-center justify-between group hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">Review Submissions</p>
                <p className="text-xs text-slate-500 mt-0.5">Review worker proofs, approve or reject submissions</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-600 transition-all" />
          </Link>
        </div>
      </div>

      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => {
          refreshUser();
          setIsTopUpOpen(false);
        }}
      />
    </div>
  );
}
