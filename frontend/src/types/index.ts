export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  roles: string[];
  balances: { main: number; ad: number };
  gamification: {
    level: number;
    xp: number;
    streakDays: number;
    xpToNextLevel?: number;
    nextLevelThreshold?: number;
  };
  stats: {
    tasksCompleted: number;
    tasksPending: number;
    tasksRejected: number;
    totalEarned: number;
    totalSpent: number;
    campaignsCreated: number;
  };
  isVerified: boolean;
  referralCode?: string;
  socialAccounts?: {
    vk?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    telegram?: string;
    facebook?: string;
    threads?: string;
    twitter?: string;
  };
  registrationIp?: string;
  lastLoginIp?: string;
  deviceFingerprint?: string;
}

export interface Campaign {
  _id: string;
  title: string;
  description: string;
  category: string;
  targetUrl: string;
  instructions: string;
  proofType: 'screenshot' | 'text' | 'username' | 'url' | 'none';
  proofInstructions?: string;
  payoutPerTask: number;
  totalBudget: number;
  spentBudget: number;
  totalLimit: number;
  completionsCount: number;
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected' | 'cancelled';
  advertiser: { _id: string; username: string; avatar?: string };
  targeting: { countries: string[]; minLevel: number; maxCompletionsPerUser: number };
  autoApprove: boolean;
  createdAt: string;
  remainingSlots?: number;
  remainingBudget?: number;
}

export interface Completion {
  _id: string;
  campaign: Campaign | string;
  worker: { _id: string; username: string; avatar?: string } | string;
  proof: {
    type: string;
    screenshotUrl?: string;
    textContent?: string;
    submittedAt?: string;
  };
  status: 'accepted' | 'submitted' | 'pending_review' | 'approved' | 'auto_approved' | 'rejected' | 'expired' | 'disputed';
  payoutAmount: number;
  xpAwarded: number;
  rejectionReason?: string;
  createdAt: string;
  paidAt?: string;
}

export interface Transaction {
  _id: string;
  type: string;
  amount: number;
  balanceType: 'main' | 'ad';
  balanceBefore: number;
  balanceAfter: number;
  status: string;
  note?: string;
  createdAt: string;
}

export type TaskCategory =
  | 'all'
  | 'vk_follow' | 'vk_like' | 'vk_repost'
  | 'instagram_follow' | 'instagram_like'
  | 'youtube_subscribe' | 'youtube_like' | 'youtube_watch'
  | 'tiktok_follow' | 'tiktok_like'
  | 'telegram_join'
  | 'facebook_like' | 'facebook_follow'
  | 'twitter_follow' | 'twitter_like'
  | 'threads_follow'
  | 'app_install_android' | 'app_install_ios'
  | 'site_visit' | 'site_signup'
  | 'google_review' | 'yandex_review'
  | 'custom';

export interface NotificationItem {
  _id: string;
  user: string;
  title: string;
  message: string;
  type: 'deposit' | 'withdrawal' | 'task' | 'referral' | 'dispute' | 'system';
  read: boolean;
  link?: string | null;
  createdAt: string;
}

export interface SystemSettings {
  _id?: string;
  platformFeePercent: number;
  referralCommissionPercent: number;
  minDeposit: number;
  minWithdrawal: number;
  minPayoutPerTask: number;
  autoApproveHours: number;
  autoApproveEnabled: boolean;
  antiCheatEnabled: boolean;
  maintenanceMode: boolean;
  nowPaymentsApiKey?: string;
  nowPaymentsIpnSecret?: string;
  coinPaymentsMerchantId?: string;
  coinPaymentsIpnSecret?: string;
  updatedAt?: string;
}

export interface AuditLogItem {
  _id: string;
  action: string;
  performedBy?: { _id: string; username: string; email: string };
  targetUser?: { _id: string; username: string; email: string };
  details?: Record<string, any>;
  ip?: string;
  createdAt: string;
}

export interface BannedIp {
  _id: string;
  ip: string;
  reason: string;
  bannedBy?: { _id: string; username: string; email?: string };
  createdAt: string;
}
