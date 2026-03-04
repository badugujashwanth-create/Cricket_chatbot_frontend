const summaryGrid = document.querySelector('#summary-grid');
const playerList = document.querySelector('#player-list');
const metricsGrid = document.querySelector('#metrics-grid');
const matchList = document.querySelector('#match-list');
const insightList = document.querySelector('#insight-list');
const chatResponse = document.querySelector('#chat-response');
const queryForm = document.querySelector('#player-query-form');
const queryInput = document.querySelector('#query-input');
const quickPrompts = document.querySelector('#quick-prompts');
const metricsToggle = document.querySelector('#metrics-toggle');
const liveScoreboard = document.querySelector('#live-scoreboard');
const liveMomentumCard = document.querySelector('#live-momentum-card');
const livePlayersCard = document.querySelector('#live-players-card');
const liveCommentaryCard = document.querySelector('#live-commentary-card');
const liveStatusChip = document.querySelector('#live-status-chip');
const liveRefreshButton = document.querySelector('#live-refresh-button');

const state = {
  metrics: [],
  metricsExpanded: false,
  sessionId: null,
  liveSnapshot: null,
  liveLastQuery: '',
  liveRefreshTimer: null
};

try {
  state.sessionId = window.localStorage.getItem('cricket-chat-session-id') || null;
} catch (_) {
  state.sessionId = null;
}

const TEAM_AVATAR_COLORS = {
  India: { bg: '#dff4ff', fg: '#0b6dc8', ring: '#a7d6ff' },
  Australia: { bg: '#fff4cf', fg: '#8c6a00', ring: '#f5d98e' },
  England: { bg: '#f0e9ff', fg: '#5f3dc4', ring: '#d5c6ff' },
  Pakistan: { bg: '#dff8eb', fg: '#0f8f5b', ring: '#9fe5c1' },
  'New Zealand': { bg: '#edf1f7', fg: '#3c4a5d', ring: '#cfd9e8' },
  'South Africa': { bg: '#e7fff1', fg: '#0c8b4d', ring: '#b4eccf' },
  'Sri Lanka': { bg: '#e8efff', fg: '#3759c7', ring: '#bfccff' }
};

const QUICK_PROMPTS = [
  'India',
  'Virat Kohli',
  'Who will win India vs Australia?',
  'How many runs might Kohli score next match?',
  'Top predicted performer today'
];

async function fetchJson(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = 'Unable to load data';
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
    } catch (_) {
      // ignore non-json body
    }
    throw new Error(message);
  }
  return response.json();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getInitials(name = '') {
  const words = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getAvatarPalette(team = '', seed = '') {
  const mapped = TEAM_AVATAR_COLORS[team];
  if (mapped) return mapped;

  const source = `${team}|${seed}` || 'cricket';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue} 90% 95%)`,
    fg: `hsl(${hue} 55% 35%)`,
    ring: `hsl(${hue} 70% 84%)`
  };
}

function renderAvatar(name = '', team = '', size = 'md') {
  const initials = getInitials(name);
  const palette = getAvatarPalette(team, name);
  const style = `--avatar-bg:${palette.bg};--avatar-fg:${palette.fg};--avatar-ring:${palette.ring};`;

  return `
    <span class="avatar-circle avatar-${size}" style="${style}" aria-hidden="true">
      <span class="avatar-inner">${initials || '&#127951;'}</span>
    </span>
  `;
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function getFormIndicator(player = {}) {
  const scores = Array.isArray(player?.stats?.recentScores) ? player.stats.recentScores : [];
  if (scores.length < 2) {
    return { label: 'No form data', tone: 'flat', meta: 'Recent trend unavailable' };
  }

  const split = Math.max(1, Math.floor(scores.length / 2));
  const earlier = average(scores.slice(0, split));
  const recent = average(scores.slice(-split));
  const delta = recent - earlier;
  const baseline = Math.max(Math.abs(earlier), 1);
  const ratio = delta / baseline;

  let label = 'Steady';
  let tone = 'flat';
  if (ratio > 0.15) {
    label = 'Rising';
    tone = 'up';
  } else if (ratio < -0.15) {
    label = 'Dip';
    tone = 'down';
  }

  return { label, tone, meta: `Recent avg ${average(scores).toFixed(1)}` };
}

function getPrimaryStatTiles(player = {}) {
  const { stats = {} } = player;
  const tiles = [];
  if (typeof stats.runs === 'number') tiles.push({ label: 'Runs', value: stats.runs });
  if (typeof stats.wickets === 'number') tiles.push({ label: 'Wickets', value: stats.wickets });
  if (typeof stats.strikeRate === 'number' && stats.strikeRate > 0) tiles.push({ label: 'Strike rate', value: stats.strikeRate });
  if (typeof stats.economy === 'number' && stats.economy > 0) tiles.push({ label: 'Economy', value: stats.economy });
  if (typeof stats.average === 'number' && stats.average > 0) tiles.push({ label: 'Average', value: stats.average });
  return tiles.slice(0, 5);
}

function formatTeamRole(player = {}) {
  const team = player.team ? escapeHtml(player.team) : 'Unknown team';
  const role = player.role ? escapeHtml(player.role) : 'Unknown role';
  return `${team} | ${role}`;
}

function renderStatTiles(tiles = []) {
  return `
    <div class="player-stat-grid">
      ${tiles
        .map(
          (tile) => `
        <div class="player-stat-tile">
          <span>${escapeHtml(tile.label)}</span>
          <strong>${escapeHtml(tile.value)}</strong>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderSummary(summary = {}) {
  summaryGrid.innerHTML = Object.entries(summary)
    .map(
      ([label, value]) => `
      <article class="summary-card">
        <h3>${escapeHtml(label.replace('-', ' '))}</h3>
        <p class="value">${escapeHtml(value)}</p>
      </article>
    `
    )
    .join('');
}

function renderPlayers(data = []) {
  const spotlight = data.slice(0, 4);
  playerList.innerHTML = spotlight
    .map((player) => {
      const form = getFormIndicator(player);
      const tiles = getPrimaryStatTiles(player);
      const specialties = player.specialties?.slice(0, 2).join(' | ');

      return `
        <article class="player-card">
          <div class="player-card-head">
            <div class="player-ident">
              ${renderAvatar(player.name, player.team, 'md')}
              <div>
                <h3>${escapeHtml(player.name)}</h3>
                <p class="player-role-line">${formatTeamRole(player)}</p>
              </div>
            </div>
            <div class="form-pill is-${form.tone}">
              <span class="dot"></span>
              <span>${escapeHtml(form.label)}</span>
            </div>
          </div>
          ${renderStatTiles(tiles)}
          <div class="player-card-foot">
            <p class="player-form-meta">${escapeHtml(form.meta)}</p>
            <p class="muted">${specialties ? escapeHtml(specialties) : 'Versatile contributor'}</p>
          </div>
        </article>
      `;
    })
    .join('');
}

function isPlaceholderMetric(metric = {}) {
  return String(metric.value || '').toLowerCase().includes('awaiting');
}

function renderMetricsToggle(total) {
  if (!metricsToggle) return;
  const shouldShowToggle = total > 6;
  metricsToggle.hidden = !shouldShowToggle;
  if (!shouldShowToggle) return;
  metricsToggle.textContent = state.metricsExpanded ? 'Show fewer' : `Show more (${total - 6})`;
}

function renderMetrics(list = []) {
  state.metrics = list;
  const preview = state.metricsExpanded ? list : list.slice(0, 6);

  metricsGrid.innerHTML = preview
    .map(
      (metric) => `
      <article class="metric-card ${isPlaceholderMetric(metric) ? 'is-placeholder' : ''}">
        <h3>${escapeHtml(metric.label)}</h3>
        <p class="value">${escapeHtml(metric.value)}</p>
        <p class="muted">${escapeHtml(metric.detail)}</p>
      </article>
    `
    )
    .join('');

  renderMetricsToggle(list.length);
}

function renderMatches(matches = []) {
  matchList.innerHTML = matches
    .map(
      (match) => `
      <article class="match-card">
        <h3>${escapeHtml(match.teams?.[0] || 'Team A')} vs ${escapeHtml(match.teams?.[1] || 'Team B')}</h3>
        <p>${escapeHtml(match.date || '')} | ${escapeHtml(match.venue || '')}</p>
        <p>${escapeHtml(match.result || 'Result unavailable')}</p>
        <div class="tags">
          ${(match.highlights || []).map((bit) => `<span>${escapeHtml(bit)}</span>`).join('')}
        </div>
      </article>
    `
    )
    .join('');
}

function renderInsights(list = []) {
  insightList.innerHTML = list
    .map(
      (insight) => `
      <article class="insight-card">
        <h3>${escapeHtml(insight.theme)}</h3>
        <p>${escapeHtml(insight.note)}</p>
      </article>
    `
    )
    .join('');
}

function generateStatLine(stats = {}) {
  const bits = [];
  if (stats.matches) bits.push(`${stats.matches} matches`);
  if (stats.runs) bits.push(`${stats.runs} runs`);
  if (stats.wickets) bits.push(`${stats.wickets} wickets`);
  if (stats.average) bits.push(`avg ${stats.average}`);
  if (stats.strikeRate) bits.push(`SR ${stats.strikeRate}`);
  if (stats.economy) bits.push(`econ ${stats.economy}`);
  return bits.length ? bits.join(' | ') : 'Stats pending for this profile';
}

function formatPlayerDetailCard(player) {
  const form = getFormIndicator(player);
  return `
    <article class="chat-card">
      <div class="chat-card-head">
        <div class="player-ident">
          ${renderAvatar(player.name, player.team, 'sm')}
          <div>
            <h4>${escapeHtml(player.name)}</h4>
            <p class="chat-subtle">${formatTeamRole(player)}</p>
          </div>
        </div>
        <div class="form-pill is-${form.tone}">
          <span class="dot"></span>
          <span>${escapeHtml(form.label)}</span>
        </div>
      </div>
      ${renderStatTiles(getPrimaryStatTiles(player).slice(0, 4))}
      <p>${escapeHtml(generateStatLine(player.stats))}</p>
      <p class="chat-subtle">${escapeHtml((player.specialties || []).join(', ') || 'Versatile contributor')}</p>
    </article>
  `;
}

function formatMatchList(matches = []) {
  if (!matches.length) {
    return '<p class="chat-subtle">No related matches found in the current indexed dataset.</p>';
  }

  return `
    <ul class="chat-list">
      ${matches
        .map(
          (match) => `
          <li>
            <strong>${escapeHtml(match.teams?.[0] || 'Team A')} vs ${escapeHtml(match.teams?.[1] || 'Team B')}</strong>
            <span>${escapeHtml(match.date || '')} | ${escapeHtml(match.venue || '')}</span>
            <span>${escapeHtml(match.result || 'Result unavailable')}</span>
          </li>
        `
        )
        .join('')}
    </ul>
  `;
}

function renderMiniStatGrid(items = []) {
  if (!items.length) return '';
  return `
    <div class="player-stat-grid">
      ${items
        .map(
          (item) => `
        <div class="player-stat-tile">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function formatClarificationOptions(options = []) {
  if (!options.length) return '';
  return `
    <div class="quick-prompts" aria-label="Clarification options">
      ${options
        .map(
          (option) => `
        <button
          type="button"
          class="prompt-chip"
          data-prompt="${escapeHtml(option.value || option.label || '')}"
          title="${escapeHtml(option.meta || '')}"
        >
          ${escapeHtml(option.label || option.value || '')}
        </button>
      `
        )
        .join('')}
    </div>
  `;
}

function formatLeaderboard(rows = []) {
  if (!rows.length) return '<p class="chat-subtle">No leaderboard rows available.</p>';
  return `
    <ul class="chat-list">
      ${rows
        .map(
          (row) => `
          <li>
            <strong>#${escapeHtml(row.rank)} ${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.team || '')}</span>
            <span>${escapeHtml(row.value)}${row.meta ? ` | ${escapeHtml(row.meta)}` : ''}</span>
          </li>
        `
        )
        .join('')}
    </ul>
  `;
}

function formatFactorsList(factors = []) {
  if (!Array.isArray(factors) || !factors.length) return '';
  return `
    <article class="chat-card">
      <h4>Key factors</h4>
      <ul class="chat-list">
        ${factors.map((factor) => `<li><span>${escapeHtml(factor)}</span></li>`).join('')}
      </ul>
    </article>
  `;
}

function formatConfidenceCard(payload = {}) {
  if (typeof payload.confidence !== 'number' && !payload.confidenceLabel) return '';
  const percent = typeof payload.confidence === 'number' ? `${Math.round(payload.confidence * 100)}%` : 'N/A';
  const label = payload.confidenceLabel || 'N/A';
  return `
    <article class="chat-card">
      <h4>Prediction confidence</h4>
      ${renderMiniStatGrid([
        { label: 'Confidence', value: label },
        { label: 'Score', value: percent }
      ])}
      <p class="chat-subtle">Confidence reflects dataset coverage, sample size, and matchup context availability.</p>
    </article>
  `;
}

function formatSemanticResults(semantic = {}) {
  const rows = Array.isArray(semantic.results) ? semantic.results : [];
  if (!rows.length) return '';

  return `
    <article class="chat-card">
      <h4>Smart matches from your data</h4>
      <ul class="chat-list">
        ${rows
          .map((row) => {
            const metaParts = [row.type, row.metaLine].filter(Boolean).join(' | ');
            return `
              <li>
                <strong>${escapeHtml(row.title || row.id || 'Match')}</strong>
                ${metaParts ? `<span>${escapeHtml(metaParts)}</span>` : ''}
                ${row.snippet ? `<p class="chat-subtle">${escapeHtml(row.snippet)}</p>` : ''}
              </li>
            `;
          })
          .join('')}
      </ul>
    </article>
  `;
}

function formatTeamDetailCard(team) {
  const stats = team.stats || {};
  const tiles = [
    { label: 'Matches', value: stats.matches || 0 },
    { label: 'Wins', value: stats.wins || 0 },
    { label: 'Win rate', value: `${stats.winRate || 0}%` },
    { label: 'Runs', value: stats.runs || 0 },
    { label: 'Avg score', value: stats.averageScore || 0 },
    { label: 'Team SR', value: stats.strikeRate || 0 }
  ];

  return `
    <article class="chat-card">
      <h4>${escapeHtml(team.name)}</h4>
      <p class="chat-subtle">${escapeHtml(team.region || 'CSV Indexed')}</p>
      ${renderMiniStatGrid(tiles)}
      ${Array.isArray(team.topBatters) && team.topBatters.length ? `<p class="chat-subtle">Top batters: ${escapeHtml(team.topBatters.slice(0, 3).map((p) => `${p.name} (${p.runs})`).join(', '))}</p>` : ''}
      ${Array.isArray(team.topBowlers) && team.topBowlers.length ? `<p class="chat-subtle">Top bowlers: ${escapeHtml(team.topBowlers.slice(0, 3).map((p) => `${p.name} (${p.wickets})`).join(', '))}</p>` : ''}
    </article>
  `;
}

function formatMatchDetailCard(match) {
  const inningsText = Array.isArray(match.innings)
    ? match.innings.map((inn) => `${inn.battingTeam}: ${inn.runs}/${inn.wickets} (${inn.overs})`).join(' | ')
    : '';

  return `
    <article class="chat-card">
      <h4>${escapeHtml((match.teams || []).join(' vs '))}</h4>
      <p class="chat-subtle">${escapeHtml(match.date || '')} | ${escapeHtml(match.venue || '')}</p>
      <p>${escapeHtml(match.result || 'Result unavailable')}</p>
      ${inningsText ? `<p class="chat-subtle">${escapeHtml(inningsText)}</p>` : ''}
      ${Array.isArray(match.topBatters) && match.topBatters.length ? `<p class="chat-subtle">Top batters: ${escapeHtml(match.topBatters.slice(0, 3).map((p) => `${p.name} ${p.runs}`).join(', '))}</p>` : ''}
      ${Array.isArray(match.topBowlers) && match.topBowlers.length ? `<p class="chat-subtle">Top bowlers: ${escapeHtml(match.topBowlers.slice(0, 3).map((p) => `${p.name} ${p.wickets}/${p.runsConceded}`).join(', '))}</p>` : ''}
    </article>
  `;
}

function formatLiveFetchedAt(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString();
}

function renderLiveProgress(progress = {}) {
  const completion = typeof progress?.completion === 'number' ? Math.max(0, Math.min(1, progress.completion)) : null;
  const current = progress.current || {};
  const percent = completion == null ? null : Math.round(completion * 100);
  return `
    <div class="live-progress-block">
      <div class="live-progress-meta">
        <span>${escapeHtml(current.battingTeam || 'Batting team')}</span>
        <span>${percent == null ? 'Progress N/A' : `${percent}%`}</span>
      </div>
      <div class="live-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent ?? 0}">
        <span class="live-progress-fill" style="width:${percent ?? 0}%"></span>
      </div>
      <p class="chat-subtle">
        ${current.target != null ? `Target ${escapeHtml(current.target)}.` : ''}
        ${current.runsNeeded != null ? ` Runs needed ${escapeHtml(current.runsNeeded)}.` : ''}
        ${current.ballsRemaining != null ? ` Balls left ${escapeHtml(current.ballsRemaining)}.` : ''}
      </p>
    </div>
  `;
}

function formatLiveCommentaryList(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="chat-subtle">Ball-by-ball commentary is not available from the current live feed.</p>';
  }
  return `
    <ul class="chat-list">
      ${items
        .slice(0, 8)
        .map(
          (item) => `
          <li>
            <strong>${escapeHtml(item.over || 'Live')}</strong>
            <span>${escapeHtml(item.text || '')}</span>
          </li>
        `
        )
        .join('')}
    </ul>
  `;
}

function formatLivePlayerHighlights(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="chat-subtle">Player highlights are not available for the current live feed.</p>';
  }
  return `
    <ul class="chat-list">
      ${items
        .slice(0, 6)
        .map(
          (item) => `
          <li>
            <strong>${escapeHtml(item.name || 'Player')}</strong>
            <span>${escapeHtml(item.primary || '')}${item.secondary ? ` | ${escapeHtml(item.secondary)}` : ''}</span>
          </li>
        `
        )
        .join('')}
    </ul>
  `;
}

function formatLiveScoreboardCard(snapshot = {}) {
  const live = snapshot.live || snapshot;
  const match = live.match || snapshot.match || {};
  const progress = live.progress || snapshot.progress || {};
  const innings = Array.isArray(match.innings) ? match.innings : [];
  const inningsRows = innings.length
    ? innings
        .slice(0, 4)
        .map(
          (inn) => `
        <div class="live-innings-row">
          <span>${escapeHtml(inn.team || 'Team')}</span>
          <strong>${escapeHtml(`${inn.runs ?? 0}/${inn.wickets ?? 0}`)}</strong>
          <span>${inn.overs != null ? escapeHtml(`${inn.overs} ov`) : ''}</span>
        </div>
      `
        )
        .join('')
    : '<p class="chat-subtle">Live score lines are not available.</p>';

  return `
    <div class="live-scoreboard-head">
      <p class="eyebrow">Live score</p>
      <h3>${escapeHtml(match.shortTitle || (Array.isArray(match.teams) ? match.teams.join(' vs ') : 'Current match'))}</h3>
      <p class="chat-subtle">${escapeHtml(match.statusText || live.message || 'Status unavailable')}</p>
      <p class="chat-subtle">${escapeHtml(match.series || '')}${match.venue ? ` | ${escapeHtml(match.venue)}` : ''}</p>
    </div>
    <div class="live-innings-list">${inningsRows}</div>
    ${renderLiveProgress(progress)}
    <p class="chat-subtle">Last update: ${escapeHtml(formatLiveFetchedAt(live.fetchedAt || snapshot.fetchedAt))}${live.stale ? ' (stale cache)' : ''}</p>
  `;
}

function formatLiveMomentumCard(snapshot = {}) {
  const live = snapshot.live || snapshot;
  const momentum = live.momentum || {};
  const score = typeof momentum.score === 'number' ? momentum.score : 0;
  const normalized = Math.max(-1, Math.min(1, score));
  const fillPercent = Math.round(((normalized + 1) / 2) * 100);
  const label = momentum.label || 'Balanced';

  return `
    <h4>Momentum</h4>
    <p class="live-momentum-label">${escapeHtml(label)}</p>
    <div class="live-momentum-track" aria-hidden="true">
      <span class="live-momentum-fill" style="width:${fillPercent}%"></span>
    </div>
    <p class="chat-subtle">${escapeHtml(momentum.phase || 'live')}</p>
    <p class="chat-subtle">${escapeHtml(momentum.explanation || 'Momentum explanation unavailable.')}</p>
  `;
}

function renderLiveWidgets(snapshot = {}) {
  state.liveSnapshot = snapshot;
  const live = snapshot || {};
  const isAvailable = Boolean(live.available);
  const message = live.message || '';

  if (liveStatusChip) {
    if (!live.configured) {
      liveStatusChip.textContent = 'Live feed: not configured';
      liveStatusChip.className = 'live-status-chip is-offline';
    } else if (!isAvailable) {
      liveStatusChip.textContent = 'Live feed: unavailable';
      liveStatusChip.className = 'live-status-chip is-warning';
    } else if (live.stale) {
      liveStatusChip.textContent = 'Live feed: cached';
      liveStatusChip.className = 'live-status-chip is-warning';
    } else {
      liveStatusChip.textContent = 'Live feed: active';
      liveStatusChip.className = 'live-status-chip is-live';
    }
  }

  if (!isAvailable) {
    const fallback = `<p class="chat-subtle">${escapeHtml(message || 'Live data unavailable.')}</p>`;
    if (liveScoreboard) {
      liveScoreboard.innerHTML = `
        <h4>Live scoreboard</h4>
        ${fallback}
        <p class="chat-subtle">Add your existing live cricket API env vars to enable real-time updates.</p>
      `;
    }
    if (liveMomentumCard) liveMomentumCard.innerHTML = `<h4>Momentum</h4>${fallback}`;
    if (livePlayersCard) livePlayersCard.innerHTML = `<h4>Player highlights</h4>${fallback}`;
    if (liveCommentaryCard) liveCommentaryCard.innerHTML = `<h4>Commentary</h4>${fallback}`;
    return;
  }

  if (liveScoreboard) liveScoreboard.innerHTML = formatLiveScoreboardCard(live);
  if (liveMomentumCard) liveMomentumCard.innerHTML = formatLiveMomentumCard(live);
  if (livePlayersCard) {
    livePlayersCard.innerHTML = `
      <h4>Player highlights</h4>
      ${formatLivePlayerHighlights(live.playerHighlights || live.match?.batters || [])}
    `;
  }
  if (liveCommentaryCard) {
    liveCommentaryCard.innerHTML = `
      <h4>Ball-by-ball updates</h4>
      ${formatLiveCommentaryList(live.match?.commentary || [])}
    `;
  }
}

function renderChat(query, payload = {}) {
  const safeQuery = escapeHtml(query);
  const safeSummary = escapeHtml(payload.summary || 'No answer available.');
  const typeLabel = payload.type ? payload.type.replace('-', ' ') : 'result';
  const sourceLabel = payload.dataSource ? `Source: ${payload.dataSource.toUpperCase()}` : '';

  if (payload.type === 'live') {
    state.liveLastQuery = query;
    if (payload.live) {
      renderLiveWidgets(payload.live);
    }
  }

  let content = `<p>${safeSummary}</p>`;

  if (payload.type === 'indexing') {
    const status = payload.status || {};
    const rowsDone = Number(status.rowsProcessed || 0).toLocaleString('en-US');
    content = `
      <p>${safeSummary}</p>
      <p class="chat-subtle">CSV indexing status: ${escapeHtml(status.status || 'starting')} | Rows processed: ${escapeHtml(rowsDone)}</p>
      <p class="chat-subtle">Try again in a short while. The bot will automatically switch to CSV-backed answers when indexing completes.</p>
    `;
  }

  if (payload.type === 'semantic') {
    const status = payload.status || {};
    const rowsDone = Number(status.rowsProcessed || 0).toLocaleString('en-US');
    content = `
      <p>${safeSummary}</p>
      ${formatSemanticResults(payload.semantic)}
      <p class="chat-subtle">Exact stats index: ${escapeHtml(status.status || 'starting')} | Rows processed: ${escapeHtml(rowsDone)}</p>
    `;
  }

  if (payload.type === 'player' && payload.player) {
    content = `
      <p>${safeSummary}</p>
      <div class="chat-grid">
        ${formatPlayerDetailCard(payload.player)}
        <article class="chat-card">
          <h4>Related match context</h4>
          ${formatMatchList(payload.relatedMatches || [])}
        </article>
      </div>
    `;
  }

  if (payload.type === 'team' && payload.team) {
    content = `
      <p>${safeSummary}</p>
      <div class="chat-grid">
        ${formatTeamDetailCard(payload.team)}
        <article class="chat-card">
          <h4>Recent indexed matches</h4>
          ${formatMatchList(payload.recentMatches || [])}
        </article>
      </div>
    `;
  }

  if (payload.type === 'comparison' && Array.isArray(payload.players)) {
    content = `
      <p>${safeSummary}</p>
      <div class="chat-grid">
        ${payload.players.map((player) => formatPlayerDetailCard(player)).join('')}
      </div>
    `;
  }

  if (payload.type === 'comparison' && Array.isArray(payload.teams)) {
    content = `
      <p>${safeSummary}</p>
      <div class="chat-grid">
        ${payload.teams.map((team) => formatTeamDetailCard(team)).join('')}
      </div>
    `;
  }

  if (payload.type === 'leaderboard') {
    content = `
      <p>${safeSummary}</p>
      <article class="chat-card">
        <h4>${escapeHtml(payload.title || 'Leaderboard')}</h4>
        ${formatLeaderboard(payload.rows || [])}
      </article>
    `;
  }

  if (payload.type === 'match' && payload.match) {
    content = `
      <p>${safeSummary}</p>
      <div class="chat-grid">
        ${formatMatchDetailCard(payload.match)}
      </div>
    `;
  }

  if (payload.type === 'live') {
    const liveObj = payload.live || {};
    content = `
      <p>${safeSummary}</p>
      <div class="chat-grid">
        <article class="chat-card live-card">
          ${formatLiveScoreboardCard(liveObj)}
        </article>
        <article class="chat-card live-card">
          ${formatLiveMomentumCard(liveObj)}
        </article>
      </div>
      <div class="chat-grid">
        <article class="chat-card">
          <h4>Player highlights</h4>
          ${formatLivePlayerHighlights(payload.playerHighlights || liveObj.playerHighlights || [])}
        </article>
        <article class="chat-card">
          <h4>Ball-by-ball updates</h4>
          ${formatLiveCommentaryList(payload.commentary || liveObj.commentary || liveObj.match?.commentary || [])}
        </article>
      </div>
    `;
  }

  if (payload.type === 'prediction') {
    content = `<p>${safeSummary}</p>`;

    if (payload.player) {
      content += `
        <div class="chat-grid">
          ${formatPlayerDetailCard(payload.player)}
          <article class="chat-card">
            <h4>Related match context</h4>
            ${formatMatchList(payload.relatedMatches || [])}
          </article>
        </div>
      `;
    }

    if (payload.team) {
      content += `
        <div class="chat-grid">
          ${formatTeamDetailCard(payload.team)}
          <article class="chat-card">
            <h4>Recent indexed matches</h4>
            ${formatMatchList(payload.recentMatches || payload.team?.recentMatches || [])}
          </article>
        </div>
      `;
    }

    if (Array.isArray(payload.teams)) {
      content += `
        <div class="chat-grid">
          ${payload.teams.map((team) => formatTeamDetailCard(team)).join('')}
        </div>
      `;
    }

    if (Array.isArray(payload.rows)) {
      content += `
        <article class="chat-card">
          <h4>${escapeHtml(payload.title || 'Prediction ranking')}</h4>
          ${formatLeaderboard(payload.rows || [])}
        </article>
      `;
    }
  }

  if (payload.type === 'clarification') {
    const optionCount = Array.isArray(payload.options) ? payload.options.length : 0;
    content = `
      <p>${safeSummary}</p>
      ${optionCount ? formatClarificationOptions(payload.options) : ''}
      ${optionCount ? '<p class="chat-subtle">Select an option or type a more specific name.</p>' : ''}
    `;
  }

  if (payload.type !== 'semantic' && payload.semantic?.results?.length) {
    content += `
      <div class="chat-grid">
        ${formatSemanticResults(payload.semantic)}
      </div>
    `;
  }

  if (payload.type === 'unsupported') {
    const suggestions = Array.isArray(payload.suggestions) && payload.suggestions.length
      ? payload.suggestions.join(', ')
      : 'Virat Kohli, India, match 1082591, top run scorers, most wickets';
    content = `
      <p>${safeSummary}</p>
      <p class="chat-subtle">Try: ${escapeHtml(suggestions)}</p>
    `;
  }

  if (Array.isArray(payload.analytics) && payload.analytics.length) {
    content += `
      <article class="chat-card">
        <h4>Key analytics</h4>
        ${renderMiniStatGrid(payload.analytics)}
      </article>
    `;
  }

  if (payload.type === 'prediction') {
    content += formatConfidenceCard(payload);
    content += formatFactorsList(payload.factors);
  }

  if (payload.insight) {
    content += `
      <article class="chat-card">
        <h4>Analyst note</h4>
        <p class="chat-subtle">${escapeHtml(payload.insight)}</p>
      </article>
    `;
  }

  chatResponse.innerHTML = `
    <div class="chat-result">
      <div class="chat-result-top">
        <span class="chat-pill">${escapeHtml(typeLabel)}</span>
        <span class="chat-query">Query: ${safeQuery}</span>
        ${sourceLabel ? `<span class="chat-query">${escapeHtml(sourceLabel)}</span>` : ''}
      </div>
      ${content}
    </div>
  `;
}

function renderChatLoading(query) {
  chatResponse.innerHTML = `
    <div class="chat-result is-loading">
      <div class="chat-result-top">
        <span class="chat-pill">searching</span>
        <span class="chat-query">Query: ${escapeHtml(query)}</span>
      </div>
      <p>Searching player/team profiles, match context, and leaderboard aggregates...</p>
    </div>
  `;
}

function renderChatError(query, error) {
  chatResponse.innerHTML = `
    <div class="chat-result is-error">
      <div class="chat-result-top">
        <span class="chat-pill">error</span>
        <span class="chat-query">Query: ${escapeHtml(query)}</span>
      </div>
      <p>${escapeHtml(error?.message || 'Unable to load data')}</p>
    </div>
  `;
}

function renderQuickPrompts() {
  if (!quickPrompts) return;
  quickPrompts.innerHTML = QUICK_PROMPTS.map(
    (prompt) => `<button type="button" class="prompt-chip" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`
  ).join('');

  quickPrompts.addEventListener('click', (event) => {
    const target = event.target.closest('[data-prompt]');
    if (!target || !queryInput) return;
    queryInput.value = target.dataset.prompt || '';
    queryInput.focus();
  });
}

queryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(queryForm);
  const query = formData.get('query')?.toString().trim();
  const submitButton = queryForm.querySelector('button[type="submit"]');
  if (!query) return;

  renderChatLoading(query);
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Searching...';
  }

  try {
    const result = await fetchJson('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'auto', query, sessionId: state.sessionId })
    });

    if (!result.success) throw new Error(result.message || 'No answer available');
    if (result.sessionId) {
      state.sessionId = result.sessionId;
      try {
        window.localStorage.setItem('cricket-chat-session-id', result.sessionId);
      } catch (_) {
        // ignore localStorage errors
      }
    }
    renderChat(query, result.payload);
  } catch (error) {
    renderChatError(query, error);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Ask';
    }
  }
});

if (metricsToggle) {
  metricsToggle.addEventListener('click', () => {
    state.metricsExpanded = !state.metricsExpanded;
    renderMetrics(state.metrics);
  });
}

async function hydrate() {
  try {
    const [summary, players, metrics, matches, insights] = await Promise.all([
      fetchJson('/api/summary'),
      fetchJson('/api/players'),
      fetchJson('/api/metrics'),
      fetchJson('/api/matches?limit=5'),
      fetchJson('/api/insights')
    ]);

    renderSummary(summary);
    renderPlayers(players);
    renderMetrics(metrics);
    renderMatches(matches);
    renderInsights(insights);
  } catch (error) {
    console.error(error);
    chatResponse.textContent = 'Unable to load dashboard data.';
  }
}

async function hydrateLive({ force = false, query = '' } = {}) {
  try {
    const search = new URLSearchParams();
    if (query) search.set('q', query);
    if (force) search.set('force', 'true');
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const snapshot = await fetchJson(`/api/live/score${suffix}`);
    renderLiveWidgets(snapshot);
  } catch (error) {
    console.error('Live widget refresh failed:', error);
    renderLiveWidgets({
      available: false,
      configured: true,
      message: error?.message || 'Unable to load live match data'
    });
  }
}

function startLiveAutoRefresh() {
  if (state.liveRefreshTimer) {
    clearInterval(state.liveRefreshTimer);
  }
  state.liveRefreshTimer = window.setInterval(() => {
    if (document.hidden) return;
    hydrateLive({ query: state.liveLastQuery });
  }, 15000);
}

document.addEventListener('DOMContentLoaded', () => {
  renderQuickPrompts();
  if (chatResponse) {
    chatResponse.addEventListener('click', (event) => {
      const target = event.target.closest('[data-prompt]');
      if (!target || !queryInput) return;
      queryInput.value = target.dataset.prompt || '';
      queryInput.focus();
    });
  }
  if (liveRefreshButton) {
    liveRefreshButton.addEventListener('click', () => {
      hydrateLive({ force: true, query: state.liveLastQuery });
    });
  }
  hydrate();
  hydrateLive();
  startLiveAutoRefresh();
});
