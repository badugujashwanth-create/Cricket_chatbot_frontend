export default function Header({ liveConnected = false }) {
  return (
    <header className="border-b border-white/10 bg-slate-950/55 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cricket/12 text-2xl shadow-glow">
            {'\u{1F3CF}'}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Cricket AI Assistant
            </h1>
            <p className="text-sm text-slate-400">
              Hybrid archive, live sync, visual comparisons, and push alerts
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="rounded-full border border-cricket/20 bg-cricket/10 px-3 py-1 text-xs font-medium text-cricket">
            Vite Response Mode
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              liveConnected
                ? 'border-sky-300/30 bg-sky-400/10 text-sky-200'
                : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            {liveConnected ? 'Live Push Connected' : 'Live Push Offline'}
          </div>
        </div>
      </div>
    </header>
  );
}
