import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        }
      } catch {
        localStorage.clear();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────
export const authApi = {
  register: (data: { username: string; email: string; password: string; referralCode?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ─── Dashboard ───────────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get('/dashboard'),
  leaderboard: () => api.get('/dashboard/leaderboard'),
  transactions: (page = 1) => api.get(`/dashboard/transactions?page=${page}`),
  withdraw: (data: { amount: number; method: string; details: string }) =>
    api.post('/dashboard/withdraw', data),
  topup: (data: { amount: number; paymentMethod?: string }) =>
    api.post('/dashboard/topup', data),
  linkSocialAccount: (data: { platform: string; handle: string }) =>
    api.patch('/dashboard/social-accounts', data),
  claimStreak: () => api.post('/dashboard/claim-daily-streak'),
};

// ─── Campaigns / Offers ──────────────────────────────────
export const offersApi = {
  list: (params?: { category?: string; page?: number; view?: string }) =>
    api.get('/offers', { params }),
  categoryCounts: (prefix?: string) =>
    api.get('/offers/category-counts', { params: prefix ? { prefix } : {} }),
  get: (id: string) => api.get(`/offers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/offers', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/offers/${id}`, data),
  pause: (id: string) => api.patch(`/offers/${id}/pause`),
  cancel: (id: string) => api.delete(`/offers/${id}`),
};

// ─── Completions ─────────────────────────────────────────
export const completionsApi = {
  submit: (data: { campaignId: string; proof: { type: string; textContent?: string } }) =>
    api.post('/completions', data),
  uploadProof: (id: string, file: File) => {
    const form = new FormData();
    form.append('screenshot', file);
    return api.post(`/completions/${id}/proof`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (params?: { view?: string; status?: string; page?: number }) =>
    api.get('/completions', { params }),
  review: (id: string, action: 'approve' | 'reject', reason?: string) =>
    api.patch(`/completions/${id}/review`, { action, reason }),
  dispute: (id: string, reason: string) =>
    api.patch(`/completions/${id}/dispute`, { reason }),
};

// ─── Payments (Deposits & Withdrawals) ───────────────────
export const paymentsApi = {
  getAddresses: () => api.get('/payments/addresses'),
  submitDeposit: (data: {
    amount: number;
    paymentMethod: string;
    txid: string;
    balanceTarget?: 'main' | 'ad';
  }) => api.post('/payments/deposit', data),
  submitWithdrawal: (data: {
    amount: number;
    paymentMethod: string;
    destinationAddress: string;
    destinationNote?: string;
  }) => api.post('/payments/withdraw', data),
  myPayments: (params?: { type?: string; status?: string; page?: number }) =>
    api.get('/payments/my', { params }),
};

// ─── Admin Management ───────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/stats'),
  analytics: () => api.get('/admin/analytics'),
  payouts: (page = 1) => api.get(`/admin/payouts?page=${page}`),
  handlePayout: (id: string, action: 'approve' | 'reject', reason?: string) =>
    api.patch(`/admin/payouts/${id}`, { action, reason }),
  disputes: () => api.get('/admin/disputes'),
  resolveDispute: (id: string, resolution: 'approve_worker' | 'reject_worker') =>
    api.patch(`/admin/disputes/${id}`, { resolution }),
  users: (page = 1, search?: string) =>
    api.get('/admin/users', { params: { page, search } }),
  userDetail: (id: string) => api.get(`/admin/users/${id}`),
  banUser: (id: string, ban: boolean, reason?: string) =>
    api.patch(`/admin/users/${id}/ban`, { ban, reason }),
  adjustBalance: (id: string, amount: number, balanceType: 'main' | 'ad', note?: string) =>
    api.patch(`/admin/users/${id}/balance`, { amount, balanceType, note }),
  changeRole: (id: string, roles: string[]) =>
    api.patch(`/admin/users/${id}/role`, { roles }),
  adminSocialLink: (id: string, platform: string, handle: string | null) =>
    api.patch(`/admin/users/${id}/social`, { platform, handle }),
  payments: (params?: { type?: string; status?: string; page?: number }) =>
    api.get('/admin/payments', { params }),
  handlePayment: (id: string, action: 'approve' | 'reject', adminNote?: string) =>
    api.patch(`/payments/admin/${id}`, { action, adminNote }),
};
