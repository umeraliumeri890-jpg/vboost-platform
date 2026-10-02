'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Campaign } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { completionsApi } from '@/lib/api';
import {
  ExternalLink, Upload, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, Clock, Image as ImageIcon
} from 'lucide-react';

interface TaskModalProps {
  campaign: Campaign | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TaskModal({ campaign, onClose, onSuccess }: TaskModalProps) {
  const { user, refreshUser } = useAuth();
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState<'details' | 'upload_proof' | 'success'>('details');
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [textProof, setTextProof] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(5);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (campaign) {
      setStep('details');
      setCompletionId(null);
      setFile(null);
      setFilePreview(null);
      setError('');
      setTimer(5);
      setTimerActive(false);

      // Pre-fill username if campaign expects handle and user has a linked account
      const category = campaign.category.toLowerCase();
      let defaultHandle = '';
      if (category.includes('instagram')) defaultHandle = user?.socialAccounts?.instagram || '';
      else if (category.includes('tiktok')) defaultHandle = user?.socialAccounts?.tiktok || '';
      else if (category.includes('vk')) defaultHandle = user?.socialAccounts?.vk || '';
      else if (category.includes('telegram')) defaultHandle = user?.socialAccounts?.telegram || '';
      else if (category.includes('youtube')) defaultHandle = user?.socialAccounts?.youtube || '';

      setTextProof(defaultHandle ? `@${defaultHandle}` : user?.username || '');
    }
  }, [campaign, user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  if (!campaign) return null;

  const requiresScreenshot = campaign.proofType === 'screenshot';
  const requiresText = ['text', 'username', 'url'].includes(campaign.proofType);

  const handleOpenLink = () => {
    window.open(campaign.targetUrl, '_blank', 'noopener,noreferrer');
    setTimerActive(true);
  };

  const handleAcceptTask = async () => {
    setError('');
    setLoading(true);
    try {
      const payload: { campaignId: string; proof: { type: string; textContent?: string } } = {
        campaignId: campaign._id,
        proof: {
          type: campaign.proofType,
          textContent: requiresText ? textProof : undefined,
        },
      };

      const { data } = await completionsApi.submit(payload);
      const cid = data.data.completion._id;
      setCompletionId(cid);

      if (requiresScreenshot) {
        setStep('upload_proof');
      } else {
        setStep('success');
        refreshUser();
        onSuccess();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to submit task. Please check requirements.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFilePreview(URL.createObjectURL(selected));
    }
  };

  const handleUploadProof = async () => {
    if (!file || !completionId) return;
    setError('');
    setLoading(true);
    try {
      await completionsApi.uploadProof(completionId, file);
      setStep('success');
      refreshUser();
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to upload screenshot proof.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!campaign} onClose={onClose} title={campaign.title} size="md">
      {step === 'success' ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Task Submitted!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              You will earn{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {formatPrice(campaign.payoutPerTask)}
              </strong>{' '}
              upon review (+10 XP).
            </p>
          </div>
          <button onClick={onClose} className="v-btn-primary mx-auto px-8">
            Done
          </button>
        </div>
      ) : step === 'upload_proof' ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {campaign.proofInstructions || 'Please upload a clear screenshot confirming you completed this task.'}
          </p>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                file
                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              {filePreview ? (
                <div className="space-y-2">
                  <img
                    src={filePreview}
                    alt="Proof preview"
                    className="max-h-40 mx-auto rounded-lg object-contain shadow-xs"
                  />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{file?.name}</p>
                  <p className="text-[10px] text-blue-600">Click to change screenshot</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click to select screenshot proof
                  </p>
                  <p className="text-[10px] text-slate-400">PNG, JPG, WebP up to 5MB</p>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="v-btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={handleUploadProof}
              disabled={!file || loading}
              className="v-btn-primary flex-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Screenshot'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target URL and Reward Box */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400">Reward</span>
              <p className="text-2xl font-black text-amber-500">
                {formatPrice(campaign.payoutPerTask)}
              </p>
            </div>

            <button
              onClick={handleOpenLink}
              className="v-btn-primary py-2 px-4 shadow-sm flex items-center gap-1.5"
            >
              <span>Go to Task</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <label className="label">Instructions</label>
            <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {campaign.instructions || 'Click the link above, complete the action, and submit proof.'}
            </div>
          </div>

          {/* Text/Username Proof input if needed */}
          {requiresText && (
            <div>
              <label className="label">
                {campaign.proofType === 'username'
                  ? 'Your Social Username / Handle'
                  : campaign.proofType === 'url'
                  ? 'Result URL'
                  : 'Proof Text'}
              </label>
              <input
                type="text"
                className="v-input"
                placeholder={campaign.proofType === 'username' ? '@your_handle' : 'Enter proof...'}
                value={textProof}
                onChange={(e) => setTextProof(e.target.value)}
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="v-btn-secondary flex-1">
              Cancel
            </button>

            <button
              onClick={handleAcceptTask}
              disabled={loading || (requiresText && !textProof.trim())}
              className="v-btn-primary flex-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : timerActive && timer > 0 ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  Wait {timer}s
                </span>
              ) : requiresScreenshot ? (
                <span className="flex items-center gap-1">
                  Next: Upload Proof
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              ) : (
                'Confirm & Claim'
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
