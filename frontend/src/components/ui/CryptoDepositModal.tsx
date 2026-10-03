'use client';
import { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { paymentsApi } from '@/lib/api';

const NETWORKS = [
  { id: 'USDT_TRC20', label: 'USDT (TRC20)', icon: '💲', minDeposit: 1, color: 'text-green-600' },
  { id: 'USDT_BEP20', label: 'USDT (BEP20)', icon: '💲', minDeposit: 1, color: 'text-yellow-600' },
  { id: 'BTC',        label: 'Bitcoin (BTC)', icon: '₿',  minDeposit: 1, color: 'text-orange-500' },
  { id: 'LTC',        label: 'Litecoin (LTC)', icon: 'Ł', minDeposit: 1, color: 'text-gray-500' },
  { id: 'SOL',        label: 'Solana (SOL)',   icon: '◎', minDeposit: 1, color: 'text-purple-600' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  balanceTarget?: 'main' | 'ad';
}

export default function CryptoDepositModal({ isOpen, onClose, onSuccess, balanceTarget = 'ad' }: Props) {
  const [step, setStep] = useState<'select' | 'submit'>('select');
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [txid, setTxid] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      paymentsApi.getAddresses()
        .then((res) => setAddresses(res.data.data.addresses || {}))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleCopy = () => {
    const addr = addresses[selectedNetwork.id] || '';
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    setError('');
    const numAmount = parseFloat(amount);
    if (!amount || numAmount < 1) { setError('Minimum deposit is $1.00'); return; }
    if (!txid || txid.length < 10) { setError('Please enter a valid transaction ID (TXID)'); return; }
    setLoading(true);
    try {
      await paymentsApi.submitDeposit({
        amount: numAmount,
        paymentMethod: selectedNetwork.id,
        txid: txid.trim(),
        balanceTarget,
      });
      setSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit deposit request.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setAmount('');
    setTxid('');
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
          <h2 className="text-lg font-black text-slate-900 dark:text-white">💰 Crypto Deposit</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {success ? (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl">✅</div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Deposit request submitted! Awaiting Admin verification.</h3>
              <p className="text-sm text-slate-500">Your TXID has been logged. Funds will be credited to your balance upon Admin verification.</p>
              <button onClick={handleClose} className="v-btn-primary mt-2">Close</button>
            </div>
          ) : (
            <>
              {/* Network Selection */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">SELECT NETWORK</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {NETWORKS.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net)}
                      className={`p-3 rounded-xl border text-left text-sm font-semibold flex items-center gap-3 transition-all ${
                        selectedNetwork.id === net.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <span className="text-xl">{net.icon}</span>
                      <span>{net.label}</span>
                      {selectedNetwork.id === net.id && <span className="ml-auto text-blue-600 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deposit Address */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">PLATFORM DEPOSIT ADDRESS</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                  <code className="flex-1 text-xs text-slate-800 dark:text-slate-200 break-all font-mono">
                    {addresses[selectedNetwork.id] || 'Loading...'}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 hover:bg-blue-200 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Send only {selectedNetwork.label} to this address. Other assets will be lost.
                </p>
              </div>

              {/* Amount + TXID form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT SENT (USD)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 10.00"
                    min={1}
                    step={0.01}
                    className="v-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">TRANSACTION ID (TXID / TX HASH)</label>
                  <input
                    type="text"
                    value={txid}
                    onChange={(e) => setTxid(e.target.value)}
                    placeholder="Paste your transaction hash here"
                    className="v-input w-full text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Find it on your wallet or exchange after sending.</p>
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
                  {loading ? 'Submitting...' : 'Submit Deposit Request'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
