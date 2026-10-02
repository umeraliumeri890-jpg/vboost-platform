'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Zap, ArrowRight, ShieldCheck, DollarSign, Users,
  CheckCircle2, Flame, Star, Sparkles, Globe, Smartphone
} from 'lucide-react';

export default function PublicLandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* ─── Top Navbar ────────────────────────────────────────── */}
      <nav className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-blue-500/30">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M9.5 16.5L4.5 11.5L6 10L9.5 13.5L18 5L19.5 6.5L9.5 16.5Z" />
            </svg>
          </div>
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">VBoost</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/worker"
              className="v-btn-primary px-5 py-2 font-bold shadow-md shadow-blue-500/20"
            >
              <span>Go to Cabinet</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="v-btn-primary px-4 py-2 font-bold text-xs shadow-sm shadow-blue-500/20"
              >
                Register Free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ─── Hero Section ──────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>#1 Micro-Tasking & Social Boosting Network</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Earn Real Money on Tasks.{' '}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Fast & Guaranteed.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Complete simple social media actions (VK, Instagram, YouTube, TikTok, Telegram) or promote your accounts to thousands of real, active users.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto v-btn-primary px-8 py-3.5 text-base font-bold shadow-lg shadow-blue-500/25"
          >
            Start Earning Now
          </Link>
          <Link
            href="/advertiser"
            className="w-full sm:w-auto v-btn-secondary px-8 py-3.5 text-base font-bold"
          >
            Promote My Business
          </Link>
        </div>

        {/* Stats Row */}
        <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="v-card p-4">
            <span className="text-xs text-slate-400">Total Paid Out</span>
            <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              1,450,000+ ₽
            </p>
          </div>
          <div className="v-card p-4">
            <span className="text-xs text-slate-400">Active Workers</span>
            <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              85,000+
            </p>
          </div>
          <div className="v-card p-4">
            <span className="text-xs text-slate-400">Minimum Payout</span>
            <p className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
              20.00 ₽ (~$0.25)
            </p>
          </div>
          <div className="v-card p-4">
            <span className="text-xs text-slate-400">Instant Approval</span>
            <p className="text-xl md:text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
              Auto-Verify
            </p>
          </div>
        </div>
      </section>

      {/* ─── Supported Networks Grid ───────────────────────────── */}
      <section className="py-12 bg-white dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-800 px-4">
        <div className="max-w-5xl mx-auto space-y-6 text-center">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            Supported Social Platforms
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {[
              { name: 'VK', color: 'bg-blue-600' },
              { name: 'Instagram', color: 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600' },
              { name: 'YouTube', color: 'bg-red-600' },
              { name: 'TikTok', color: 'bg-black' },
              { name: 'Telegram', color: 'bg-sky-500' },
              { name: 'Facebook', color: 'bg-blue-600' },
              { name: 'Threads', color: 'bg-slate-900' },
              { name: 'X / Twitter', color: 'bg-black' },
            ].map((s) => (
              <div
                key={s.name}
                className="v-card p-3 flex flex-col items-center gap-2 hover:border-blue-400 transition-all cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl ${s.color} text-white font-bold flex items-center justify-center text-xs shadow-xs`}>
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it Works ──────────────────────────────────────── */}
      <section className="py-16 px-4 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white">How It Works</h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Get started in less than 2 minutes. No complicated verifications or fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="v-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
              1
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Select a Task</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pick from thousands of social tasks (follow, like, watch, or review) with clear instructions and guaranteed payouts.
            </p>
          </div>

          <div className="v-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
              2
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Execute & Submit</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete the action in seconds, enter your username or upload a screenshot proof.
            </p>
          </div>

          <div className="v-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
              3
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Get Paid Instantly</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Earnings are credited directly to your Main Balance. Withdraw to Bank Card, QIWI, Payeer, or Crypto USDT.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 px-4 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              V
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-300">VBoost Platform</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-800 dark:hover:text-slate-200">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-800 dark:hover:text-slate-200">
              Register
            </Link>
            <Link href="/worker" className="hover:text-slate-800 dark:hover:text-slate-200">
              Worker Cabinet
            </Link>
            <Link href="/advertiser" className="hover:text-slate-800 dark:hover:text-slate-200">
              Advertiser Cabinet
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
