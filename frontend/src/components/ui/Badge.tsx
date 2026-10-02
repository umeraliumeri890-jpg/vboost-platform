import clsx from 'clsx';

const variants: Record<string, string> = {
  active:         'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40',
  pending_review: 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/40',
  approved:       'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40',
  auto_approved:  'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  rejected:       'bg-red-900/40 text-red-400 border border-red-700/40',
  submitted:      'bg-blue-900/40 text-blue-400 border border-blue-700/40',
  accepted:       'bg-slate-800 text-slate-300 border border-slate-700',
  paused:         'bg-orange-900/40 text-orange-400 border border-orange-700/40',
  completed:      'bg-slate-800 text-slate-300 border border-slate-700',
  cancelled:      'bg-red-900/40 text-red-400 border border-red-700/40',
  expired:        'bg-slate-800 text-slate-500 border border-slate-700',
  disputed:       'bg-purple-900/40 text-purple-400 border border-purple-700/40',
  draft:          'bg-slate-800 text-slate-400 border border-slate-700',
};

export default function Badge({ status }: { status: string }) {
  const cls = variants[status] || 'bg-slate-800 text-slate-400';
  return (
    <span className={clsx('badge', cls)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
