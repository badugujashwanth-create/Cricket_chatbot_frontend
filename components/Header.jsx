window.Header = function Header() {
  return (
    <header className="border-b border-white/10 bg-slate-950/55 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cricket/12 text-2xl shadow-glow">
            {'\u{1F3CF}'}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Cricket AI Assistant
            </h1>
            <p className="text-sm text-slate-400">
              One clear response block for players, teams, matches, comparisons, and records
            </p>
          </div>
        </div>
        <div className="hidden rounded-full border border-cricket/20 bg-cricket/10 px-3 py-1 text-xs font-medium text-cricket sm:block">
          Unified Response Mode
        </div>
      </div>
    </header>
  );
};
