import { Activity, Database, Radio, ShieldCheck } from 'lucide-react';

function StatusPill({ icon: Icon, label, tone = 'neutral' }) {
  const toneClasses = {
    good: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    info: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
    neutral: 'border-white/10 bg-white/[0.04] text-slate-300',
    warning: 'border-amber-300/25 bg-amber-400/10 text-amber-100'
  };

  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </span>
  );
}

export default function Header({ liveConnected = false, runtimeStatus = null }) {
  const runtime = runtimeStatus?.runtime || {};
  const providers = runtime.providers && typeof runtime.providers === 'object' ? runtime.providers : {};
  const enabledProviders = Object.values(providers).filter(Boolean).length;
  const apiReady = Boolean(runtimeStatus);
  const archiveReady = runtimeStatus?.status === 'ready';

  return (
    <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200 shadow-glow">
              <Activity aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                Cricket Intelligence
              </h1>
              <p className="mt-0.5 text-sm leading-5 text-slate-400">
                Dataset-grounded answers with explicit availability
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Runtime status">
            <StatusPill
              icon={ShieldCheck}
              label={apiReady ? 'API ready' : 'API unavailable'}
              tone={apiReady ? 'good' : 'warning'}
            />
            <StatusPill
              icon={Database}
              label={archiveReady ? 'Archive ready' : 'Archive not loaded'}
              tone={archiveReady ? 'info' : 'neutral'}
            />
            <StatusPill
              icon={Radio}
              label={
                enabledProviders > 0
                  ? `${enabledProviders} external provider${enabledProviders === 1 ? '' : 's'} enabled`
                  : liveConnected
                    ? 'Update channel ready · providers off'
                    : 'External providers off'
              }
              tone={enabledProviders > 0 ? 'warning' : 'neutral'}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
