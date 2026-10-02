'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { dashboardApi } from '@/lib/api';
import { AlertCircle, CheckCircle, CreditCard, Loader2, Megaphone } from 'lucide-react';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const { user, refreshUser } = useAuth();
  const { currency } = useCurrency();
  const [amount, setAmount] = useState('500');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    const amountInUSD = currency === 'RUB' ? num / 90 : num;

    setLoading(true);
    try {
      await dashboardApi.topup({
        amount: amountInUSD,
        paymentMethod: 'Instant Test Deposit',
      });
      setSuccess(true);
      refreshUser();
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Top-up failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Top-Up Ad Balance" size="md">
      {success ? (
        <div className="text-center py-6">
          <CheckCircle className="w-14 h-14 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ad Balance Funded!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {amount} {currency} has been added to your Ad Balance for campaigns.
          </p>
          <button onClick={onClose} className="v-btn-primary mx-auto mt-6">
            Continue
          </button>
        </div>
      ) : (
        <form onSubmit={handleTopUp} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-between border border-blue-200 dark:border-blue-800/60">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Current Ad Balance</p>
              <p className="text-xl font-bold text-blue-950 dark:text-blue-200">
                ${(user?.balances.ad || 0).toFixed(2)} USD
              </p>
            </div>
            <Megaphone className="w-7 h-7 text-blue-500" />
          </div>

          <div>
            <label className="label">Quick Amount</label>
            <div className="grid grid-cols-4 gap-2">
              {['100', '250', '500', '1000'].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    amount === val
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  +{val} {currency}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Custom Amount ({currency})</label>
            <input
              type="number"
              min="1"
              step="any"
              className="v-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="v-btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="v-btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Top Up Now'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
