function formatStatLabel(label = '') {
  return String(label || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function formatStatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function renderResponseRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Ranked Results
      </p>
      <div className="space-y-2">
        {rows.slice(0, 5).map((row, index) => (
          <div
            key={`${row.player || row.team || row.rank || index}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {row.rank ? `#${row.rank} ` : ''}
                {row.player || row.team || 'Record'}
              </p>
              {row.team ? <p className="text-xs text-slate-400">{row.team}</p> : null}
            </div>
            <p className="shrink-0 text-sm font-semibold text-cricket">{formatStatValue(row.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderRecentMatches(matches = []) {
  if (!Array.isArray(matches) || !matches.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Match Context
      </p>
      <div className="space-y-2">
        {matches.slice(0, 3).map((match) => (
          <div
            key={match.id || `${match.name}-${match.date}`}
            className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
          >
            <p className="text-sm font-medium text-white">{match.name || 'Match'}</p>
            <p className="mt-1 text-xs text-slate-400">
              {[match.date, match.venue, match.match_type].filter(Boolean).join(' | ')}
            </p>
            {match.summary ? <p className="mt-2 text-sm leading-6 text-slate-200">{match.summary}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderSquadPlayers(players = [], type = '') {
  if (!Array.isArray(players) || !players.length) return null;
  const isPlayingXi = type === 'playing_xi';

  if (isPlayingXi) {
    return (
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Playing XI
        </p>
        <div className="flex flex-wrap gap-2">
          {players.map((player, index) => (
            <span
              key={`${player}-${index}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              {player}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Squad Players
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player, index) => (
          <div
            key={`${player?.name || player}-${index}`}
            className="rounded-2xl border border-white/8 bg-white/5 p-3"
          >
            {player?.image ? (
              <img
                src={player.image}
                alt={player.name || 'Player'}
                className="mb-3 h-28 w-full rounded-2xl object-cover"
              />
            ) : null}
            <p className="text-sm font-semibold text-white">{player?.name || String(player)}</p>
            {player?.role ? <p className="mt-1 text-xs text-slate-400">{player.role}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function pickPrimaryEntity(extra = {}) {
  const entities = extra?.entities && typeof extra.entities === 'object' ? extra.entities : {};
  return entities.player || entities.team || entities.left || entities.right || {};
}

function getResponseImage(payload = {}) {
  const primaryEntity = pickPrimaryEntity(payload?.extra || {});
  return String(
    payload?.image ||
      primaryEntity?.image_url ||
      payload?.extra?.image_url ||
      ''
  ).trim();
}

function getResponseDescription(payload = {}) {
  const extra = payload?.extra && typeof payload.extra === 'object' ? payload.extra : {};
  const primaryEntity = pickPrimaryEntity(extra);
  return String(
    primaryEntity?.description ||
      extra?.player_description ||
      extra?.team_description ||
      primaryEntity?.short_description ||
      ''
  ).trim();
}

function ResponseCard({ payload = {}, fallbackContent = '' }) {
  const stats = payload?.stats && typeof payload.stats === 'object' ? Object.entries(payload.stats) : [];
  const extra = payload?.extra && typeof payload.extra === 'object' ? payload.extra : {};
  const rows = Array.isArray(extra.rows) ? extra.rows : [];
  const recentMatches = Array.isArray(extra.recent_matches) ? extra.recent_matches : [];
  const players = Array.isArray(extra.players) ? extra.players : [];
  const responseImage = getResponseImage(payload);
  const responseDescription = getResponseDescription(payload);

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/85 shadow-2xl shadow-black/30">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cricket/25 bg-cricket/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cricket">
            {payload.type || 'response'}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {payload.title || 'Cricket Response'}
          </h3>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {responseImage || responseDescription ? (
          <div
            className={`mb-5 grid gap-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4 ${
              responseImage ? 'sm:grid-cols-[180px,minmax(0,1fr)]' : ''
            }`}
          >
            {responseImage ? (
              <img
                src={responseImage}
                alt={payload.title || 'Cricket response'}
                className="h-44 w-full rounded-2xl object-cover sm:h-full"
              />
            ) : null}
            <div className="min-w-0">
              {responseDescription ? (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cricket/75">
                    Wikipedia Snapshot
                  </p>
                  <p className="text-sm leading-7 text-slate-200">
                    {responseDescription}
                  </p>
                </>
              ) : responseImage ? (
                <p className="text-sm leading-7 text-slate-300">
                  Verified cricket profile image attached to this response.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="whitespace-pre-line text-sm leading-7 text-slate-100 sm:text-[15px]">
          {payload.summary || fallbackContent}
        </div>

        {stats.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {stats.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {formatStatLabel(label)}
                </p>
                <p className="mt-2 text-base font-semibold text-white">{formatStatValue(value)}</p>
              </div>
            ))}
          </div>
        ) : null}

        {renderResponseRows(rows)}
        {renderSquadPlayers(players, payload.type)}
        {renderRecentMatches(recentMatches)}
      </div>
    </div>
  );
}

window.ChatWindow = function ChatWindow({ messages = [], isLoading = false }) {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages, isLoading]);

  return (
    <section className="flex min-h-[68vh] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-panel/80 shadow-2xl">
      <div
        ref={containerRef}
        className="panel-scroll flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.length ? (
          messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <article
                key={message.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={isUser ? 'max-w-[82%]' : 'w-full'}>
                  {isUser ? (
                    <div className="rounded-3xl border border-cricket/20 bg-cricket/12 px-4 py-3 text-sm leading-7 text-slate-100 sm:px-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cricket/80">
                        Query
                      </p>
                      <div className="whitespace-pre-line">{message.content}</div>
                    </div>
                  ) : message.payload ? (
                    <ResponseCard payload={message.payload} fallbackContent={message.content} />
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-slate-900/85 px-4 py-3 text-sm leading-7 text-slate-100 sm:px-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Assistant
                      </p>
                      <div className="whitespace-pre-line">{message.content}</div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-5 py-6 text-sm text-slate-400">
            Ask a cricket question and the assistant will return one structured response block.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="rounded-3xl border border-white/10 bg-slate-900/85 px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-cricket" />
                Building one clear cricket response...
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
