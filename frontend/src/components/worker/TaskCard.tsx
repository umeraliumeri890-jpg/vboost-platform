'use client';
import { Campaign } from '@/types';
import { Users, Tag } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  vk_follow: 'bg-blue-900/40 text-blue-300',
  vk_like: 'bg-blue-900/40 text-blue-300',
  instagram_follow: 'bg-pink-900/40 text-pink-300',
  instagram_like: 'bg-pink-900/40 text-pink-300',
  youtube_subscribe: 'bg-red-900/40 text-red-300',
  youtube_like: 'bg-red-900/40 text-red-300',
  youtube_watch: 'bg-red-900/40 text-red-300',
  tiktok_follow: 'bg-slate-700 text-white',
  tiktok_like: 'bg-slate-700 text-white',
  telegram_join: 'bg-sky-900/40 text-sky-300',
  facebook_like: 'bg-blue-900/40 text-blue-300',
  twitter_follow: 'bg-slate-700 text-white',
  site_visit: 'bg-green-900/40 text-green-300',
  app_install_android: 'bg-emerald-900/40 text-emerald-300',
  google_review: 'bg-yellow-900/40 text-yellow-300',
  custom: 'bg-purple-900/40 text-purple-300',
};

const CATEGORY_ICONS: Record<string, string> = {
  vk_follow: 'VK', vk_like: 'VK',
  instagram_follow: 'IG', instagram_like: 'IG',
  youtube_subscribe: 'YT', youtube_like: 'YT', youtube_watch: 'YT',
  tiktok_follow: 'TK', tiktok_like: 'TK',
  telegram_join: 'TG',
  facebook_like: 'FB', facebook_follow: 'FB',
  twitter_follow: 'TW', twitter_like: 'TW',
  site_visit: 'WEB', app_install_android: 'APP',
  google_review: 'GGL', custom: '★',
};

interface TaskCardProps {
  campaign: Campaign;
  onAccept: (campaign: Campaign) => void;
}

export default function TaskCard({ campaign, onAccept }: TaskCardProps) {
  const colorClass = CATEGORY_COLORS[campaign.category] || 'bg-slate-700 text-slate-300';
  const icon = CATEGORY_ICONS[campaign.category] || '★';
  const progress = campaign.totalLimit > 0 ? (campaign.completionsCount / campaign.totalLimit) * 100 : 0;

  return (
    <div className="card card-hover p-5 flex flex-col gap-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${colorClass}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{campaign.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{campaign.category.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-emerald-400">${campaign.payoutPerTask.toFixed(3)}</p>
          <p className="text-xs text-slate-500">per task</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 line-clamp-2">{campaign.description}</p>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{campaign.completionsCount}/{campaign.totalLimit} completed</span>
          <span>{Math.round(progress)}% full</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Tag className="w-3 h-3" />
          <span>Min. Level {campaign.targeting.minLevel}</span>
        </div>
        <button onClick={() => onAccept(campaign)} className="btn-primary text-xs py-2 px-4">
          Accept Task
        </button>
      </div>
    </div>
  );
}
