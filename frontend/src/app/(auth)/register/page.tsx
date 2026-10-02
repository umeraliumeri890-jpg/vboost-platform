'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', referralCode: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.referralCode || undefined);
      router.push('/worker');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = form.password.length === 0 ? 0 : form.password.length < 8 ? 1 : form.password.length < 12 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-emerald-500'];

  return (
    <div className="card p-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
      <p className="text-slate-400 text-sm mb-6">Start earning in minutes — free forever</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 mb-4 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" type="text" placeholder="coolworker123" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} maxLength={30} />
        </div>
        <div>
          <label className="label">Email address</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input className="input pr-10" type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                    passwordStrength >= i ? strengthColor[passwordStrength] : 'bg-slate-700'
                  }`} />
                ))}
              </div>
              <span className="text-xs text-slate-400">{strengthLabel[passwordStrength]}</span>
            </div>
          )}
        </div>
        <div>
          <label className="label">Referral Code <span className="text-slate-500">(optional)</span></label>
          <input className="input" type="text" placeholder="friend_ref_code" value={form.referralCode}
            onChange={(e) => setForm({ ...form, referralCode: e.target.value })} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {loading ? 'Creating account...' : 'Create free account'}
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {['No credit card required', 'Start earning immediately', 'Both worker & advertiser access'].map((benefit) => (
          <div key={benefit} className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{benefit}
          </div>
        ))}
      </div>

      <p className="text-center text-slate-400 text-sm mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
      </p>
    </div>
  );
}
