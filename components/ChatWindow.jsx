import { useEffect, useMemo, useRef, useState } from 'react';
import ResponseChart from './ResponseChart';
import { parseTextWithEntities } from './textParser';

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

const STATUS_STEPS = [
  '\u{1F9E0} Analyzing query intent...',
  '\u26A1 Fetching live scores & \u{1F4DA} scanning archives...',
  '\u270D\uFE0F Synthesizing expert response...'
];

function getDetectedEntities(payload = {}) {
  const payloadEntities = Array.isArray(payload?.detected_entities) ? payload.detected_entities : [];
  const extraEntities = Array.isArray(payload?.extra?.detected_entities)
    ? payload.extra.detected_entities
    : [];

  return [
    ...new Set(
      [...payloadEntities, ...extraEntities]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  ];
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

  if (type === 'playing_xi') {
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
  return String(payload?.image || primaryEntity?.image_url || payload?.extra?.image_url || '').trim();
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

function EntityRichText({ text = '', entities = [], onEntitySelect = null }) {
  const segments = useMemo(() => parseTextWithEntities(text, entities), [text, entities]);

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((segment, index) => {
        if (segment.type !== 'entity') {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }

        return (
          <span
            key={`entity-${segment.entity}-${index}`}
            role={onEntitySelect ? 'button' : undefined}
            tabIndex={onEntitySelect ? 0 : undefined}
            className={`mx-0.5 inline-flex translate-y-[-1px] rounded-full border px-2.5 py-1 text-[13px] font-semibold underline underline-offset-4 transition ${
              onEntitySelect
                ? 'cursor-pointer border-emerald-300/35 bg-emerald-400/12 text-emerald-200 decoration-emerald-300/60 hover:border-emerald-300/60 hover:bg-emerald-400/18 hover:text-emerald-100'
                : 'border-emerald-300/20 bg-emerald-400/8 text-emerald-200 decoration-emerald-300/40'
            }`}
            onClick={() => onEntitySelect && onEntitySelect(segment.entity)}
            onKeyDown={(event) => {
              if (!onEntitySelect) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEntitySelect(segment.entity);
              }
            }}
          >
            {segment.value}
          </span>
        );
      })}
    </div>
  );
}

function SourcePills({ sources = [] }) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {sources.map((source) => (
        <span
          key={source}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300"
        >
          {source}
        </span>
      ))}
    </div>
  );
}

function ResponseCard({ payload = {}, fallbackContent = '', onEntitySelect = null }) {
  const stats = payload?.stats && typeof payload.stats === 'object' ? Object.entries(payload.stats) : [];
  const extra = payload?.extra && typeof payload.extra === 'object' ? payload.extra : {};
  const rows = Array.isArray(extra.rows) ? extra.rows : [];
  const recentMatches = Array.isArray(extra.recent_matches) ? extra.recent_matches : [];
  const players = Array.isArray(extra.players) ? extra.players : [];
  const responseImage = getResponseImage(payload);
  const responseDescription = getResponseDescription(payload);
  const detectedEntities = getDetectedEntities(payload);
  const summaryText = payload.summary || fallbackContent;

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/88 shadow-[0_26px_60px_rgba(0,0,0,0.34)]">
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
                    Context Snapshot
                  </p>
                  <p className="text-sm leading-7 text-slate-200">{responseDescription}</p>
                </>
              ) : responseImage ? (
                <p className="text-sm leading-7 text-slate-300">
                  Verified cricket profile image attached to this response.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="text-sm leading-7 text-slate-100 sm:text-[15px]">
          <EntityRichText
            text={summaryText}
            entities={detectedEntities}
            onEntitySelect={onEntitySelect}
          />
        </div>

        <SourcePills sources={Array.isArray(extra.sources) ? extra.sources : []} />

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

        <ResponseChart chartData={extra.chartData} />
        {renderResponseRows(rows)}
        {renderSquadPlayers(players, payload.type)}
        {renderRecentMatches(recentMatches)}
      </div>
    </div>
  );
}

function StatusBubble({ initialContent = '' }) {
  const [stepIndex, setStepIndex] = useState(() => {
    const initialIndex = STATUS_STEPS.indexOf(String(initialContent || '').trim());
    return initialIndex >= 0 ? initialIndex : 0;
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % STATUS_STEPS.length);
    }, 1500);

    return () => window.clearInterval(timerId);
  }, []);

  return (
    <div className="max-w-[540px] rounded-[26px] border border-sky-300/10 bg-sky-400/8 px-4 py-3 text-sm text-sky-100 shadow-[0_16px_34px_rgba(2,12,27,0.22)] backdrop-blur-sm sm:px-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/70">
        System Status
      </p>
      <div className="flex items-center gap-3 italic">
        <span className="inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sky-300" />
        <span className="animate-pulse whitespace-pre-wrap">{STATUS_STEPS[stepIndex]}</span>
      </div>
    </div>
  );
}

function CricbuzzMicroCard({ entity = '', cardState = null, onClose = null }) {
  const player = cardState?.data || null;
  const statEntries = player?.stats && typeof player.stats === 'object' ? Object.entries(player.stats) : [];

  return (
    <div className="mt-3 max-w-[460px] rounded-[24px] border border-sky-300/16 bg-slate-950/82 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/70">
            Cricbuzz Micro-Card
          </p>
          <p className="mt-1 text-base font-semibold text-white">{entity}</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
          onClick={onClose}
        >
          Dismiss
        </button>
      </div>

      {cardState?.status === 'loading' ? (
        <div className="flex items-center gap-3 text-sm italic text-sky-100">
          <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
          Loading Cricbuzz profile...
        </div>
      ) : null}

      {cardState?.status === 'error' ? (
        <p className="text-sm leading-6 text-rose-200">
          {cardState.error || 'Unable to load the Cricbuzz micro-card right now.'}
        </p>
      ) : null}

      {cardState?.status === 'ready' && player ? (
        <div className="space-y-4">
          {(player.image_url || player.description) ? (
            <div className={`grid gap-4 ${player.image_url ? 'sm:grid-cols-[88px,minmax(0,1fr)]' : ''}`}>
              {player.image_url ? (
                <img
                  src={player.image_url}
                  alt={player.name || entity}
                  className="h-24 w-24 rounded-2xl object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{player.name || entity}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {[player.team, player.country, player.role].filter(Boolean).join(' | ')}
                </p>
                {player.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-200">{player.description}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {(player.batting_style || player.bowling_style) ? (
            <div className="flex flex-wrap gap-2">
              {player.batting_style ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                  Batting: {player.batting_style}
                </span>
              ) : null}
              {player.bowling_style ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                  Bowling: {player.bowling_style}
                </span>
              ) : null}
            </div>
          ) : null}

          {statEntries.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {statEntries.slice(0, 6).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {formatStatLabel(label)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{formatStatValue(value)}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AssistantMessage({ message = {} }) {
  const [activeEntity, setActiveEntity] = useState('');
  const [entityCards, setEntityCards] = useState({});
  const detectedEntities = getDetectedEntities(message.payload || {});

  async function handleEntitySelect(entity) {
    const cleanEntity = String(entity || '').trim();
    if (!cleanEntity) return;

    if (activeEntity === cleanEntity) {
      setActiveEntity('');
      return;
    }

    setActiveEntity(cleanEntity);
    if (entityCards[cleanEntity]) return;

    setEntityCards((current) => ({
      ...current,
      [cleanEntity]: {
        status: 'loading'
      }
    }));

    try {
      const response = await fetch(`/api/cricbuzz/player-card?name=${encodeURIComponent(cleanEntity)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          String(payload?.message || payload?.error || '').trim() ||
            'Unable to load the Cricbuzz micro-card right now.'
        );
      }

      setEntityCards((current) => ({
        ...current,
        [cleanEntity]: {
          status: 'ready',
          data: payload.player || null
        }
      }));
    } catch (error) {
      setEntityCards((current) => ({
        ...current,
        [cleanEntity]: {
          status: 'error',
          error: error?.message || 'Unable to load the Cricbuzz micro-card right now.'
        }
      }));
    }
  }

  const activeCard = activeEntity ? entityCards[activeEntity] : null;

  if (message.isStatus) {
    return <StatusBubble initialContent={message.content} />;
  }

  if (message.payload) {
    return (
      <div className="w-full max-w-[920px]">
        <ResponseCard
          payload={message.payload}
          fallbackContent={message.content}
          onEntitySelect={detectedEntities.length ? handleEntitySelect : null}
        />
        {activeEntity ? (
          <CricbuzzMicroCard
            entity={activeEntity}
            cardState={activeCard}
            onClose={() => setActiveEntity('')}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-[720px] rounded-[28px] border border-white/10 bg-slate-900/80 px-4 py-3 text-sm leading-7 text-slate-100 shadow-[0_18px_38px_rgba(0,0,0,0.24)] sm:px-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Assistant
      </p>
      <EntityRichText
        text={message.content}
        entities={detectedEntities}
        onEntitySelect={detectedEntities.length ? handleEntitySelect : null}
      />
      {activeEntity ? (
        <CricbuzzMicroCard
          entity={activeEntity}
          cardState={activeCard}
          onClose={() => setActiveEntity('')}
        />
      ) : null}
    </div>
  );
}

export default function ChatWindow({ messages = [], isLoading = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages, isLoading]);

  return (
    <section className="flex min-h-[68vh] flex-col bg-transparent">
      <div
        ref={containerRef}
        className="panel-scroll flex-1 space-y-6 overflow-y-auto px-1 py-3 sm:px-0"
      >
        {messages.length ? (
          messages.map((message) => {
            const isUser = message.role === 'user';

            return (
              <article
                key={message.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {isUser ? (
                  <div className="max-w-[76%] rounded-[30px] border border-white/10 bg-gradient-to-br from-cricket/16 to-sky-500/12 px-4 py-3 text-sm leading-7 text-slate-50 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur sm:px-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cricket/85">
                      Query
                    </p>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                ) : (
                  <AssistantMessage message={message} />
                )}
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/4 px-5 py-6 text-sm text-slate-400">
            Ask a cricket question and the assistant will build a layered analytical response here.
          </div>
        )}
      </div>
    </section>
  );
}
