'use client';
import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { paymentsApi } from '@/lib/api';

const METHODS = [
  { id: 'USDT_TRC20', label: 'USDT (TRC20)', icon: '💲' },
  { id: 'USDT_BEP20', label: 'USDT (BEP20)', icon: '💲' },
  { id: 'BTC',        label: 'Bitcoin (BTC)', icon: '₿'  },
  { id: 'LTC',        label: 'Litecoin (LTC)', icon: 'Ł' },
  { id: 'SOL',        label: 'Solana (SOL)',   icon: '◎' },
  { id: 'bank_card',  label: 'Bank Card',       icon: '💳' },
  { id: 'payeer',     label: 'Payeer',           icon: '💸' },
  { id: 'qiwi',       label: 'QIWI',             icon: '🥝' },
  { id: 'paypal',     label: 'PayPal',           icon: '🅿️' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mainBalance: number;
  onSuccess?: () => void;
}

export default function CryptoWithdrawModal({ isOpen, onClose, mainBalance, onSuccess }: Props) {
  const [method, setMethod] = useState(METHODS[0]);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const numAmount = parseFloat(amount);
    if (!amount || numAmount < 1) { setError('Minimum withdrawal is $1.00'); return; }
    if (numAmount > mainBalance) { setError(`Insufficient balance. Available: $${mainBalance.toFixed(2)}`); return; }
    if (!address || address.length < 5) { setError('Please enter your destination address'); return; }
    setLoading(true);
    try {
      await paymentsApi.submitWithdrawal({
        amount: numAmount,
        paymentMethod: method.id,
        destinationAddress: address.trim(),
        destinationNote: memo.trim() || undefined,
      });
      setSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit withdrawal.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setAddress('');
    setMemo('');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md v-card p-0 animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">💸 Withdraw Funds</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {success ? (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl">✅</div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Withdrawal Submitted!</h3>
              <p className="text-sm text-slate-500">Your withdrawal is being processed. Funds are debited from your balance and will be sent within 24 hours.</p>
              <button onClick={handleClose} className="v-btn-primary mt-2">Close</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-xs font-semibold text-slate-500">Available Balance</span>
                <span className="text-lg font-black text-emerald-600">${mainBalance.toFixed(2)}</span>
              </div>

              {/* Method Selection */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">WITHDRAWAL METHOD</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${
                        method.id === m.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-lg mb-0.5">{m.icon}</div>
                      <div className="truncate">{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT (USD)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Min. $1.00"
                    min={1}
                    max={mainBalance}
                    step={0.01}
                    className="v-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">DESTINATION ADDRESS / ACCOUNT</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Wallet address, card number, or account ID"
                    className="v-input w-full text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">MEMO / TAG <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Only needed for some networks (XRP, XLM, etc.)"
                    className="v-input w-full text-xs"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="v-btn-primary w-full py-3 font-bold flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Submitting...' : 'Request Withdrawal'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
