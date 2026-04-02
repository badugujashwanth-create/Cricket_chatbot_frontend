window.PlayerCard = function PlayerCard({ player, compact = false }) {
  const stats = player?.stats || {};
  const image = player?.image || '';
  const name = player?.name || 'Unknown Player';
  const description = player?.description || 'Wikipedia summary is not available yet.';
  const initials = name
    .split(' ')
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const statRows = [
    { label: 'Matches', value: stats.matches || '-' },
    { label: 'Runs', value: stats.runs || '-' },
    { label: 'Average', value: stats.average || '-' },
    { label: 'Strike Rate', value: stats.strikeRate || '-' }
  ];

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-shell/90 shadow-2xl shadow-black/30">
      <div className="relative">
        {image ? (
          <img
            src={image}
            alt={name}
            className={`w-full object-cover ${compact ? 'h-52' : 'h-64'}`}
          />
        ) : (
          <div
            className={`flex w-full items-center justify-center bg-gradient-to-br from-cricket/20 to-slate-800 text-4xl font-semibold text-cricket ${
              compact ? 'h-52' : 'h-64'
            }`}
          >
            {initials || '🏏'}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-12">
          <h3 className="text-xl font-semibold text-white">{name}</h3>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <p className="text-sm leading-7 text-slate-300">{description}</p>

        <div className="grid gap-3 rounded-2xl border border-white/8 bg-slate-950/55 p-4">
          {statRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-400">{row.label}</span>
              <span className="text-sm font-semibold text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
};
