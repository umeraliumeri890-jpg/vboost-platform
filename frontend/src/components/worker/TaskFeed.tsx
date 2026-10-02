'use client';
import { useState, useEffect, useCallback } from 'react';
import { Campaign, TaskCategory } from '@/types';
import { offersApi } from '@/lib/api';
import TaskCard from './TaskCard';
import { Search, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES: { id: TaskCategory; label: string; emoji: string }[] = [
  { id: 'all', label: 'All Tasks', emoji: '⚡' },
  { id: 'vk_follow', label: 'VK', emoji: '🔵' },
  { id: 'instagram_follow', label: 'Instagram', emoji: '📸' },
  { id: 'youtube_subscribe', label: 'YouTube', emoji: '▶️' },
  { id: 'telegram_join', label: 'Telegram', emoji: '✈️' },
  { id: 'tiktok_follow', label: 'TikTok', emoji: '🎵' },
  { id: 'twitter_follow', label: 'X/Twitter', emoji: '🐦' },
  { id: 'facebook_like', label: 'Facebook', emoji: '👍' },
  { id: 'site_visit', label: 'Sites', emoji: '🌐' },
  { id: 'app_install_android', label: 'Apps', emoji: '📱' },
  { id: 'google_review', label: 'Reviews', emoji: '⭐' },
];

// Map sub-categories to their parent group for filter matching
const CATEGORY_GROUP_MAP: Record<string, string> = {
  instagram_like: 'instagram_follow', instagram_comment: 'instagram_follow',
  vk_like: 'vk_follow', vk_repost: 'vk_follow',
  youtube_like: 'youtube_subscribe', youtube_watch: 'youtube_subscribe',
  tiktok_like: 'tiktok_follow',
  twitter_like: 'twitter_follow', twitter_retweet: 'twitter_follow',
  facebook_follow: 'facebook_like', facebook_share: 'facebook_like',
  threads_follow: 'twitter_follow',
  site_signup: 'site_visit',
  app_install_ios: 'app_install_android',
  yandex_review: 'google_review',
};

interface TaskFeedProps {
  onAccept: (campaign: Campaign) => void;
}

export default function TaskFeed({ onAccept }: TaskFeedProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskCategory>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchCampaigns = useCallback(async (tab: TaskCategory, p: number) => {
    setLoading(true);
    try {
      const params: { page: number; view: string; category?: string } = { page: p, view: 'worker' };
      if (tab !== 'all') params.category = tab;
      const { data } = await offersApi.list(params);
      const items: Campaign[] = data.data.campaigns || data.data.offers || [];
      setCampaigns(p === 1 ? items : (prev) => [...prev, ...items]);
      setHasMore(data.data.hasMore || items.length === (data.data.limit || 20));
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchCampaigns(activeTab, 1);
  }, [activeTab, fetchCampaigns]);

  const filtered = search.trim()
    ? campaigns.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase())
      )
    : campaigns;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-10"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(({ id, label, emoji }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
              activeTab === id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            <span>{emoji}</span>{label}
          </button>
        ))}
      </div>

      {/* Task grid */}
      {loading && page === 1 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-700 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-slate-700 rounded" />
              <div className="h-3 bg-slate-700 rounded w-2/3" />
              <div className="h-8 bg-slate-700 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-lg font-medium">No tasks found</p>
          <p className="text-sm mt-1">Try a different category or check back later</p>
          <button onClick={() => fetchCampaigns(activeTab, 1)} className="btn-secondary mt-4 flex items-center gap-2 mx-auto">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <TaskCard key={c._id} campaign={c} onAccept={onAccept} />
            ))}
          </div>
          {hasMore && !search && (
            <div className="text-center pt-4">
              <button
                onClick={() => { const next = page + 1; setPage(next); fetchCampaigns(activeTab, next); }}
                disabled={loading}
                className="btn-secondary flex items-center gap-2 mx-auto"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
