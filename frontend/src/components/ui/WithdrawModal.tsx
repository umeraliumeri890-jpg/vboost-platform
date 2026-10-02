'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { dashboardApi } from '@/lib/api';
import { AlertCircle, CheckCircle, CreditCard, Loader2, Wallet } from 'lucide-react';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const METHODS = [
  { id: 'bank_card', name: 'Bank Card (MIR / Visa / MC)', fee: '2%', min: 20 },
  { id: 'qiwi', name: 'QIWI Wallet', fee: '1%', min: 20 },
  { id: 'payeer', name: 'Payeer (RUB / USD)', fee: '0.5%', min: 10 },
  { id: 'crypto', name: 'Crypto USDT (TRC-20)', fee: '1 USDT', min: 50 },
  { id: 'paypal', name: 'PayPal (USD)', fee: '3%', min: 50 },
];

export default function WithdrawModal({ isOpen, onClose, onSuccess }: WithdrawModalProps) {
  const { user, refreshUser } = useAuth();
  const { currency, formatPrice } = useCurrency();
  const [method, setMethod] = useState('bank_card');
  const [amount, setAmount] = useState('20');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mainBalance = user?.balances.main ?? 0;
  // Convert 1 USD = 90 RUB baseline
  const mainBalanceInCurrency = currency === 'RUB' ? mainBalance * 90 : mainBalance;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }
    // Amount in USD for backend
    const amountInUSD = currency === 'RUB' ? num / 90 : num;

    if (amountInUSD > mainBalance) {
      setError(`Insufficient balance. You have ${formatPrice(mainBalance)}.`);
      return;
    }

    setLoading(true);
    try {
      await dashboardApi.withdraw({
        amount: amountInUSD,
        method,
        details,
      });
      setSuccess(true);
      refreshUser();
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Withdrawal failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Withdraw Funds" size="md">
      {success ? (
        <div className="text-center py-6">
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payout Requested!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your withdrawal of {amount} {currency} has been processed and logged in your ledger history.
          </p>
          <button onClick={onClose} className="v-btn-primary mx-auto mt-6">
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleWithdraw} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between border border-slate-200/60 dark:border-slate-700/60">
            <div>
              <p className="text-xs text-slate-500">Available to Withdraw</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatPrice(mainBalance)}
              </p>
            </div>
            <Wallet className="w-7 h-7 text-emerald-500" />
          </div>

          <div>
            <label className="label">Payment Destination</label>
            <div className="grid grid-cols-1 gap-2">
              {METHODS.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all ${
                    method === m.id
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500 text-blue-700 dark:text-blue-300 font-medium'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    {m.name}
                  </span>
                  <span className="text-xs text-slate-400">Min. {m.min} ₽</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Amount ({currency})</label>
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

          <div>
            <label className="label">Card / Wallet / Account Details</label>
            <input
              type="text"
              placeholder="e.g. 2202 2000 1234 5678 or +7 999 123-45-67"
              className="v-input"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="v-btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="v-btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Withdrawal'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
