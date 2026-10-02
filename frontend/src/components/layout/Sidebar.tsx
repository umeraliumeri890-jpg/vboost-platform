'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ChevronDown, ChevronRight, Globe, CreditCard,
  Users, Star, CheckCircle, ExternalLink, ShieldCheck, Sparkles
} from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  mode: 'worker' | 'advertiser';
}

export default function Sidebar({ mode }: SidebarProps) {
  const pathname = usePathname();
  const [socialOpen, setSocialOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [advSocialOpen, setAdvSocialOpen] = useState(false);

  const socialLinks = [
    { id: 'vk', label: 'VK', count: '45+', href: '/worker/tasks?category=vk_follow', icon: 'VK', color: 'text-blue-500' },
    { id: 'instagram', label: 'Instagram', count: '100+', href: '/worker/tasks?category=instagram_follow', icon: 'IG', color: 'text-pink-500' },
    { id: 'youtube', label: 'YouTube', count: '80+', href: '/worker/tasks?category=youtube_subscribe', icon: 'YT', color: 'text-red-500' },
    { id: 'tiktok', label: 'TikTok', count: '50+', href: '/worker/tasks?category=tiktok_follow', icon: 'TK', color: 'text-slate-900 dark:text-white' },
    { id: 'telegram', label: 'Telegram', count: '30+', href: '/worker/tasks?category=telegram_join', icon: 'TG', color: 'text-sky-500' },
    { id: 'facebook', label: 'Facebook', count: '25+', href: '/worker/tasks?category=facebook_like', icon: 'FB', color: 'text-blue-600' },
    { id: 'threads', label: 'Threads', count: '15+', href: '/worker/tasks?category=threads_follow', icon: 'TH', color: 'text-slate-900 dark:text-white' },
    { id: 'twitter', label: 'X', count: '40+', href: '/worker/tasks?category=twitter_follow', icon: 'X', color: 'text-slate-900 dark:text-white' },
    { id: 'max', label: 'Max', count: '', href: '/worker/tasks?category=custom', icon: 'MX', color: 'text-indigo-500' },
    { id: 'odnoklassniki', label: 'Odnoklassniki', count: '', href: '/worker/tasks?category=custom', icon: 'OK', color: 'text-orange-500' },
    { id: 'soundcloud', label: 'SoundCloud', count: '', href: '/worker/tasks?category=custom', icon: 'SC', color: 'text-amber-500' },
    { id: 'rutube', label: 'RuTube', count: '', href: '/worker/tasks?category=custom', icon: 'RT', color: 'text-red-600' },
  ];

  const tasksLinks = [
    { id: 'other', label: 'Other', href: '/worker/tasks?category=custom', icon: 'OT' },
    { id: 'yandex', label: 'Yandex', href: '/worker/tasks?category=yandex_review', icon: 'Я' },
    { id: 'google', label: 'Google', href: '/worker/tasks?category=google_review', icon: 'G' },
    { id: 'appstore', label: 'App Store', href: '/worker/tasks?category=app_install_ios', icon: '🍏' },
  ];

  const isCurrent = (href: string) => {
    if (href === '/worker' && pathname === '/worker') return true;
    if (href !== '/worker' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 text-xs select-none transition-colors z-20">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200/80 dark:border-slate-800">
        <Link href="/worker" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-blue-500/30">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M9.5 16.5L4.5 11.5L6 10L9.5 13.5L18 5L19.5 6.5L9.5 16.5Z" />
            </svg>
          </div>
          <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">VBoost</span>
        </Link>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* ─── EARN SECTION ────────────────────────────────────────── */}
        <div>
          <div className="px-2.5 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Earn
          </div>

          <div className="space-y-0.5">
            {/* Cabinet */}
            <Link
              href="/worker"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-all',
                pathname === '/worker'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Cabinet</span>
            </Link>

            {/* Social Collapsible */}
            <div>
              <button
                onClick={() => setSocialOpen(!socialOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5 font-medium">
                  <Users className="w-4 h-4 shrink-0 text-slate-500" />
                  <span>Social (100+)</span>
                </div>
                {socialOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {socialOpen && (
                <div className="pl-6 pr-1 py-1 space-y-0.5">
                  {socialLinks.map((item) => {
                    const active = pathname.includes(item.id);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={clsx(
                          'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                          active
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-3.5 text-center text-[10px] font-black ${item.color}`}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.count && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {item.count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tasks Collapsible */}
            <div>
              <button
                onClick={() => setTasksOpen(!tasksOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5 font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0 text-slate-500" />
                  <span>Tasks</span>
                </div>
                {tasksOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {tasksOpen && (
                <div className="pl-6 pr-1 py-1 space-y-0.5">
                  {tasksLinks.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <span className="text-[10px] font-bold">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Site visits */}
            <Link
              href="/worker/tasks?category=site_visit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Globe className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Site visits</span>
            </Link>

            {/* Payouts */}
            <Link
              href="/worker/history"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <CreditCard className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Payouts & History</span>
            </Link>

            {/* Referrals */}
            <Link
              href="/worker#referrals"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Users className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Referrals</span>
            </Link>

            {/* Level */}
            <Link
              href="/worker#level"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Star className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Level & XP</span>
            </Link>
          </div>
        </div>

        {/* ─── ADVERTISE SECTION ─────────────────────────────────── */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
          <div className="px-2.5 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Advertise
          </div>

          <div className="space-y-0.5">
            <Link
              href="/advertiser"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-all',
                pathname === '/advertiser'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/advertiser/campaigns"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-all',
                pathname === '/advertiser/campaigns'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <Sparkles className="w-4 h-4 shrink-0 text-purple-500" />
              <span>Create Campaign</span>
            </Link>

            <Link
              href="/advertiser/analytics"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-all',
                pathname === '/advertiser/analytics'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Review Submissions</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
