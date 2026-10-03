'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { paymentsApi } from '@/lib/api';
import { AlertCircle, CheckCircle, Copy, Check, Loader2, Megaphone, ShieldAlert } from 'lucide-react';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NETWORKS = [
  { id: 'USDT_TRC20', label: 'USDT (TRC20)', icon: '💲', minDeposit: 1, color: 'text-emerald-500' },
  { id: 'USDT_BEP20', label: 'USDT (BEP20)', icon: '💲', minDeposit: 1, color: 'text-amber-500' },
  { id: 'BTC',        label: 'Bitcoin (BTC)', icon: '₿',  minDeposit: 1, color: 'text-orange-500' },
  { id: 'LTC',        label: 'Litecoin (LTC)', icon: 'Ł', minDeposit: 1, color: 'text-slate-400' },
  { id: 'SOL',        label: 'Solana (SOL)',   icon: '◎', minDeposit: 1, color: 'text-purple-500' },
];

export default function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const { user } = useAuth();
  const { currency, formatPrice } = useCurrency();
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('10');
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
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(amount);
    if (isNaN(num) || num < selectedNetwork.minDeposit) {
      setError(`Minimum deposit is $${selectedNetwork.minDeposit.toFixed(2)}.`);
      return;
    }
    if (!txid.trim() || txid.trim().length < 5) {
      setError('Please provide a valid Transaction ID (TXID / Reference ID).');
      return;
    }

    setLoading(true);
    try {
      await paymentsApi.submitDeposit({
        amount: num,
        paymentMethod: selectedNetwork.id,
        txid: txid.trim(),
        balanceTarget: 'ad',
      });
      setSuccess(true);
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Deposit submission failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('10');
    setTxid('');
    setError('');
    setSuccess(false);
    onClose();
  };

  const currentAddress = addresses[selectedNetwork.id] || 'Loading official deposit address...';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Top-Up Ad Balance (Manual Verification)" size="md">
      {success ? (
        <div className="text-center py-6 space-y-3">
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Deposit request submitted! Awaiting Admin verification.
          </h3>
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-left space-y-1.5 text-xs">
            <p className="font-bold text-amber-800 dark:text-amber-300">⏳ Request Status: Pending Review</p>
            <p className="text-slate-600 dark:text-slate-400">
              Your TXID (<code>{txid}</code>) has been sent to our administrator team for verification.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Funds (${amount} USD) will be credited to your <strong>Ad Balance</strong> once verified.
            </p>
          </div>
          <button onClick={handleClose} className="v-btn-primary mx-auto mt-4">
            Done
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

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-between border border-blue-200 dark:border-blue-800/60">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Current Ad Balance</p>
              <p className="text-lg font-bold text-blue-950 dark:text-blue-200">
                {formatPrice(user?.balances.ad || 0)}
              </p>
            </div>
            <Megaphone className="w-6 h-6 text-blue-500" />
          </div>

          {/* Network Selection */}
          <div>
            <label className="label">1. Select Network</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NETWORKS.map((net) => (
                <button
                  type="button"
                  key={net.id}
                  onClick={() => setSelectedNetwork(net)}
                  className={`p-2 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all ${
                    selectedNetwork.id === net.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-base">{net.icon}</span>
                  <span className="truncate">{net.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Platform Wallet Address */}
          <div>
            <label className="label">2. Official Platform Receiving Address</label>
            <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700">
              <code className="flex-1 text-xs text-slate-800 dark:text-slate-200 break-all font-mono">
                {currentAddress}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 hover:bg-blue-200 transition-colors"
                title="Copy Address"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Send only {selectedNetwork.label} to this address. Min deposit: ${selectedNetwork.minDeposit.toFixed(2)}.
            </p>
          </div>

          {/* Amount Field */}
          <div>
            <label className="label">3. Deposit Amount (USD)</label>
            <input
              type="number"
              min={selectedNetwork.minDeposit}
              step="any"
              className="v-input w-full text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 25.00"
              required
            />
          </div>

          {/* TXID / Reference ID */}
          <div>
            <label className="label">4. Transaction ID / Reference Hash (TXID)</label>
            <input
              type="text"
              placeholder="Paste transaction hash / TXID from wallet / exchange"
              className="v-input w-full text-xs font-mono"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              required
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              All top-up deposits require verification by our finance admins. Balance will update immediately upon approval.
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleClose} className="v-btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="v-btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Deposit Request'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
