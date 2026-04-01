const imageCache = new Map();

const STARTER_PROMPTS = [
  'Virat Kohli stats',
  'Compare Virat Kohli vs Rohit Sharma',
  'India team stats in ODI',
  'Summarize the latest match',
  'Show recent live scores',
  'Top run scorers in 2024'
];

const state = {
  status: null,
  home: null,
  live: [],
  lastPayload: null,
  pollTimer: null,
  hasAskedQuestion: false,
  isQuerying: false,
  activeRequestId: 0
};

const elements = {
  starterChips: document.querySelector('#starter-chips'),
  chatThread: document.querySelector('#chat-thread'),
  chatForm: document.querySelector('#chat-form'),
  chatInput: document.querySelector('#chat-input'),
  sendButton: document.querySelector('#send-button'),
  stageHeader: document.querySelector('#stage-header'),
  stageContent: document.querySelector('#stage-content'),
  statusPill: document.querySelector('#dataset-status-pill'),
  statusCopy: document.querySelector('#dataset-status-copy'),
  mobileBack: document.querySelector('#mobile-stage-back')
};

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function delayStyle(value = 0) {
  return ` style="--delay:${Number(value || 0).toFixed(2)}s"`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function formatDecimal(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

function formatDate(value = '') {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function fallbackAvatarUrl(name = 'Cricket Player') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00e676&color=08110d&bold=true&size=256&format=png`;
}

function detailData(payload = {}) {
  if (payload.data && typeof payload.data === 'object') return payload.data;
  if (payload.details && typeof payload.details === 'object') return payload.details;
  return payload;
}

function suggestionsFromPayload(payload = {}) {
  const source = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.followups)
      ? payload.followups
      : [];

  return [...new Set(source.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 5);
}

function statusMeta(status = {}) {
  const source = status || {};
  const rows = Number(source.rows_processed || 0);

  if (source.status === 'ready') {
    return {
      pill: 'Archive live',
      copy: 'The local archive is indexed and ready for full analytics.',
      chip: 'Archive ready'
    };
  }

  if (source.status === 'error') {
    return {
      pill: 'Archive error',
      copy: source.error || 'The archive failed to initialize.',
      chip: 'Offline'
    };
  }

  if (source.status === 'loading') {
    return {
      pill: 'Archive warming',
      copy: rows
        ? `${formatNumber(rows)} rows indexed so far.`
        : 'Preparing the local archive for analytics queries.',
      chip: rows ? `${formatCompact(rows)} rows` : 'Booting'
    };
  }

  return {
    pill: 'Connecting',
    copy: 'Connecting to the local archive and live cricket feeds.',
    chip: 'Linking'
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.summary || 'Request failed.');
  }
  return payload;
}

async function fetchPlayerImage(playerName = '') {
  const cleanName = String(playerName || '').trim();
  const cacheKey = cleanName.toLowerCase();
  const fallback = fallbackAvatarUrl(cleanName || 'Cricket Player');

  if (!cleanName) return fallback;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  const pendingRequest = (async () => {
    try {
      const searchPayload = await fetchJson(
        `https://en.wikipedia.org/w/api.php?origin=*&action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(`${cleanName} cricketer`)}`
      );
      const pageId = searchPayload?.query?.search?.[0]?.pageid;
      if (!pageId) return fallback;

      const imagePayload = await fetchJson(
        `https://en.wikipedia.org/w/api.php?origin=*&action=query&prop=pageimages&piprop=original&pageids=${encodeURIComponent(String(pageId))}&format=json`
      );
      const pages = imagePayload?.query?.pages || {};
      const page = pages[String(pageId)] || Object.values(pages)[0] || {};
      return page?.original?.source || page?.thumbnail?.source || fallback;
    } catch (error) {
      return fallback;
    }
  })();

  imageCache.set(cacheKey, pendingRequest);
  const resolvedUrl = await pendingRequest;
  imageCache.set(cacheKey, resolvedUrl);
  return resolvedUrl;
}

function isStaleRequest(requestId) {
  return requestId !== state.activeRequestId;
}

function renderChipButtons(items = [], className = 'chip') {
  if (!items.length) return '';
  return `
    <div class="chip-row">
      ${items
        .map(
          (item) =>
            `<button class="${safeText(className)}" type="button" data-question="${safeText(item)}">${safeText(item)}</button>`
        )
        .join('')}
    </div>
  `;
}

function renderEntityPortrait(name = 'Cricket', imageUrl = '', altSuffix = 'portrait') {
  const source = imageUrl || fallbackAvatarUrl(name);
  return `
    <div class="entity-portrait">
      <img
        src="${safeText(source)}"
        alt="${safeText(`${name} ${altSuffix}`)}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />
    </div>
  `;
}

function renderStatCard(label, value, note = '', options = {}) {
  const toneClass = options.tone ? ` ${options.tone}` : '';
  return `
    <article class="stat-card${toneClass} animate-slide-up"${delayStyle(options.delay || 0)}>
      <p class="stat-label">${safeText(label)}</p>
      <div class="stat-value">${safeText(value)}</div>
      ${note ? `<p class="stat-note">${safeText(note)}</p>` : ''}
    </article>
  `;
}

function renderStatFlex(items = [], startDelay = 0.04, step = 0.06) {
  return `
    <div class="stat-flex">
      ${items
        .map((item, index) =>
          renderStatCard(item.label, item.value, item.note || '', {
            tone: item.tone || '',
            delay: startDelay + index * step
          })
        )
        .join('')}
    </div>
  `;
}

function renderSignalRows(items = [], startDelay = 0.08) {
  if (!items.length) {
    return '<p class="empty-copy">No signal rows were returned for this query.</p>';
  }

  return `
    <div class="stage-panel-grid">
      ${items
        .map((item, index) => {
          const value =
            item.left !== undefined || item.right !== undefined
              ? `${item.left ?? '-'} / ${item.right ?? '-'}`
              : item.value ?? '-';
          return `
            <article class="signal-row animate-slide-up"${delayStyle(startDelay + index * 0.06)}>
              <p class="stat-label">${safeText(item.label || 'Signal')}</p>
              <div class="signal-value">${safeText(value)}</div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderSectionPanel({ kicker, title, copy = '', body = '', delay = 0, classes = '' }) {
  return `
    <section class="stage-panel ${safeText(classes)} animate-slide-up"${delayStyle(delay)}>
      <div class="section-heading">
        <p class="section-kicker">${safeText(kicker)}</p>
        <h3 class="section-title">${safeText(title)}</h3>
        ${copy ? `<p class="section-copy">${safeText(copy)}</p>` : ''}
      </div>
      ${body}
    </section>
  `;
}

function renderInsightsPanel(payload = {}, delay = 0.16) {
  const insights = toArray(payload.insights).filter(Boolean);
  const suggestions = suggestionsFromPayload(payload);
  const body = insights.length
    ? `
        <div class="stage-panel-grid">
          ${insights
            .map(
              (item, index) => `
                <article class="signal-row animate-slide-up"${delayStyle(delay + 0.04 + index * 0.06)}>
                  <p class="stat-label">Insight ${index + 1}</p>
                  <p class="list-subcopy">${safeText(item)}</p>
                </article>
              `
            )
            .join('')}
        </div>
        ${suggestions.length ? renderChipButtons(suggestions, 'chip') : ''}
      `
    : `
        <p class="empty-copy">No additional insights were returned for this response.</p>
        ${suggestions.length ? renderChipButtons(suggestions, 'chip') : ''}
      `;

  return renderSectionPanel({
    kicker: 'Analyst Readout',
    title: 'Insights',
    copy: 'Contextual cues generated from the active query.',
    body,
    delay
  });
}

function renderKeyStatsPanel(payload = {}, title = 'Signal Board', delay = 0.12) {
  const keyStats = toArray(payload.key_stats);
  return renderSectionPanel({
    kicker: 'Payload',
    title,
    copy: 'Structured signals returned directly by the backend.',
    body: renderSignalRows(keyStats, delay + 0.04),
    delay
  });
}

function renderMatchCard(match = {}, delay = 0.1) {
  const chips = [];
  if (match.match_type) chips.push(`<span class="match-chip">${safeText(match.match_type)}</span>`);
  if (match.venue) chips.push(`<span class="match-chip">${safeText(match.venue)}</span>`);
  if (match.winner) chips.push(`<span class="match-chip">${safeText(`Winner: ${match.winner}`)}</span>`);

  if (Array.isArray(match.score)) {
    match.score.forEach((row) => {
      const wickets = row.wickets === null || row.wickets === undefined ? '-' : row.wickets;
      const overs = row.overs === null || row.overs === undefined ? '-' : row.overs;
      chips.push(
        `<span class="match-chip">${safeText(`${row.inning || 'Innings'} ${row.runs || 0}/${wickets} (${overs})`)}</span>`
      );
    });
  }

  return `
    <article class="match-card animate-slide-up"${delayStyle(delay)}>
      <div class="match-head">
        <div class="match-main">
          <p class="list-title">${safeText(match.name || 'Match')}</p>
          <p class="list-subcopy">${safeText(formatDate(match.date || ''))}</p>
        </div>
      </div>
      ${chips.length ? `<div class="stage-chip-row">${chips.join('')}</div>` : ''}
      ${
        match.summary || match.status
          ? `<p class="list-subcopy">${safeText(match.summary || match.status)}</p>`
          : ''
      }
    </article>
  `;
}

function renderMatchesPanel(matches = [], title = 'Match Tape', copy = 'Relevant matches for the current view.', delay = 0.14) {
  const body = matches.length
    ? `<div class="match-grid">${matches
        .map((match, index) => renderMatchCard(match, delay + 0.04 + index * 0.06))
        .join('')}</div>`
    : '<p class="empty-copy">No match cards are available for this response yet.</p>';

  return renderSectionPanel({
    kicker: 'Tape',
    title,
    copy,
    body,
    delay
  });
}

function renderLeaderboardPanel(rows = [], title = 'Leaderboard', copy = 'Ranked performers in the active scope.', delay = 0.12) {
  const body = rows.length
    ? `
        <div class="list-grid">
          ${rows
            .map(
              (row, index) => `
                <article class="list-row animate-slide-up"${delayStyle(delay + 0.04 + index * 0.06)}>
                  <div class="leader-main">
                    <p class="list-title">${safeText(row.player || row.name || 'Player')}</p>
                    <p class="list-subcopy">${safeText(row.team || row.country || 'Archive')}</p>
                  </div>
                  <div>
                    <div class="list-rank">#${safeText(row.rank ?? index + 1)}</div>
                    <p class="list-subcopy">${safeText(row.value ?? '-')}</p>
                  </div>
                </article>
              `
            )
            .join('')}
        </div>
      `
    : '<p class="empty-copy">No ranked rows were returned.</p>';

  return renderSectionPanel({
    kicker: 'Ranking',
    title,
    copy,
    body,
    delay
  });
}

function renderCanvasHeader({ eyebrow = 'Omni-Channel Canvas', title = 'Cricket Analytics Broadcast', subtitle = '', chips = [] } = {}) {
  const statusChip = statusMeta(state.status).chip;
  const allChips = [statusChip, ...chips].filter(Boolean);
  elements.stageHeader.innerHTML = `
    <div class="stage-heading">
      <p class="eyebrow">${safeText(eyebrow)}</p>
      <h2 class="stage-title">${safeText(title)}</h2>
      ${subtitle ? `<p class="stage-subtitle">${safeText(subtitle)}</p>` : ''}
    </div>
    ${allChips.length ? `<div class="stage-chip-row">${allChips.map((chip) => `<span class="stage-chip">${safeText(chip)}</span>`).join('')}</div>` : ''}
  `;
}

function setCanvasBody(html = '') {
  elements.stageContent.innerHTML = html;
  elements.stageContent.setAttribute('aria-busy', 'false');
}

function renderStageSkeleton(question = '') {
  renderCanvasHeader({
    eyebrow: 'Analytics Canvas',
    title: 'Resolving Query',
    subtitle: question || 'Interpreting the prompt and composing the next stage.'
  });

  setCanvasBody(`
    <div class="skeleton-shell">
      <div class="skeleton-hero">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
      <div class="skeleton-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
      <div class="stage-panel">
        <div class="chip-row">
          <div class="skeleton-chip"></div>
          <div class="skeleton-chip"></div>
          <div class="skeleton-chip"></div>
        </div>
        <div class="stage-panel-grid" style="margin-top:18px;">
          <div class="skeleton-line"></div>
          <div class="skeleton-line" style="width:82%;"></div>
          <div class="skeleton-line" style="width:92%;"></div>
        </div>
      </div>
    </div>
  `);
  elements.stageContent.setAttribute('aria-busy', 'true');
}

function renderBootStage() {
  const meta = statusMeta(state.status);
  renderCanvasHeader({
    eyebrow: 'Omni-Channel Canvas',
    title: 'Broadcast stage warming',
    subtitle: 'Natural language controls will take over as soon as the archive is ready.',
    chips: [meta.pill]
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <p class="stage-kicker">System Bring-Up</p>
            <h3 class="hero-title">Stadium Night signal path is online</h3>
            <p class="hero-summary">${safeText(meta.copy)}</p>
            ${renderChipButtons(STARTER_PROMPTS.slice(0, 4), 'chip')}
          </div>
          ${renderStatFlex(
            [
              { label: 'Status', value: meta.pill, note: 'Archive readiness', tone: 'highlight' },
              { label: 'Rows', value: formatCompact(state.status?.rows_processed || 0), note: 'Indexed so far' },
              { label: 'Control', value: 'Chat', note: 'Primary command surface' },
              { label: 'Theme', value: 'Night', note: 'Broadcast interface' }
            ],
            0.06
          )}
        </div>
      </section>
      <section class="stage-panel empty-state animate-slide-up"${delayStyle(0.18)}>
        <h3 class="empty-title">Awaiting first command</h3>
        <p class="empty-copy">Ask for a player, a team, a match, or a comparison to generate the first analytics composition.</p>
      </section>
    </div>
  `);
}

function renderLandingStage() {
  const home = state.home || {};
  const quickStats = home.quick_stats || {};
  const topPlayers = toArray(home.top_players).slice(0, 6);
  const recentMatches = toArray(home.recent_matches).slice(0, 4);
  const liveItems = toArray(state.live).slice(0, 4);

  renderCanvasHeader({
    eyebrow: 'Omni-Channel Canvas',
    title: 'Command the field with language',
    subtitle: 'Use the left command center to summon player stories, live surfaces, and comparison scenes.',
    chips: ['Canvas online', liveItems.length ? `${liveItems.length} live feeds` : 'Archive-first mode']
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <p class="stage-kicker">Opening Feed</p>
            <h3 class="hero-title">One canvas. Every cricket question.</h3>
            <p class="hero-summary">
              This stage is built around natural language resolution. Ask for player stats, match stories, team form,
              live updates, or side-by-side comparisons and the canvas will rebuild around that intent.
            </p>
            ${renderChipButtons(STARTER_PROMPTS, 'chip')}
          </div>
          ${renderStatFlex(
            [
              { label: 'Matches', value: formatCompact(quickStats.matches || 0), note: 'Archive footprint', tone: 'highlight' },
              { label: 'Players', value: formatCompact(quickStats.players || 0), note: 'Profiles in scope' },
              { label: 'Teams', value: formatCompact(quickStats.teams || 0), note: 'Competitive entities' },
              { label: 'Seasons', value: quickStats.seasons || 'N/A', note: 'Coverage window' }
            ],
            0.06
          )}
        </div>
      </section>
      <div class="stage-section-grid">
        ${renderLeaderboardPanel(
          topPlayers.map((player, index) => ({
            rank: index + 1,
            player: player.name,
            team: player.team,
            value: `${formatNumber(player.runs || 0)} runs`
          })),
          'Featured Batters',
          'High-output names currently loaded into the archive.',
          0.12
        )}
        ${renderMatchesPanel(
          liveItems.length ? liveItems : recentMatches,
          liveItems.length ? 'Live Signal' : 'Recent Archive Tape',
          liveItems.length
            ? 'Live or recent feed items from the connected match provider.'
            : 'Latest archived matches available locally.',
          0.18
        )}
      </div>
    </div>
  `);
}

function renderPerformerPanel(title, copy, rows = [], formatter, delay = 0.12) {
  const body = rows.length
    ? `
        <div class="list-grid">
          ${rows
            .map(
              (row, index) => `
                <article class="list-row animate-slide-up"${delayStyle(delay + 0.04 + index * 0.06)}>
                  <div class="leader-main">
                    <p class="list-title">${safeText(row.name || row.player || 'Performer')}</p>
                    <p class="list-subcopy">${safeText(formatter(row))}</p>
                  </div>
                </article>
              `
            )
            .join('')}
        </div>
      `
    : '<p class="empty-copy">No performer rows were returned.</p>';

  return renderSectionPanel({
    kicker: 'Performance',
    title,
    copy,
    body,
    delay
  });
}

function renderCompareBar(label, leftValue, rightValue, formatter = formatNumber, delay = 0.12) {
  const left = Number(leftValue || 0);
  const right = Number(rightValue || 0);
  const max = Math.max(left, right, 1);
  const leftWidth = `${Math.max((left / max) * 100, left > 0 ? 8 : 0)}%`;
  const rightWidth = `${Math.max((right / max) * 100, right > 0 ? 8 : 0)}%`;

  return `
    <article class="compare-metric-row animate-slide-up"${delayStyle(delay)}>
      <div class="compare-bar-head">
        <span class="list-title">${safeText(label)}</span>
        <span class="list-subcopy">${safeText(formatter(left))} / ${safeText(formatter(right))}</span>
      </div>
      <div class="compare-bar-track">
        <span class="compare-bar left" style="width:${leftWidth};"></span>
        <span class="compare-bar right" style="width:${rightWidth};"></span>
      </div>
    </article>
  `;
}

async function renderPlayerStage(data = {}, payload = {}, requestId = state.activeRequestId) {
  const player = data.player || {};
  const stats = data.stats || {};
  const playerName = player.canonical_name || player.name || data.title || 'Player Snapshot';
  const playerImage = await fetchPlayerImage(playerName);
  if (isStaleRequest(requestId)) return;

  renderCanvasHeader({
    eyebrow: 'Player Resolution',
    title: data.title || playerName,
    subtitle: data.subtitle || player.team || player.country || 'Archive profile',
    chips: [player.team || player.country, 'Entity resolved'].filter(Boolean)
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <div class="identity-lockup">
              ${renderEntityPortrait(playerName, playerImage)}
              <div class="entity-copy">
                <p class="stage-kicker">Resolved Entity</p>
                <h3 class="hero-title">${safeText(playerName)}</h3>
                <p class="hero-subtitle">${safeText(player.team || player.country || data.subtitle || 'Archive profile')}</p>
              </div>
            </div>
            <p class="hero-summary">${safeText(payload.summary || data.summary || 'No summary available.')}</p>
            <div class="stage-chip-row">
              ${[...new Set([player.country, player.team, player.role || player.playing_role, player.batting_style].filter(Boolean))]
                .map((item) => `<span class="stage-chip">${safeText(item)}</span>`)
                .join('')}
            </div>
          </div>
          ${renderStatFlex(
            [
              { label: 'Matches', value: formatNumber(stats.matches || 0), note: 'Appearances', tone: 'highlight' },
              { label: 'Runs', value: formatNumber(stats.runs || 0), note: 'Batting output' },
              { label: 'Average', value: formatDecimal(stats.average || 0), note: 'Batting average' },
              { label: 'Strike Rate', value: formatDecimal(stats.strike_rate || 0), note: 'Scoring tempo' },
              { label: 'Wickets', value: formatNumber(stats.wickets || 0), note: 'Bowling return' },
              { label: 'Economy', value: formatDecimal(stats.economy || 0), note: 'Run control' }
            ],
            0.06
          )}
        </div>
      </section>
      <div class="stage-section-grid">
        ${renderSectionPanel({
          kicker: 'Detail Matrix',
          title: 'Role Breakdown',
          copy: 'Primary batting and bowling indicators from the verified archive.',
          body: renderStatFlex(
            [
              { label: 'Innings', value: formatNumber(stats.innings || 0), note: 'Batting innings' },
              { label: 'Balls Faced', value: formatNumber(stats.balls_faced || 0), note: 'Tracked deliveries' },
              { label: 'Fours', value: formatNumber(stats.fours || 0), note: 'Boundary count' },
              { label: 'Sixes', value: formatNumber(stats.sixes || 0), note: 'Power hitting' },
              { label: 'Bowling Innings', value: formatNumber(stats.bowling_innings || 0), note: 'Bowling spells' },
              { label: 'Overs Bowled', value: stats.overs_bowled || '0', note: 'Workload' }
            ],
            0.12
          ),
          delay: 0.12
        })}
        ${renderKeyStatsPanel(payload, 'Signal Board', 0.18)}
      </div>
      <div class="stage-section-grid">
        ${renderMatchesPanel(
          toArray(data.recent_matches),
          'Recent Match Tape',
          'Latest archived matches tied to this player.',
          0.22
        )}
        ${renderInsightsPanel(payload, 0.28)}
      </div>
    </div>
  `);
}

function renderTeamStage(data = {}, payload = {}) {
  const team = data.team || {};
  const stats = data.stats || {};
  const teamName = team.name || data.title || 'Team Snapshot';

  renderCanvasHeader({
    eyebrow: 'Team Snapshot',
    title: data.title || teamName,
    subtitle: data.subtitle || 'Archive scope',
    chips: [team.country, team.type, 'Team view'].filter(Boolean)
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <div class="identity-lockup">
              ${renderEntityPortrait(teamName, fallbackAvatarUrl(teamName), 'crest')}
              <div class="entity-copy">
                <p class="stage-kicker">Team Surface</p>
                <h3 class="hero-title">${safeText(teamName)}</h3>
                <p class="hero-subtitle">${safeText(data.subtitle || team.country || 'Archive scope')}</p>
              </div>
            </div>
            <p class="hero-summary">${safeText(payload.summary || data.summary || 'No summary available.')}</p>
          </div>
          ${renderStatFlex(
            [
              { label: 'Matches', value: formatNumber(stats.matches || 0), note: 'Sample size', tone: 'highlight' },
              { label: 'Wins', value: formatNumber(stats.wins || 0), note: 'Victories' },
              { label: 'Win Rate', value: formatPercent(stats.win_rate || 0), note: 'Conversion rate' },
              { label: 'Average Score', value: formatDecimal(stats.average_score || 0), note: 'Runs per match' },
              { label: 'Losses', value: formatNumber(stats.losses || 0), note: 'Defeats' },
              { label: 'No Result', value: formatNumber(stats.no_result || 0), note: 'Incomplete outcomes' }
            ],
            0.06
          )}
        </div>
      </section>
      <div class="stage-section-grid">
        ${renderMatchesPanel(
          toArray(data.recent_matches),
          'Recent Team Tape',
          'Latest archived matches in the current team scope.',
          0.14
        )}
        ${renderInsightsPanel(payload, 0.2)}
      </div>
    </div>
  `);
}

async function renderCompareStage(data = {}, payload = {}, requestId = state.activeRequestId) {
  const left = data.left || {};
  const right = data.right || {};
  const leftStats = left.stats || {};
  const rightStats = right.stats || {};
  const leftName = left.canonical_name || left.name || 'Player 1';
  const rightName = right.canonical_name || right.name || 'Player 2';

  const [leftImage, rightImage] = await Promise.all([fetchPlayerImage(leftName), fetchPlayerImage(rightName)]);
  if (isStaleRequest(requestId)) return;

  renderCanvasHeader({
    eyebrow: 'Head-to-Head Comparison',
    title: data.title || `${leftName} vs ${rightName}`,
    subtitle: data.subtitle || 'Side-by-side archive comparison',
    chips: ['Parallel image fetch', 'Compare view']
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="compare-hero">
          <article class="compare-card animate-slide-up"${delayStyle(0.06)}>
            ${renderEntityPortrait(leftName, leftImage)}
            <div class="entity-copy">
              <div class="compare-card-head">
                <p class="stage-kicker">Left Profile</p>
                <span class="stage-chip">${safeText(left.team || left.country || 'Archive')}</span>
              </div>
              <h3 class="section-title">${safeText(leftName)}</h3>
              <p class="section-copy">${safeText(left.country || left.team || 'Player profile')}</p>
            </div>
          </article>
          <div class="versus-badge animate-slide-up"${delayStyle(0.12)}>VS</div>
          <article class="compare-card animate-slide-up"${delayStyle(0.18)}>
            ${renderEntityPortrait(rightName, rightImage)}
            <div class="entity-copy">
              <div class="compare-card-head">
                <p class="stage-kicker">Right Profile</p>
                <span class="stage-chip">${safeText(right.team || right.country || 'Archive')}</span>
              </div>
              <h3 class="section-title">${safeText(rightName)}</h3>
              <p class="section-copy">${safeText(right.country || right.team || 'Player profile')}</p>
            </div>
          </article>
        </div>
        <p class="hero-summary">${safeText(payload.summary || data.summary || 'No comparison summary available.')}</p>
        ${renderStatFlex(
          [
            {
              label: `${leftName.split(' ')[0]} Runs`,
              value: formatNumber(leftStats.runs || 0),
              note: 'Career total',
              tone: 'highlight'
            },
            {
              label: `${rightName.split(' ')[0]} Runs`,
              value: formatNumber(rightStats.runs || 0),
              note: 'Career total'
            },
            {
              label: `${leftName.split(' ')[0]} SR`,
              value: formatDecimal(leftStats.strike_rate || 0),
              note: 'Strike rate'
            },
            {
              label: `${rightName.split(' ')[0]} SR`,
              value: formatDecimal(rightStats.strike_rate || 0),
              note: 'Strike rate'
            }
          ],
          0.12
        )}
      </section>
      <div class="comparison-grid">
        ${renderSectionPanel({
          kicker: 'Pressure Split',
          title: 'Core Metrics',
          copy: 'Comparative scoring and bowling output rendered on a shared scale.',
          body: `
            <div class="stage-panel-grid">
              ${renderCompareBar('Runs', leftStats.runs || 0, rightStats.runs || 0, formatNumber, 0.14)}
              ${renderCompareBar('Average', leftStats.average || 0, rightStats.average || 0, (value) => formatDecimal(value), 0.2)}
              ${renderCompareBar('Strike Rate', leftStats.strike_rate || 0, rightStats.strike_rate || 0, (value) => formatDecimal(value), 0.26)}
              ${renderCompareBar('Wickets', leftStats.wickets || 0, rightStats.wickets || 0, formatNumber, 0.32)}
              ${renderCompareBar('Economy', leftStats.economy || 0, rightStats.economy || 0, (value) => formatDecimal(value), 0.38)}
            </div>
          `,
          delay: 0.14
        })}
        ${renderKeyStatsPanel(payload, 'Compare Signals', 0.2)}
      </div>
      ${renderInsightsPanel(payload, 0.26)}
    </div>
  `);
}

function renderMatchSummaryStage(data = {}, payload = {}) {
  const match = data.match || {};
  const scoreCards = Array.isArray(match.score)
    ? match.score.map((row) => ({
        label: row.inning || 'Innings',
        value: `${row.runs || 0}/${row.wickets ?? '-'}`,
        note: `${row.overs ?? '-'} overs`
      }))
    : [];

  renderCanvasHeader({
    eyebrow: 'Match Story',
    title: data.title || match.name || 'Match Summary',
    subtitle: data.subtitle || [formatDate(match.date || ''), match.venue].filter(Boolean).join(' | '),
    chips: [match.winner ? `Winner: ${match.winner}` : '', match.match_type].filter(Boolean)
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <p class="stage-kicker">Result Signal</p>
            <h3 class="hero-title">${safeText(match.name || 'Match Summary')}</h3>
            <p class="hero-summary">${safeText(payload.summary || data.summary || match.summary || 'No summary available.')}</p>
            <div class="stage-chip-row">
              ${[match.venue, formatDate(match.date || ''), match.winner ? `Winner: ${match.winner}` : '', match.match_type]
                .filter(Boolean)
                .map((item) => `<span class="stage-chip">${safeText(item)}</span>`)
                .join('')}
            </div>
          </div>
          ${renderStatFlex(
            scoreCards.length
              ? scoreCards
              : [{ label: 'Scorecard', value: 'Unavailable', note: 'No inning data returned', tone: 'highlight' }],
            0.06
          )}
        </div>
      </section>
      <div class="stage-section-grid">
        ${renderPerformerPanel(
          'Top Batters',
          'Highest batting contributions in this match.',
          toArray(match.top_batters),
          (row) => `${row.runs || 0} runs${row.balls ? ` in ${row.balls} balls` : ''}`,
          0.12
        )}
        ${renderPerformerPanel(
          'Top Bowlers',
          'Best bowling figures from the scorecard.',
          toArray(match.top_bowlers),
          (row) => `${row.wickets || 0}/${row.runs_conceded || 0}${row.overs ? ` in ${row.overs}` : ''}`,
          0.18
        )}
      </div>
      ${renderInsightsPanel(payload, 0.24)}
    </div>
  `);
}

function renderHeadToHeadStage(data = {}, payload = {}) {
  const stats = data.stats || {};
  const title = data.title || `${data.team1 || 'Team 1'} vs ${data.team2 || 'Team 2'}`;

  renderCanvasHeader({
    eyebrow: 'Head-to-Head',
    title,
    subtitle: data.subtitle || 'Archive rivalry snapshot',
    chips: ['Rivalry view']
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <p class="stage-kicker">Rivalry Frame</p>
            <h3 class="hero-title">${safeText(title)}</h3>
            <p class="hero-summary">${safeText(payload.summary || data.summary || 'No rivalry summary available.')}</p>
          </div>
          ${renderStatFlex(
            [
              { label: 'Matches', value: formatNumber(stats.matches || 0), note: 'Total meetings', tone: 'highlight' },
              { label: data.team1 || 'Team 1', value: formatNumber(stats.wins_team_a || 0), note: 'Wins' },
              { label: data.team2 || 'Team 2', value: formatNumber(stats.wins_team_b || 0), note: 'Wins' },
              { label: 'No Result', value: formatNumber(stats.no_result || 0), note: 'Shared abandonments' }
            ],
            0.06
          )}
        </div>
      </section>
      <div class="stage-section-grid">
        ${renderMatchesPanel(
          toArray(data.recent_matches),
          'Recent Meetings',
          'Latest matches in this head-to-head rivalry.',
          0.12
        )}
        ${renderInsightsPanel(payload, 0.18)}
      </div>
    </div>
  `);
}

function renderTopPlayersStage(data = {}, payload = {}) {
  renderCanvasHeader({
    eyebrow: 'Leaderboard Surface',
    title: data.title || 'Top Players',
    subtitle: data.subtitle || 'Archive ranking',
    chips: [data.metric ? `Metric: ${data.metric}` : 'Ranking']
  });

  setCanvasBody(`
    <div class="stage-stack">
      ${renderLeaderboardPanel(
        toArray(data.rows),
        data.title || 'Top Players',
        payload.summary || data.summary || 'Ranked performers returned by the current query.',
        0.08
      )}
      ${renderInsightsPanel(payload, 0.16)}
    </div>
  `);
}

async function renderLiveUpdateStage(data = {}, payload = {}, requestId = state.activeRequestId) {
  const matches = [];
  if (data.live_match?.name) matches.push(data.live_match);
  if (Array.isArray(data.upcoming_matches)) matches.push(...data.upcoming_matches);
  if (Array.isArray(data.recent_matches)) matches.push(...data.recent_matches);

  const trackedPlayerName = data.player?.name || '';
  const trackedPlayerImage = trackedPlayerName ? await fetchPlayerImage(trackedPlayerName) : fallbackAvatarUrl('Live Cricket');
  if (isStaleRequest(requestId)) return;

  renderCanvasHeader({
    eyebrow: 'Live Match Center',
    title: data.title || 'Live Update',
    subtitle: data.subtitle || 'Current and upcoming fixtures',
    chips: [data.provider_status?.title, data.live_match?.name ? 'Live signal active' : 'No live match'].filter(Boolean)
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="hero-panel animate-fade-in">
        <div class="hero-grid">
          <div class="entity-copy">
            <div class="identity-lockup">
              ${renderEntityPortrait(trackedPlayerName || 'Live Cricket', trackedPlayerImage)}
              <div class="entity-copy">
                <p class="stage-kicker">Live Feed</p>
                <h3 class="hero-title">${safeText(data.title || 'Live Match Center')}</h3>
                <p class="hero-subtitle">${safeText(data.player?.name || data.provider_status?.title || 'Provider feed')}</p>
              </div>
            </div>
            <p class="hero-summary">${safeText(payload.summary || data.summary || data.provider_status?.message || 'No live summary available.')}</p>
          </div>
          ${renderStatFlex(
            [
              { label: 'Live', value: data.live_match?.name ? 'Active' : 'Idle', note: 'Current live surface', tone: 'highlight' },
              { label: 'Upcoming', value: formatNumber(toArray(data.upcoming_matches).length), note: 'Scheduled matches' },
              { label: 'Recent', value: formatNumber(toArray(data.recent_matches).length), note: 'Recent feed items' },
              { label: 'Tracked Player', value: data.player?.name || 'None', note: data.player?.country || 'No live player card' }
            ],
            0.06
          )}
        </div>
      </section>
      <div class="stage-section-grid">
        ${renderMatchesPanel(
          matches.filter((match) => match?.name),
          'Live / Upcoming Tape',
          'Live, scheduled, and recently returned fixtures from the feed.',
          0.12
        )}
        ${renderInsightsPanel(payload, 0.18)}
      </div>
    </div>
  `);
}

function renderSummaryStage(data = {}, payload = {}) {
  renderCanvasHeader({
    eyebrow: 'Summary Surface',
    title: payload.title || data.title || 'Cricket Intelligence',
    subtitle: payload.summary || data.summary || 'Natural language result',
    chips: ['Summary']
  });

  setCanvasBody(`
    <div class="stage-stack">
      ${renderSectionPanel({
        kicker: 'Summary',
        title: payload.title || data.title || 'Cricket Intelligence',
        copy: 'High-level result generated from the active query.',
        body: `
          <div class="summary-panel">
            <p class="hero-summary">${safeText(payload.summary || data.summary || payload.answer || 'No summary available.')}</p>
            ${renderChipButtons(suggestionsFromPayload(payload), 'chip')}
          </div>
        `,
        delay: 0.08
      })}
      <div class="stage-section-grid">
        ${renderKeyStatsPanel(payload, 'Signal Board', 0.14)}
        ${renderInsightsPanel(payload, 0.2)}
      </div>
    </div>
  `);
}

async function renderDynamicStage(data = {}, payload = state.lastPayload || {}, requestId = state.activeRequestId) {
  switch (data.type) {
    case 'player_stats':
      await renderPlayerStage(data, payload, requestId);
      break;
    case 'team_stats':
      renderTeamStage(data, payload);
      break;
    case 'compare_players':
      await renderCompareStage(data, payload, requestId);
      break;
    case 'match_summary':
      renderMatchSummaryStage(data, payload);
      break;
    case 'head_to_head':
      renderHeadToHeadStage(data, payload);
      break;
    case 'top_players':
      renderTopPlayersStage(data, payload);
      break;
    case 'live_update':
      await renderLiveUpdateStage(data, payload, requestId);
      break;
    default:
      renderSummaryStage(data, payload);
      break;
  }
}

function renderChatMessage(role = 'assistant', body = '') {
  const label = role === 'user' ? 'Field Producer' : 'Analytics Desk';
  const avatar = role === 'user' ? 'YOU' : 'AI';
  return `
    <article class="chat-message ${safeText(role)} animate-fade-in">
      <div class="chat-head">
        <span class="chat-avatar">${safeText(avatar)}</span>
        <div>
          <p class="chat-role">${safeText(label)}</p>
        </div>
      </div>
      <div class="chat-body">${body}</div>
    </article>
  `;
}

function appendChatMessage(role = 'assistant', body = '') {
  elements.chatThread.insertAdjacentHTML('beforeend', renderChatMessage(role, body));
  const node = elements.chatThread.lastElementChild;
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
  return node;
}

function updateChatMessage(node, role = 'assistant', body = '') {
  if (!node) return null;
  const template = document.createElement('template');
  template.innerHTML = renderChatMessage(role, body).trim();
  const next = template.content.firstElementChild;
  node.replaceWith(next);
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
  return next;
}

function renderAssistantIntro() {
  appendChatMessage(
    'assistant',
    `
      <p class="chat-copy">
        Broadcast analytics canvas is live. Ask for a player, a team, a match story, a live feed, or a direct comparison and the right stage will rebuild around that context.
      </p>
      ${renderChipButtons(STARTER_PROMPTS, 'chip')}
    `
  );
}

function renderPendingAssistant() {
  return appendChatMessage(
    'assistant',
    `
      <p class="chat-copy">Resolving the prompt, fetching structured evidence, and rebuilding the canvas.</p>
      <div class="typing-indicator" aria-hidden="true"><span></span><span></span><span></span></div>
    `
  );
}

function renderAssistantPayload(payload = {}) {
  const summary = payload.summary || payload.answer || 'No answer returned.';
  const suggestions = suggestionsFromPayload(payload);
  return `
    <p class="chat-copy">${safeText(summary)}</p>
    ${suggestions.length ? renderChipButtons(suggestions, 'chip') : ''}
  `;
}

function renderErrorStage(message = '') {
  renderCanvasHeader({
    eyebrow: 'Canvas Fault',
    title: 'Query could not be completed',
    subtitle: 'The analytics stage did not receive a usable payload.',
    chips: ['Fault']
  });

  setCanvasBody(`
    <section class="stage-panel empty-state animate-fade-in">
      <h3 class="empty-title">Request failed</h3>
      <p class="empty-copy">${safeText(message || 'Unable to complete this query right now.')}</p>
      ${renderChipButtons(STARTER_PROMPTS.slice(0, 3), 'chip')}
    </section>
  `);
}

function openCanvasOnMobile() {
  if (window.innerWidth >= 768) return;
  document.body.classList.add('mobile-stage-open');
}

function closeCanvasOnMobile() {
  document.body.classList.remove('mobile-stage-open');
}

function syncViewportMode() {
  if (window.innerWidth >= 768) {
    closeCanvasOnMobile();
  }
}

function resizeComposer() {
  const input = elements.chatInput;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

async function refreshStatus() {
  try {
    const status = await fetchJson('/api/status');
    state.status = status;
    const meta = statusMeta(status);
    elements.statusPill.textContent = meta.pill;
    elements.statusCopy.textContent = meta.copy;

    if (!state.hasAskedQuestion) {
      if (state.home) {
        renderLandingStage();
      } else {
        renderBootStage();
      }
    }

    if (status.status === 'ready' && state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
      if (!state.home) {
        void loadLandingData();
      }
    }
  } catch (error) {
    elements.statusPill.textContent = 'Archive unreachable';
    elements.statusCopy.textContent = error.message || 'Unable to reach the backend.';
  }
}

async function loadLandingData() {
  const [homeResult, liveResult] = await Promise.allSettled([
    fetchJson('/api/home'),
    fetchJson('/api/cricapi/live-scores?limit=4&includeRecent=true')
  ]);

  if (homeResult.status === 'fulfilled') {
    state.home = homeResult.value;
  }

  if (liveResult.status === 'fulfilled') {
    state.live = toArray(liveResult.value.items);
  }

  if (!state.hasAskedQuestion) {
    if (state.home) {
      renderLandingStage();
    } else {
      renderBootStage();
    }
  }
}

function startStatusPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
  }

  state.pollTimer = window.setInterval(() => {
    void refreshStatus();
  }, 4000);
}

async function runQuery(question = '') {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion || state.isQuerying) return;

  state.isQuerying = true;
  state.hasAskedQuestion = true;
  const requestId = ++state.activeRequestId;

  appendChatMessage('user', `<p class="chat-copy">${safeText(cleanQuestion)}</p>`);
  const pendingNode = renderPendingAssistant();
  renderStageSkeleton(cleanQuestion);
  openCanvasOnMobile();

  elements.sendButton.disabled = true;
  elements.sendButton.textContent = 'Mapping';

  try {
    const payload = await fetchJson('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: cleanQuestion })
    });

    if (isStaleRequest(requestId)) return;

    state.lastPayload = payload;
    updateChatMessage(pendingNode, 'assistant', renderAssistantPayload(payload));
    await renderDynamicStage(detailData(payload), payload, requestId);
  } catch (error) {
    if (isStaleRequest(requestId)) return;
    updateChatMessage(
      pendingNode,
      'assistant',
      `<p class="chat-copy">${safeText(error.message || 'Unable to complete this query right now.')}</p>`
    );
    renderErrorStage(error.message);
  } finally {
    if (!isStaleRequest(requestId)) {
      state.isQuerying = false;
      elements.sendButton.disabled = false;
      elements.sendButton.textContent = 'Map Signal';
      elements.chatInput.value = '';
      resizeComposer();
      elements.chatInput.focus();
    }
  }
}

function bindEvents() {
  elements.chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await runQuery(elements.chatInput.value);
  });

  elements.chatInput.addEventListener('input', resizeComposer);
  elements.chatInput.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    await runQuery(elements.chatInput.value);
  });

  document.body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-question]');
    if (!button) return;
    await runQuery(button.dataset.question || '');
  });

  elements.mobileBack.addEventListener('click', closeCanvasOnMobile);
  window.addEventListener('resize', syncViewportMode);
}

function renderStarterDeck() {
  elements.starterChips.innerHTML = STARTER_PROMPTS.map(
    (prompt) => `<button class="chip" type="button" data-question="${safeText(prompt)}">${safeText(prompt)}</button>`
  ).join('');
}

async function init() {
  renderStarterDeck();
  bindEvents();
  resizeComposer();
  renderAssistantIntro();
  renderBootStage();
  await refreshStatus();
  void loadLandingData();
  startStatusPolling();
}

init().catch((error) => {
  renderErrorStage(error.message);
});
