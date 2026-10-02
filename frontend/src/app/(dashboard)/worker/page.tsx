'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { dashboardApi } from '@/lib/api';
import {
  Copy, Check, Flame, ChevronRight, Download, Puzzle,
  ArrowRight, ExternalLink, Sparkles, CheckCircle2,
  Globe, Smartphone, CheckSquare
} from 'lucide-react';
import WithdrawModal from '@/components/ui/WithdrawModal';
import TopUpModal from '@/components/ui/TopUpModal';

export default function WorkerCabinetPage() {
  const { user, refreshUser } = useAuth();
  const { currency, formatPrice } = useCurrency();
  const [copiedCode, setCopiedCode] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [claimingStreak, setClaimingStreak] = useState(false);
  const [streakClaimedMessage, setStreakClaimedMessage] = useState<string | null>(null);

  const mainBalance = user?.balances.main || 0;
  const adBalance = user?.balances.ad || 0;
  const level = user?.gamification.level || 1;
  const xp = user?.gamification.xp || 0;
  const streakDays = user?.gamification.streakDays || 1;
  const referralCode = user?.referralCode || 'ggZKK8HB';

  // Level thresholds (e.g. 200 XP for L3)
  const currentLevelMaxXP = level * 100;
  const currentXPInLevel = xp % 100;
  const xpRemaining = 100 - currentXPInLevel;
  const levelProgress = Math.min(100, Math.round((currentXPInLevel / 100) * 100));

  // Minimum withdrawal threshold (20 RUB or ~$0.25 USD)
  const minWithdrawalRUB = 20.0;
  const mainBalanceRUB = mainBalance * 90;
  const withdrawProgress = Math.min(100, Math.round((mainBalanceRUB / minWithdrawalRUB) * 100));

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleClaimStreak = async () => {
    setClaimingStreak(true);
    try {
      const { data } = await dashboardApi.claimStreak();
      setStreakClaimedMessage(data.message);
      refreshUser();
      setTimeout(() => setStreakClaimedMessage(null), 4000);
    } catch {
      setStreakClaimedMessage('Streak bonus already claimed today!');
      setTimeout(() => setStreakClaimedMessage(null), 3000);
    } finally {
      setClaimingStreak(false);
    }
  };

  const sitesAndTasks = [
    {
      id: 'site_visits',
      title: 'Site visits',
      subtitle: 'Timed site traffic',
      href: '/worker/tasks?category=site_visit',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
      ),
      topBorder: 'border-t-4 border-t-blue-500',
    },
    {
      id: 'other',
      title: 'Other',
      subtitle: 'Sign-ups, reviews, polls and free-form...',
      href: '/worker/tasks?category=custom',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <CheckSquare className="w-5 h-5" />
        </div>
      ),
      topBorder: 'border-t-4 border-t-emerald-500',
    },
    {
      id: 'yandex',
      title: 'Yandex',
      subtitle: 'Maps, Business, Market, Services,...',
      href: '/worker/tasks?category=yandex_review',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-red-600 text-white font-bold text-base flex items-center justify-center">
          Я
        </div>
      ),
      topBorder: 'border-t-4 border-t-red-500',
    },
    {
      id: 'google',
      title: 'Google',
      subtitle: 'Google Maps and Google Play — link...',
      href: '/worker/tasks?category=google_review',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 font-black text-base flex items-center justify-center shadow-xs">
          <span className="text-blue-500">G</span>
        </div>
      ),
      topBorder: 'border-t-4 border-t-blue-600',
    },
    {
      id: 'app_store',
      title: 'App Store',
      subtitle: 'Manual App Store actions by IP — no...',
      href: '/worker/tasks?category=app_install_ios',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
          <Smartphone className="w-5 h-5" />
        </div>
      ),
      topBorder: 'border-t-4 border-t-teal-500',
    },
  ];

  const socialPlatforms = [
    {
      id: 'vk',
      title: 'VK',
      desc: 'Likes, follows, friend requests',
      category: 'vk_follow',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
          VK
        </div>
      ),
    },
    {
      id: 'instagram',
      title: 'Instagram',
      desc: 'Likes, follows, comments',
      category: 'instagram_follow',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        </div>
      ),
    },
    {
      id: 'youtube',
      title: 'YouTube',
      desc: 'Views, likes, comments,...',
      category: 'youtube_subscribe',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
      ),
    },
    {
      id: 'tiktok',
      title: 'TikTok',
      desc: 'Likes, follows, comments',
      category: 'tiktok_follow',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
        </div>
      ),
    },
    {
      id: 'telegram',
      title: 'Telegram',
      desc: 'Channel joins',
      category: 'telegram_join',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.197 1.006.128.832.946z" />
          </svg>
        </div>
      ),
    },
    {
      id: 'facebook',
      title: 'Facebook',
      desc: 'Likes, follows, groups, comments',
      category: 'facebook_like',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </div>
      ),
    },
    {
      id: 'threads',
      title: 'Threads',
      desc: 'Views, likes, follows, comments',
      category: 'threads_follow',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-base flex items-center justify-center">
          @
        </div>
      ),
    },
    {
      id: 'x',
      title: 'X',
      desc: 'Views, likes, follows, comments',
      category: 'twitter_follow',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center">
          𝕏
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header />

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Header: Title & Referral Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Cabinet
          </h1>

          {/* Referral Code Badge */}
          <button
            onClick={handleCopyCode}
            title="Click to copy your referral code"
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs hover:border-blue-500 transition-all group"
          >
            <span className="text-slate-400">Your code</span>
            <span className="font-mono text-blue-600 dark:text-blue-400">{referralCode}</span>
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
            )}
          </button>
        </div>

        {/* ─── ROW 1: The 3 Main VBoost Cards ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Main Balance Card (Large) */}
          <div className="lg:col-span-2 v-card p-6 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Main balance
              </span>
              <div className="text-4xl md:text-5xl font-black text-amber-500 tracking-tight flex items-baseline gap-1">
                <span>{currency === 'RUB' ? (mainBalance * 90).toFixed(2) : mainBalance.toFixed(2)}</span>
                <span className="text-2xl font-bold text-amber-500/80">{currency === 'RUB' ? '₽' : currency}</span>
              </div>
            </div>

            {/* Withdrawal Progress Bar */}
            <div className="space-y-1.5 my-4">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Ready to withdraw (min. {minWithdrawalRUB.toFixed(2)} ₽)</span>
                <span>{withdrawProgress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${withdrawProgress}%` }}
                />
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setIsWithdrawOpen(true)}
                className="v-btn-primary px-6 py-2.5 font-bold shadow-md shadow-blue-500/20"
              >
                Withdraw
              </button>

              <button
                onClick={() => setIsTopUpOpen(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
              >
                Ad balance: <strong className="text-slate-800 dark:text-white">{formatPrice(adBalance)}</strong>
              </button>
            </div>
          </div>

          {/* Right Column: Level & Streak Cards */}
          <div className="space-y-4">
            {/* Card 2: Level Card */}
            <div className="v-card p-5">
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                  L{level}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Level {level}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {xp} / {currentLevelMaxXP} XP • {xpRemaining} to Level {level + 1}
                  </p>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
            </div>

            {/* Card 3: Streak Card */}
            <div className="v-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                    <span className="text-base">🔥</span>
                    <span>{streakDays} day streak</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    +0.020 ₽ → +0.030 ₽
                  </p>
                </div>

                <button
                  onClick={handleClaimStreak}
                  disabled={claimingStreak}
                  className="px-3 py-1 rounded-full text-xs font-bold border border-amber-400/80 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all flex items-center gap-1"
                >
                  <span>Today</span>
                  <Check className="w-3 h-3" />
                </button>
              </div>

              {streakClaimedMessage && (
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                  {streakClaimedMessage}
                </p>
              )}

              {/* 7-Day sequence */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const active = day <= streakDays;
                  return (
                    <div
                      key={day}
                      className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                        active
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ─── ROW 2: PC Plugin & Android App Badges ───────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="v-card p-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <Puzzle className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Chrome plugin for PC
              </span>
            </div>
            <Link
              href="/worker/tasks"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Open
            </Link>
          </div>

          <div className="v-card p-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Android app
              </span>
            </div>
            <a
              href="#download"
              onClick={(e) => { e.preventDefault(); alert('Android App APK will download shortly.'); }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              Download
            </a>
          </div>
        </div>

        {/* ─── ROW 3: SITES AND TASKS ──────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Sites and Tasks
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {sitesAndTasks.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`v-card p-4 flex flex-col justify-between h-36 ${item.topBorder} hover:shadow-md transition-all group`}
              >
                <div>
                  <div className="mb-2">{item.icon}</div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-2">
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── ROW 4: SOCIAL ───────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Social
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {socialPlatforms.map((p) => (
              <Link
                key={p.id}
                href={`/worker/tasks?category=${p.category}`}
                className="v-card p-4 flex flex-col justify-between h-32 hover:border-blue-400/60 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  {p.icon}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                      {p.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {p.desc}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-2">
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onSuccess={() => setIsWithdrawOpen(false)}
      />

      {/* TopUp Modal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => setIsTopUpOpen(false)}
      />
    </div>
  );
}
