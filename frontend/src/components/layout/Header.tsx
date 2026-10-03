'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCurrency, Currency, Language } from '@/context/CurrencyContext';
import {
  Wallet, Megaphone, Moon, Sun, ChevronDown,
  LogOut, User as UserIcon, Check, Copy, Zap, ArrowLeftRight, ShieldAlert,
  Bell, CheckCheck
} from 'lucide-react';
import WithdrawModal from '@/components/ui/WithdrawModal';
import TopUpModal from '@/components/ui/TopUpModal';
import { notificationsApi } from '@/lib/api';
import { NotificationItem } from '@/types';

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
}

export default function Header({ title, showLogo = false }: HeaderProps) {
  const { user, logout } = useAuth();
  const { currency, setCurrency, formatPrice, theme, toggleTheme, language, setLanguage } = useCurrency();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // In-app notifications state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await notificationsApi.list({ limit: 10 });
      setNotifications(data.data.notifications || []);
      setUnreadCount(data.data.unreadCount || 0);
    } catch {
      // ignore silently if offline
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      try {
        await notificationsApi.markRead(notif._id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
        );
      } catch {}
    }
  };

  // User initials for avatar circle (like 'UA' in screenshot)
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.split(/[_\s.-]+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleCopyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <>
      <header className="h-16 px-4 md:px-6 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between transition-colors">
        {/* Left Side: Brand Logo or Page Title */}
        <div className="flex items-center gap-3">
          {showLogo ? (
            <Link href="/worker" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-blue-500/30">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M9.5 16.5L4.5 11.5L6 10L9.5 13.5L18 5L19.5 6.5L9.5 16.5Z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">VBoost</span>
            </Link>
          ) : (
            title && (
              <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white hidden sm:block">
                {title}
              </h1>
            )
          )}
        </div>

        {/* Right Side: VBoost Signature Control Pills */}
        <div className="flex items-center gap-2 md:gap-2.5">
          {/* Main Balance Pill (Green) */}
          <button
            onClick={() => setIsWithdrawOpen(true)}
            title="Click to withdraw funds"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs transition-all"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{formatPrice(user?.balances.main || 0)}</span>
          </button>

          {/* Ad Balance Pill (Blue) */}
          <button
            onClick={() => setIsTopUpOpen(true)}
            title="Click to top-up ad balance"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-xs transition-all"
          >
            <Megaphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{formatPrice(user?.balances.ad || 0)}</span>
          </button>

          {/* Level Square Badge (Solid Blue L3) */}
          <div
            title={`Level ${user?.gamification.level || 1} (${user?.gamification.xp || 0} XP)`}
            className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs shadow-blue-500/20 select-none cursor-default"
          >
            L{user?.gamification.level || 1}
          </div>

          {/* Theme Toggle (Moon / Sun) */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Language Selector */}
          <div className="relative hidden sm:block">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium py-1.5 pl-2.5 pr-6 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:outline-none cursor-pointer transition-all"
            >
              <option value="en" className="dark:bg-slate-900">🇬🇧 English</option>
              <option value="ru" className="dark:bg-slate-900">🇷🇺 Русский</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Currency Selector */}
          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="appearance-none bg-slate-100/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold py-1.5 pl-2.5 pr-6 rounded-lg border border-slate-200/80 dark:border-slate-700 focus:outline-none cursor-pointer transition-all"
            >
              <option value="RUB" className="dark:bg-slate-900">₽ RUB</option>
              <option value="USD" className="dark:bg-slate-900">$ USD</option>
              <option value="EUR" className="dark:bg-slate-900">€ EUR</option>
              <option value="PKR" className="dark:bg-slate-900">₨ PKR</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* In-App Notification Bell & Dropdown */}
          {user && (
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (!notificationsOpen) fetchNotifications();
                }}
                title="Notifications"
                className="relative w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 v-card p-0 shadow-2xl z-50 animate-slide-up overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <div
                            key={item._id}
                            onClick={() => handleNotificationClick(item)}
                            className={`p-3.5 text-xs transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                              !item.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`font-semibold ${!item.read ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                                {item.title}
                              </p>
                              {!item.read && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                              {item.message}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1.5">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* User Profile Pill (Avatar Circle UA + Name + Dropdown) */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 transition-all text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                  {getInitials(user.username)}
                </div>
                <span className="hidden md:inline truncate max-w-[100px]">{user.username}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 v-card p-3 shadow-xl z-50 animate-slide-up space-y-2">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{user.username}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <div className="mt-2 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                        <span className="text-slate-500">Code:</span>
                        <button
                          onClick={handleCopyCode}
                          className="font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                        >
                          {user.referralCode || 'N/A'}
                          {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Link
                        href="/worker"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <UserIcon className="w-4 h-4 text-blue-500" />
                        Worker Cabinet
                      </Link>
                      <Link
                        href="/advertiser"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <ArrowLeftRight className="w-4 h-4 text-purple-500" />
                        Advertiser Cabinet
                      </Link>
                      {(user.role === 'admin' || user.roles?.includes('admin')) && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                          Admin Control Center
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Interactive Top-Up & Withdraw Modals */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onSuccess={() => setIsWithdrawOpen(false)}
      />
      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => setIsTopUpOpen(false)}
      />
    </>
  );
}
