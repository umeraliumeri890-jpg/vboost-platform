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
  ExternalLink, RefreshCw, ChevronDown, Check, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

function TasksContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';

  const { user, refreshUser } = useAuth();
  const { formatPrice } = useCurrency();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [activeSubFilter, setActiveSubFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'best_rate' | 'newest'>('best_rate');
  const [subCounts, setSubCounts] = useState<Record<string, number>>({
    all: 0, follows: 0, likes: 0, comments: 0, views: 0, texts: 0,
  });
  const [totalCount, setTotalCount] = useState(0);

  // Determine current active platform info from URL param
  const getPlatformInfo = () => {
    const cat = categoryParam.toLowerCase();
    if (cat.includes('instagram')) return {
      key: 'instagram', name: 'Instagram', title: 'Instagram tasks',
      desc: 'Views, likes, follows, comments',
      color: 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600',
      handle: user?.socialAccounts?.instagram || null,
      hasViewsBanner: true, prefix: 'instagram',
    };
    if (cat.includes('tiktok')) return {
      key: 'tiktok', name: 'TikTok', title: 'TikTok tasks',
      desc: 'Follows, likes, views',
      color: 'bg-black',
      handle: user?.socialAccounts?.tiktok || null,
      hasViewsBanner: false, prefix: 'tiktok',
    };
    if (cat.includes('youtube')) return {
      key: 'youtube', name: 'YouTube', title: 'YouTube tasks',
      desc: 'Subscribes, likes, views',
      color: 'bg-red-600',
      handle: user?.socialAccounts?.youtube || null,
      hasViewsBanner: true, prefix: 'youtube',
    };
    if (cat.includes('telegram')) return {
      key: 'telegram', name: 'Telegram', title: 'Telegram tasks',
      desc: 'Channel joins, post views',
      color: 'bg-sky-500',
      handle: user?.socialAccounts?.telegram || null,
      hasViewsBanner: false, prefix: 'telegram',
    };
    if (cat.includes('vk')) return {
      key: 'vk', name: 'VK', title: 'VKontakte tasks',
      desc: 'Likes, follows, reposts',
      color: 'bg-blue-600',
      handle: user?.socialAccounts?.vk || null,
      hasViewsBanner: false, prefix: 'vk',
    };
    if (cat.includes('twitter')) return {
      key: 'twitter', name: 'Twitter / X', title: 'Twitter tasks',
      desc: 'Follows, likes, retweets',
      color: 'bg-black',
      handle: user?.socialAccounts?.twitter || null,
      hasViewsBanner: false, prefix: 'twitter',
    };
    return {
      key: 'general', name: 'All Tasks', title: 'All Microtasks',
      desc: 'Complete tasks to earn instant cash',
      color: 'bg-blue-600',
      handle: null, hasViewsBanner: false, prefix: undefined,
    };
  };

  const platform = getPlatformInfo();

  // Fetch live tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: { view: string; category?: string; page: number } = { view: 'worker', page: 1 };
      if (categoryParam !== 'all') params.category = categoryParam;
      const { data } = await offersApi.list(params);
      setCampaigns(data.data.campaigns || data.data.offers || []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [categoryParam]);

  // Fetch dynamic subcategory counts
  const fetchCounts = useCallback(async () => {
    try {
      const { data } = await offersApi.categoryCounts(platform.prefix);
      setSubCounts(data.data.subCounts || {});
      setTotalCount(data.data.total || 0);
    } catch {
      // silently fail, use campaign count as fallback
    }
  }, [platform.prefix]);

  useEffect(() => {
    fetchTasks();
    fetchCounts();
  }, [fetchTasks, fetchCounts]);

  // Sub-filter pills with live counts
  const subFilters = [
    { id: 'all',      label: 'All',        count: totalCount || campaigns.length },
    { id: 'follows',  label: '👥 Follows', count: subCounts.follows },
    { id: 'likes',    label: '❤️ Likes',   count: subCounts.likes },
    { id: 'comments', label: '💬 Comments', count: subCounts.comments },
    { id: 'views',    label: '▶️ Views',   count: subCounts.views },
    { id: 'texts',    label: '📝 Texts',   count: subCounts.texts },
  ];

  // Filter + sort
  let displayTasks = [...campaigns];
  if (activeSubFilter !== 'all') {
    displayTasks = displayTasks.filter((t) => {
      if (activeSubFilter === 'follows') return t.category.includes('follow') || t.category.includes('join') || t.category.includes('subscribe');
      if (activeSubFilter === 'likes') return t.category.includes('like');
      if (activeSubFilter === 'comments') return t.category.includes('comment');
      if (activeSubFilter === 'views') return t.category.includes('watch') || t.category.includes('view');
      if (activeSubFilter === 'texts') return t.category.includes('text') || t.category.includes('review') || t.category.includes('custom');
      return true;
    });
  }
  if (sortBy === 'best_rate') {
    displayTasks.sort((a, b) => b.payoutPerTask - a.payoutPerTask);
  } else {
    displayTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Worker gets 75% (platform keeps 25%)
  const workerPayout = (c: Campaign) => parseFloat((c.payoutPerTask * 0.75).toFixed(4));
  const batchTotal = displayTasks.reduce((sum, t) => sum + workerPayout(t), 0);

  const platformIcon = {
    instagram: 'IG', tiktok: 'TK', youtube: 'YT',
    telegram: 'TG', vk: 'VK', twitter: 'X',
  }[platform.key] || '📋';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header />

      <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        {/* Platform Header */}
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl ${platform.color} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
            {platformIcon}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{platform.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{platform.desc}</p>
          </div>
          <button onClick={() => { fetchTasks(); fetchCounts(); }} className="ml-auto text-slate-400 hover:text-blue-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Linked Account Banner */}
        {platform.key !== 'general' && (
          platform.handle ? (
            <div className="v-card p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-slate-900 dark:text-white">@{platform.handle}</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <Check className="w-3.5 h-3.5" /> Linked
                </span>
                <a
                  href={`https://${platform.key === 'twitter' ? 'x' : platform.key}.com/${platform.handle}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-0.5 ml-2"
                >
                  Open Profile <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button onClick={() => setIsLinkModalOpen(true)} className="text-slate-400 hover:text-slate-600">
                Change
              </button>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Link your {platform.name} account to accept tasks and verify completions.</span>
              </div>
              <button onClick={() => setIsLinkModalOpen(true)} className="v-btn-primary py-1.5 px-3.5 text-xs whitespace-nowrap shrink-0">
                Link Account
              </button>
            </div>
          )
        )}

        {/* Commission Info Banner */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-700 dark:text-blue-300">
          <span className="font-bold">💡</span>
          <span>You earn <strong>75%</strong> of each task price. The platform retains 25% as service fee.</span>
        </div>

        {/* Sub-Category Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {subFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveSubFilter(f.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all shrink-0',
                  activeSubFilter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-800'
                )}
              >
                {f.label} <span className="opacity-70">({f.count})</span>
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
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

        {/* Batch Count Bar */}
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
          <div>
            <span>{displayTasks.length} tasks</span>
            <span className="mx-1.5">•</span>
            <span>≈ {formatPrice(batchTotal)} (your 75%)</span>
          </div>
          <button
            onClick={() => { if (displayTasks.length > 0) setSelectedCampaign(displayTasks[0]); }}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Claim all
          </button>
        </div>

        {/* Task Rows */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="v-card p-3.5 h-16 animate-pulse bg-slate-100/60 dark:bg-slate-800/40" />
            ))}
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="v-card p-12 text-center space-y-3">
            <p className="text-4xl">📭</p>
            <h3 className="font-bold text-slate-900 dark:text-white">No tasks in this category</h3>
            <p className="text-xs text-slate-500">Check back soon or switch to another social network.</p>
            <button onClick={fetchTasks} className="v-btn-secondary mx-auto flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTasks.map((t, idx) => {
              const netPayout = workerPayout(t);
              const isTop = idx === 0 || netPayout >= 0.15;
              return (
                <div
                  key={t._id}
                  className="v-card p-3.5 px-4 flex items-center justify-between gap-4 hover:border-blue-400/60 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                      <svg className="w-5 h-5 fill-current opacity-80" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isTop && (
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded uppercase">🔥 TOP</span>
                        )}
                        <span className="font-bold text-slate-900 dark:text-white text-xs truncate">{t.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                        {t.category.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`text-sm font-bold ${isTop ? 'text-amber-500 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                        {formatPrice(netPayout)}
                      </span>
                      <p className="text-[10px] text-slate-400">you earn</p>
                    </div>
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

      <TaskModal
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        onSuccess={() => { fetchTasks(); refreshUser(); }}
      />

      <LinkAccountModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        platform={platform.key}
        currentHandle={platform.handle || ''}
        onSuccess={() => { refreshUser(); fetchTasks(); }}
      />
    </div>
  );
}

export default function WorkerTasksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TasksContent />
    </Suspense>
  );
}
