'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { offersApi } from '@/lib/api';
import { Campaign } from '@/types';
import TaskModal from '@/components/worker/TaskModal';
import LinkAccountModal from '@/components/ui/LinkAccountModal';
import {
  ExternalLink, Search, RefreshCw, ChevronDown, Check,
  AlertCircle, Sparkles, UserCheck, Flame, ArrowUpDown
} from 'lucide-react';
import clsx from 'clsx';

function TasksContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';

  const { user, refreshUser } = useAuth();
  const { currency, formatPrice } = useCurrency();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [activeSubFilter, setActiveSubFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'best_rate' | 'newest'>('best_rate');
  const [search, setSearch] = useState('');

  // Determine current active platform info
  const getPlatformInfo = () => {
    const cat = categoryParam.toLowerCase();
    if (cat.includes('instagram')) {
      return {
        key: 'instagram',
        name: 'Instagram',
        title: 'Instagram tasks',
        desc: 'Просмотры, лайки, подписки и комментарии',
        color: 'from-amber-500 via-pink-500 to-purple-600',
        handle: user?.socialAccounts?.instagram,
        hasViewsBanner: true,
      };
    }
    if (cat.includes('tiktok')) {
      return {
        key: 'tiktok',
        name: 'TikTok',
        title: 'TikTok tasks',
        desc: 'Link your account to complete tasks',
        color: 'bg-black',
        handle: user?.socialAccounts?.tiktok,
        hasViewsBanner: false,
      };
    }
    if (cat.includes('youtube')) {
      return {
        key: 'youtube',
        name: 'YouTube',
        title: 'YouTube tasks',
        desc: 'Views, likes, comments, subscriptions',
        color: 'bg-red-600',
        handle: user?.socialAccounts?.youtube,
        hasViewsBanner: true,
      };
    }
    if (cat.includes('telegram')) {
      return {
        key: 'telegram',
        name: 'Telegram',
        title: 'Telegram tasks',
        desc: 'Channel joins and post views',
        color: 'bg-sky-500',
        handle: user?.socialAccounts?.telegram,
        hasViewsBanner: false,
      };
    }
    if (cat.includes('vk')) {
      return {
        key: 'vk',
        name: 'VK',
        title: 'VKontakte tasks',
        desc: 'Likes, follows, friend requests, reposts',
        color: 'bg-blue-600',
        handle: user?.socialAccounts?.vk,
        hasViewsBanner: false,
      };
    }
    return {
      key: 'general',
      name: 'All Tasks',
      title: 'Microtasks & Offers',
      desc: 'Complete tasks to earn instant cash rewards',
      color: 'bg-blue-600',
      handle: null,
      hasViewsBanner: false,
    };
  };

  const platform = getPlatformInfo();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: { view: string; category?: string; page: number } = {
        view: 'worker',
        page: 1,
      };
      if (categoryParam !== 'all') {
        params.category = categoryParam;
      }
      const { data } = await offersApi.list(params);
      const items: Campaign[] = data.data.campaigns || data.data.offers || [];
      setCampaigns(items);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [categoryParam]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Sub-filter pills (Likes, Views, Follows, etc.)
  const subFilters = [
    { id: 'all', label: 'All', count: campaigns.length },
    { id: 'follows', label: '👥 Follows', count: '100+' },
    { id: 'likes', label: '❤️ Likes', count: '64' },
    { id: 'comments', label: '💬 Comments', count: '32' },
    { id: 'views', label: '▶️ Views', count: '100+' },
    { id: 'texts', label: '📝 By texts', count: '1' },
    { id: 'reports', label: '🚩 Reports', count: '1' },
  ];

  // Sorting and searching
  let displayTasks = [...campaigns];
  if (search.trim()) {
    displayTasks = displayTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (sortBy === 'best_rate') {
    displayTasks.sort((a, b) => b.payoutPerTask - a.payoutPerTask);
  } else {
    displayTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Calculate batch total
  const batchTotal = displayTasks.reduce((sum, t) => sum + t.payoutPerTask, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header />

      <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        {/* ─── Platform Header ───────────────────────────────────── */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl ${
              platform.key === 'instagram'
                ? 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600'
                : platform.color
            } text-white flex items-center justify-center font-bold text-lg shadow-sm`}
          >
            {platform.key === 'instagram' ? 'IG' : platform.key === 'tiktok' ? 'TK' : 'VB'}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {platform.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {platform.desc}
            </p>
          </div>
        </div>

        {/* ─── Linked Account / Link Notice Banner ───────────────── */}
        {platform.key !== 'general' && (
          platform.handle ? (
            // User HAS account linked (as in Instagram screenshot)
            <div className="v-card p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-slate-900 dark:text-white">
                  @{platform.handle}
                </span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>привязан (linked)</span>
                </span>
                <a
                  href={`https://${platform.key}.com/${platform.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 ml-2"
                >
                  <span>Открыть профиль</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Change handle
              </button>
            </div>
          ) : (
            // User does NOT have account linked (as in TikTok screenshot)
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Link your {platform.name} account (gender, age, country, avatar) in your social media settings — targeting is filtered by these.
                </span>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="v-btn-primary py-1.5 px-3.5 text-xs whitespace-nowrap self-start sm:self-auto shrink-0"
              >
                Link account
              </button>
            </div>
          )
        )}

        {/* ─── Fast Surfing Action Banner (like in Screenshot 2) ─── */}
        {platform.hasViewsBanner && (
          <div className="v-card p-5 space-y-3 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-slate-900 dark:to-blue-950/20 border-blue-200/80 dark:border-blue-900/50">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {platform.name} Views (Просмотры)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Открывайте посты по 3 сек подряд — на телефоне можно уходить в приложение {platform.name} и возвращаться в кабинет. Перед стартом будьте залогинены под привязанным аккаунтом.
              </p>
            </div>
            <button
              onClick={() => {
                if (displayTasks.length > 0) setSelectedCampaign(displayTasks[0]);
                else alert('No auto-surf tasks available right now.');
              }}
              className="v-btn-primary px-6 py-2.5 font-bold shadow-md shadow-blue-500/20 bg-blue-600 hover:bg-blue-700"
            >
              Смотреть дальше (Watch more)
            </button>
          </div>
        )}

        {/* ─── Sub-Category Filter Tabs & Sorting Row ────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Pills scrollable */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {subFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveSubFilter(f.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all shrink-0',
                  activeSubFilter === f.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                )}
              >
                <span>{f.label}</span>
                <span className="ml-1 opacity-70">({f.count})</span>
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold py-1.5 pl-3 pr-7 rounded-full border border-slate-200/80 dark:border-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="best_rate">⇅ Best rate</option>
                <option value="newest">⇅ Newest first</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ─── Task Batch Count Bar ──────────────────────────────── */}
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
          <div>
            <span>{displayTasks.length} tasks</span>
            <span className="mx-1.5">•</span>
            <span>≈ {formatPrice(batchTotal)}</span>
          </div>

          <button
            onClick={() => {
              if (displayTasks.length > 0) setSelectedCampaign(displayTasks[0]);
            }}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Claim all
          </button>
        </div>

        {/* ─── Task Rows List (VBoost Style) ─────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="v-card p-3.5 h-16 animate-pulse bg-slate-100/60 dark:bg-slate-800/40" />
            ))}
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="v-card p-12 text-center space-y-3">
            <p className="text-4xl">📭</p>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">No tasks in this category</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Check back in a few minutes or switch to another social network in the sidebar.
            </p>
            <button onClick={fetchTasks} className="v-btn-secondary mx-auto">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTasks.map((t, idx) => {
              const isTop = idx === 0 || t.payoutPerTask >= 0.2;
              return (
                <div
                  key={t._id}
                  className="v-card p-3.5 px-4 flex items-center justify-between gap-4 hover:border-blue-400/60 transition-all"
                >
                  {/* Left: User / Task Icon & Title */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                      <svg className="w-5 h-5 fill-current opacity-80" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        {isTop && (
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded uppercase">
                            🔥 ТОП
                          </span>
                        )}
                        <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {t.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Follows • смотреть (view)
                      </p>
                    </div>
                  </div>

                  {/* Right: Price & Claim Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-sm font-bold ${
                        isTop ? 'text-amber-500 font-black' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {formatPrice(t.payoutPerTask)}
                    </span>

                    <button
                      onClick={() => setSelectedCampaign(t)}
                      className="v-btn-primary py-1.5 px-4 text-xs font-bold rounded-xl"
                    >
                      Claim
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Task Modal */}
      <TaskModal
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        onSuccess={() => {
          fetchTasks();
          refreshUser();
        }}
      />

      {/* Link Account Modal */}
      <LinkAccountModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        platform={platform.key}
        currentHandle={platform.handle || ''}
        onSuccess={() => {
          refreshUser();
          fetchTasks();
        }}
      />
    </div>
  );
}

export default function WorkerTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}
