import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveX,
  CircleAlert,
  Database,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck
} from 'lucide-react';
import ResponseChart from './ResponseChart';
import { parseTextWithEntities } from './textParser';

const STARTER_PROMPTS = [
  'What is LBW?',
  'Who won the 2011 World Cup?',
  'India team summary',
  'Show recent live scores'
];

const STATUS_STEPS = [
  'Classifying the question',
  'Checking local knowledge and archive availability',
  'Formatting a typed response'
];

function promptLabel(prompt = '') {
  return /live scores?/i.test(String(prompt || '')) ? 'Check live-score availability' : prompt;
}

function formatStatLabel(label = '') {
  return String(label || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function formatStatValue(value) {
  if (value === null || value === undefined || value === '') return 'Not available';
  return String(value);
}

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
        if (segment.type !== 'entity' || !onEntitySelect) {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }
        return (
          <button
            key={`entity-${segment.entity}-${index}`}
            type="button"
            className="mx-0.5 inline-flex min-h-8 translate-y-[-1px] items-center rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2.5 py-1 text-[13px] font-semibold text-emerald-100 underline decoration-emerald-300/60 underline-offset-4 transition hover:border-emerald-200/60 hover:bg-emerald-400/20"
            onClick={() => onEntitySelect(segment.entity)}
          >
            {segment.value}
          </button>
        );
      })}
    </div>
  );
}

function SourcePills({ sources = [] }) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Evidence
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <span
            key={source}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300"
          >
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

function RankedRows({ rows = [] }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Ranked results
      </p>
      <div className="space-y-2">
        {rows.slice(0, 5).map((row, index) => (
          <div
            key={`${row.player || row.team || row.rank || index}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {row.rank ? `#${row.rank} ` : ''}
                {row.player || row.team || 'Record'}
              </p>
              {row.team ? <p className="text-xs text-slate-400">{row.team}</p> : null}
            </div>
            <p className="shrink-0 text-sm font-semibold text-emerald-300">
              {formatStatValue(row.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentMatches({ matches = [] }) {
  if (!Array.isArray(matches) || !matches.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Match context
      </p>
      <div className="space-y-2">
        {matches.slice(0, 3).map((match) => (
          <div
            key={match.id || `${match.name}-${match.date}`}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <p className="text-sm font-medium text-white">{match.name || 'Match'}</p>
            <p className="mt-1 text-xs text-slate-400">
              {[match.date, match.venue, match.match_type].filter(Boolean).join(' · ')}
            </p>
            {match.summary ? <p className="mt-2 text-sm leading-6 text-slate-200">{match.summary}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SquadPlayers({ players = [], type = '' }) {
  if (!Array.isArray(players) || !players.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {type === 'playing_xi' ? 'Playing XI' : 'Squad players'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player, index) => {
          const playerName = player?.name || String(player);
          return (
            <div
              key={`${playerName}-${index}`}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
            >
              {player?.image ? (
                <img
                  src={player.image}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="mb-3 h-28 w-full rounded-xl object-cover"
                />
              ) : null}
              <p className="text-sm font-semibold text-white">{playerName}</p>
              {player?.role ? <p className="mt-1 text-xs text-slate-400">{player.role}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResponseCard({ payload = {}, fallbackContent = '', onEntitySelect = null, onPrompt = null }) {
  const extra = payload?.extra && typeof payload.extra === 'object' ? payload.extra : {};
  const unavailable = extra.evidence_state === 'unavailable';
  const stats = !unavailable && payload?.stats && typeof payload.stats === 'object'
    ? Object.entries(payload.stats)
    : [];
  const responseImage = unavailable ? '' : getResponseImage(payload);
  const responseDescription = unavailable ? '' : getResponseDescription(payload);
  const detectedEntities = getDetectedEntities(payload);
  const suggestions = Array.isArray(extra.suggestions) ? extra.suggestions.slice(0, 3) : [];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/[0.88] shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            {payload.type || 'response'}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {payload.title || 'Cricket response'}
          </h3>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {unavailable ? (
          <div className="mb-5 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-4 text-amber-50">
            <ArchiveX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div>
              <p className="text-sm font-semibold">Evidence unavailable</p>
              <p className="mt-1 text-sm leading-6 text-amber-100/80">
                The response type is preserved, but no verified archive statistics support this result.
              </p>
            </div>
          </div>
        ) : null}

        {responseImage || responseDescription ? (
          <div
            className={`mb-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${
              responseImage ? 'sm:grid-cols-[160px,minmax(0,1fr)]' : ''
            }`}
          >
            {responseImage ? (
              <img
                src={responseImage}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-40 w-full rounded-xl object-cover sm:h-full"
              />
            ) : null}
            {responseDescription ? (
              <div className="min-w-0">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
                  Context snapshot
                </p>
                <p className="text-sm leading-7 text-slate-200">{responseDescription}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="text-sm leading-7 text-slate-100 sm:text-[15px]">
          <EntityRichText
            text={payload.summary || fallbackContent}
            entities={detectedEntities}
            onEntitySelect={unavailable ? null : onEntitySelect}
          />
        </div>

        <SourcePills sources={Array.isArray(extra.sources) ? extra.sources : []} />

        {stats.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {formatStatLabel(label)}
                </p>
                <p className="mt-2 text-base font-semibold text-white">{formatStatValue(value)}</p>
              </div>
            ))}
          </div>
        ) : null}

        {!unavailable ? <ResponseChart chartData={extra.chartData} /> : null}
        {!unavailable ? <RankedRows rows={extra.rows} /> : null}
        {!unavailable ? <SquadPlayers players={extra.players} type={payload.type} /> : null}
        {!unavailable ? <RecentMatches matches={extra.recent_matches} /> : null}

        {suggestions.length && onPrompt ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Continue with
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="min-h-10 rounded-full border border-sky-300/20 bg-sky-400/[0.07] px-4 py-2 text-left text-sm font-medium text-sky-100 transition hover:border-sky-200/40 hover:bg-sky-400/[0.12]"
                  onClick={() => onPrompt(suggestion)}
                >
                  {promptLabel(suggestion)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBubble() {
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    const timerId = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % STATUS_STEPS.length);
    }, 1500);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-[580px] rounded-2xl border border-sky-300/15 bg-sky-400/[0.07] px-4 py-3 text-sm text-sky-100"
    >
      <div className="flex items-center gap-3">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
        <span>{STATUS_STEPS[stepIndex]}</span>
      </div>
    </div>
  );
}

function AssistantMessage({ message = {}, onPrompt = null }) {
  if (message.isStatus) return <StatusBubble />;

  if (message.payload) {
    return (
      <div className="w-full max-w-[940px]">
        <ResponseCard
          payload={message.payload}
          fallbackContent={message.content}
          onPrompt={onPrompt}
        />
      </div>
    );
  }

  return (
    <div
      role={message.isError ? 'alert' : undefined}
      className={`max-w-[720px] rounded-2xl border px-4 py-4 text-sm leading-7 shadow-lg sm:px-5 ${
        message.isError
          ? 'border-rose-300/20 bg-rose-400/[0.08] text-rose-100'
          : 'border-white/10 bg-slate-900/80 text-slate-100'
      }`}
    >
      <div className="flex gap-3">
        {message.isError ? <CircleAlert aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" /> : null}
        <p>{message.content}</p>
      </div>
    </div>
  );
}

function EmptyState({ runtimeStatus = null, onPrompt = null }) {
  const localKnowledgeReady = runtimeStatus?.runtime?.mode === 'deterministic_local';
  const archiveLoaded = runtimeStatus?.status === 'ready';

  return (
    <div className="grid min-h-[52vh] items-center gap-8 py-4 lg:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)] lg:py-8">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Evidence first
        </div>
        <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-5xl">
          Ask one question. See exactly what supports the answer.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Rules and curated history work in deterministic local mode. Archive statistics and live providers stay clearly unavailable until they are configured.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-200">
            <Search aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            {localKnowledgeReady ? 'Local knowledge ready' : 'Waiting for API'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-200">
            {archiveLoaded ? (
              <Database aria-hidden="true" className="h-4 w-4 text-sky-300" />
            ) : (
              <ArchiveX aria-hidden="true" className="h-4 w-4 text-slate-400" />
            )}
            {archiveLoaded ? 'Archive available' : 'Archive not loaded'}
          </span>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-slate-900/[0.72] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Try a verified path
        </p>
        <div className="mt-4 grid gap-3">
          {STARTER_PROMPTS.map((prompt, index) => (
            <button
              key={prompt}
              type="button"
              className="group flex min-h-[52px] items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/[0.08]"
              onClick={() => onPrompt?.(prompt)}
            >
              <span>{promptLabel(prompt)}</span>
              <span className="text-xs font-semibold text-slate-500 group-hover:text-emerald-300">
                0{index + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({
  messages = [],
  isLoading = false,
  runtimeStatus = null,
  onPrompt = null,
  onClear = null
}) {
  const endRef = useRef(null);

  useEffect(() => {
    if (!messages.length) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading]);

  if (!messages.length) {
    return <EmptyState runtimeStatus={runtimeStatus} onPrompt={onPrompt} />;
  }

  return (
    <section aria-label="Cricket question history" className="flex flex-1 flex-col">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current session</p>
          <p className="mt-1 text-sm text-slate-300">{messages.filter((message) => message.role === 'user').length} question(s)</p>
        </div>
        <button
          type="button"
          disabled={isLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          onClick={onClear}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Clear
        </button>
      </div>

      <div className="space-y-6">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <article key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              {isUser ? (
                <div className="max-w-[86%] rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.08] px-4 py-3 text-sm leading-7 text-slate-50 sm:max-w-[72%] sm:px-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
                    Question
                  </p>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              ) : (
                <AssistantMessage message={message} onPrompt={onPrompt} />
              )}
            </article>
          );
        })}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </section>
  );
}
