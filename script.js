const STARTER_PROMPTS = [
  'Virat Kohli stats',
  'Compare Virat Kohli vs Rohit Sharma',
  'India team stats in ODI',
  'Show recent live scores',
  'Summarize the latest match',
  'Top run scorers in 2024'
];

const state = {
  status: null,
  home: null,
  live: [],
  lastPayload: null,
  pollTimer: null,
  hasAskedQuestion: false
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatCompact(value) {
  return new Intl.NumberFormat('en', {
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

function initials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'CS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
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
  return [...new Set(source.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 4);
}

function statusMeta(status = {}) {
  const source = status || {};
  const rows = Number(source.rows_processed || 0);
  if (source.status === 'ready') {
    return {
      pill: 'Archive live',
      copy: 'Local archive is indexed and ready for full analytics.',
      chip: 'Archive ready'
    };
  }

  if (source.status === 'error') {
    return {
      pill: 'Archive error',
      copy: source.error || 'The local archive failed to initialize.',
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
    pill: 'Archive warming',
    copy: 'Connecting to the local archive and live cricket feeds.',
    chip: 'Connecting'
  };
}

function renderChipButtons(items = [], className = 'suggestion-chip') {
  if (!items.length) return '';
  return `
    <div class="chip-row">
      ${items
        .map(
          (item) =>
            `<button class="${className}" type="button" data-question="${safeText(item)}">${safeText(item)}</button>`
        )
        .join('')}
    </div>
  `;
}

function renderAvatar(entity = {}) {
  const name = entity.canonical_name || entity.name || entity.player || entity.team || 'Cricket';
  return `<div class="avatar-ring avatar-fallback">${safeText(initials(name))}</div>`;
}

function renderMetricCard(label, value, note = '') {
  return `
    <article class="metric-card">
      <p class="metric-label">${safeText(label)}</p>
      <div class="metric-value">${safeText(value)}</div>
      ${note ? `<p class="metric-note">${safeText(note)}</p>` : ''}
    </article>
  `;
}

function renderKeyStatsPanel(payload = {}, title = 'Signal Summary') {
  const keyStats = Array.isArray(payload.key_stats) ? payload.key_stats : [];
  if (!keyStats.length) return '';

  return `
    <section class="surface-card">
      <div class="section-head">
        <div>
          <p class="section-kicker">Payload</p>
          <h3 class="section-title">${safeText(title)}</h3>
        </div>
      </div>
      <div class="metric-grid">
        ${keyStats
          .map((item) => {
            const value =
              item.left !== undefined || item.right !== undefined
                ? `${item.left ?? '-'} / ${item.right ?? '-'}`
                : item.value ?? '-';
            return renderMetricCard(item.label || 'Metric', value, '');
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderInsightsPanel(payload = {}) {
  const insights = Array.isArray(payload.insights) ? payload.insights.filter(Boolean) : [];
  const suggestions = suggestionsFromPayload(payload);
  return `
    <section class="surface-card">
      <div class="section-head">
        <div>
          <p class="section-kicker">Analyst Readout</p>
          <h3 class="section-title">Insights</h3>
          <p class="section-copy">Actionable cues generated from the current query context.</p>
        </div>
      </div>
      ${
        insights.length
          ? `<ul class="insight-list">${insights
              .map((item) => `<li>${safeText(item)}</li>`)
              .join('')}</ul>`
          : `<p class="empty-copy">No additional insights were returned for this query.</p>`
      }
      ${suggestions.length ? renderChipButtons(suggestions) : ''}
    </section>
  `;
}

function renderMatchRow(match = {}) {
  const chips = [];
  if (match.venue) chips.push(`<span class="score-chip">${safeText(match.venue)}</span>`);
  if (match.match_type) chips.push(`<span class="score-chip">${safeText(match.match_type)}</span>`);
  if (Array.isArray(match.score)) {
    match.score.forEach((row) => {
      const wickets = row.wickets === null || row.wickets === undefined ? '-' : row.wickets;
      const overs = row.overs === null || row.overs === undefined ? '-' : row.overs;
      chips.push(
        `<span class="score-chip">${safeText(`${row.inning || 'Innings'} ${row.runs || 0}/${wickets} (${overs})`)}</span>`
      );
    });
  }

  return `
    <article class="match-row">
      <div class="match-header">
        <div class="match-main">
          <p class="data-title">${safeText(match.name || 'Match')}</p>
          <p class="data-copy">${safeText(formatDate(match.date || ''))}</p>
        </div>
        ${match.winner ? `<span class="meta-pill">${safeText(`Winner: ${match.winner}`)}</span>` : ''}
      </div>
      ${chips.length ? `<div class="score-chip-row">${chips.join('')}</div>` : ''}
      ${
        match.status || match.summary
          ? `<p class="data-copy">${safeText(match.status || match.summary)}</p>`
          : ''
      }
    </article>
  `;
}

function renderMatchTape(matches = [], title = 'Match Tape', copy = 'Relevant matches from the current context.') {
  return `
    <section class="surface-card">
      <div class="section-head">
        <div>
          <p class="section-kicker">Tape</p>
          <h3 class="section-title">${safeText(title)}</h3>
          <p class="section-copy">${safeText(copy)}</p>
        </div>
      </div>
      ${
        matches.length
          ? `<div class="tape-grid">${matches.map((match) => renderMatchRow(match)).join('')}</div>`
          : `<p class="empty-copy">No match tape is available for this view yet.</p>`
      }
    </section>
  `;
}

function renderLeaderboard(rows = [], title = 'Leaderboard', copy = 'Top ranked performers in the current scope.') {
  return `
    <section class="surface-card">
      <div class="section-head">
        <div>
          <p class="section-kicker">Ranking</p>
          <h3 class="section-title">${safeText(title)}</h3>
          <p class="section-copy">${safeText(copy)}</p>
        </div>
      </div>
      ${
        rows.length
          ? `<div class="leaderboard-grid">
              ${rows
                .map(
                  (row) => `
                    <article class="leader-row">
                      <div class="leader-main">
                        <p class="data-title">${safeText(row.player || row.name || 'Player')}</p>
                        <p class="data-copy">${safeText(row.team || 'Archive')}</p>
                      </div>
                      <div>
                        <div class="leader-rank">#${safeText(row.rank ?? '-')}</div>
                        <p class="data-copy">${safeText(row.value ?? '-')}</p>
                      </div>
                    </article>
                  `
                )
                .join('')}
            </div>`
          : `<p class="empty-copy">No ranked rows are available.</p>`
      }
    </section>
  `;
}

function renderCompareBar(label, leftValue, rightValue, formatter = formatNumber) {
  const left = Number(leftValue || 0);
  const right = Number(rightValue || 0);
  const max = Math.max(left, right, 1);
  const leftWidth = `${Math.max((left / max) * 100, left > 0 ? 8 : 0)}%`;
  const rightWidth = `${Math.max((right / max) * 100, right > 0 ? 8 : 0)}%`;

  return `
    <div class="compare-bar-row">
      <div class="compare-bar-head">
        <span class="data-title">${safeText(label)}</span>
        <span class="data-copy">${safeText(formatter(left))} / ${safeText(formatter(right))}</span>
      </div>
      <div class="compare-bar-track">
        <span class="compare-fill left" style="width: ${leftWidth};"></span>
        <span class="compare-fill right" style="width: ${rightWidth};"></span>
      </div>
    </div>
  `;
}

function renderCanvasHeader({ eyebrow = 'Omni-Channel Canvas', title = 'Cricket Intelligence', subtitle = '', chips = [] } = {}) {
  const allChips = [statusMeta(state.status).chip, ...chips].filter(Boolean);
  elements.stageHeader.innerHTML = `
    <div class="canvas-header-copy">
      <p class="eyebrow">${safeText(eyebrow)}</p>
      <h2 class="canvas-title">${safeText(title)}</h2>
      ${subtitle ? `<p class="stage-subtitle">${safeText(subtitle)}</p>` : ''}
    </div>
    ${allChips.length ? `<div class="chip-row">${allChips.map((chip) => `<span class="meta-pill">${safeText(chip)}</span>`).join('')}</div>` : ''}
  `;
}

function setCanvasBody(html = '') {
  elements.stageContent.innerHTML = html;
}

function renderStageSkeleton(question = '') {
  renderCanvasHeader({
    eyebrow: 'Analytics Canvas',
    title: 'Mapping Query',
    subtitle: question || 'Interpreting natural language and drafting the visualization.'
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
      <div class="surface-card">
        <div class="chip-row">
          <div class="skeleton-chip"></div>
          <div class="skeleton-chip"></div>
          <div class="skeleton-chip"></div>
        </div>
        <div style="display:grid; gap:12px; margin-top:18px;">
          <div class="skeleton-line" style="width:100%;"></div>
          <div class="skeleton-line" style="width:78%;"></div>
          <div class="skeleton-line" style="width:92%;"></div>
        </div>
      </div>
    </div>
  `);
}

function renderBootStage() {
  const meta = statusMeta(state.status);
  renderCanvasHeader({
    eyebrow: 'Omni-Channel Canvas',
    title: 'Broadcast Analytics Canvas',
    subtitle: 'Natural language commands will control this stage once the archive is ready.',
    chips: [meta.pill]
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <p class="section-kicker">System Bring-Up</p>
          <h3 class="stage-title">Canvas warming under stadium lights</h3>
          <p class="stage-summary">${safeText(meta.copy)}</p>
          ${renderChipButtons(STARTER_PROMPTS.slice(0, 4), 'starter-chip')}
        </div>
        <div class="metric-grid">
          ${renderMetricCard('Status', meta.pill, 'Archive status')}
          ${renderMetricCard('Rows', formatCompact(state.status?.rows_processed || 0), 'Indexed so far')}
          ${renderMetricCard('Mode', 'Live Dark', 'Stadium Night theme')}
          ${renderMetricCard('Control', 'Chat', 'Primary command surface')}
        </div>
      </section>
      <div class="surface-card empty-state">
        <h3>Waiting for first question</h3>
        <p class="empty-copy">Ask for a player, a team, a match summary, or a head-to-head comparison to generate the first analytics scene.</p>
      </div>
    </div>
  `);
}

function renderLandingStage() {
  const home = state.home || {};
  const quickStats = home.quick_stats || {};
  const topPlayers = Array.isArray(home.top_players) ? home.top_players.slice(0, 6) : [];
  const recentMatches = Array.isArray(home.recent_matches) ? home.recent_matches.slice(0, 4) : [];
  const liveItems = Array.isArray(state.live) ? state.live.slice(0, 4) : [];

  renderCanvasHeader({
    eyebrow: 'Omni-Channel Canvas',
    title: 'Command the field with language',
    subtitle: 'Use the left command center to summon player stories, match breakdowns, and comparison visuals on demand.',
    chips: ['Canvas online', liveItems.length ? `${liveItems.length} live feeds` : 'Archive-first mode']
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <p class="section-kicker">Opening Feed</p>
          <h3 class="stage-title">Night session, full tactical visibility</h3>
          <p class="stage-summary">
            This canvas is tuned for natural language analytics. Ask for a player profile, a match summary, a team snapshot,
            or a side-by-side comparison and the stage will recompose itself instantly.
          </p>
          ${renderChipButtons(STARTER_PROMPTS, 'starter-chip')}
        </div>
        <div class="metric-grid">
          ${renderMetricCard('Matches', formatCompact(quickStats.matches || 0), 'Verified archive footprint')}
          ${renderMetricCard('Players', formatCompact(quickStats.players || 0), 'Profiles in scope')}
          ${renderMetricCard('Teams', formatCompact(quickStats.teams || 0), 'National and league mix')}
          ${renderMetricCard('Seasons', quickStats.seasons || 'N/A', 'Coverage window')}
        </div>
      </section>

      <div class="stage-grid stage-grid-2">
        ${renderLeaderboard(
          topPlayers.map((player, index) => ({
            rank: index + 1,
            player: player.name,
            team: player.team,
            value: `${formatNumber(player.runs || 0)} runs`
          })),
          'Featured Batters',
          'Highest-output names currently loaded into the archive.'
        )}
        ${renderMatchTape(
          liveItems.length ? liveItems : recentMatches,
          liveItems.length ? 'Live Signal' : 'Recent Archive Tape',
          liveItems.length
            ? 'Live or recent match context from the external match feed.'
            : 'Latest archived scorecards available in the loaded dataset.'
        )}
      </div>
    </div>
  `);
}

function renderPlayerStage(data = {}) {
  const payload = state.lastPayload || {};
  const player = data.player || {};
  const stats = data.stats || {};

  renderCanvasHeader({
    eyebrow: 'Player Intelligence',
    title: data.title || player.name || 'Player Snapshot',
    subtitle: data.subtitle || player.team || player.country || 'Archive profile'
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <div class="entity-banner">
            ${renderAvatar(player)}
            <div>
              <p class="section-kicker">Profile Surface</p>
              <h3 class="stage-title">${safeText(player.name || data.title || 'Player Snapshot')}</h3>
              <p class="stage-subtitle">${safeText(player.team || player.country || data.subtitle || 'Archive profile')}</p>
            </div>
          </div>
          <p class="stage-summary">${safeText(payload.summary || data.summary || 'No summary available.')}</p>
        </div>
        <div class="metric-grid">
          ${renderMetricCard('Matches', formatNumber(stats.matches || 0), 'Appearances')}
          ${renderMetricCard('Runs', formatNumber(stats.runs || 0), 'Batting output')}
          ${renderMetricCard('Average', formatDecimal(stats.average || 0), 'Batting average')}
          ${renderMetricCard('Strike Rate', formatDecimal(stats.strike_rate || 0), 'Scoring tempo')}
          ${renderMetricCard('Wickets', formatNumber(stats.wickets || 0), 'Bowling return')}
          ${renderMetricCard('Economy', formatDecimal(stats.economy || 0), 'Run control')}
        </div>
      </section>

      <div class="stage-grid stage-grid-2">
        <section class="surface-card">
          <div class="section-head">
            <div>
              <p class="section-kicker">Detail Matrix</p>
              <h3 class="section-title">Role Breakdown</h3>
              <p class="section-copy">Primary batting and bowling indicators from the verified archive.</p>
            </div>
          </div>
          <div class="metric-grid">
            ${renderMetricCard('Innings', formatNumber(stats.innings || 0), '')}
            ${renderMetricCard('Balls Faced', formatNumber(stats.balls_faced || 0), '')}
            ${renderMetricCard('Fours', formatNumber(stats.fours || 0), '')}
            ${renderMetricCard('Sixes', formatNumber(stats.sixes || 0), '')}
            ${renderMetricCard('Bowling Innings', formatNumber(stats.bowling_innings || 0), '')}
            ${renderMetricCard('Overs Bowled', stats.overs_bowled || '0', '')}
          </div>
        </section>
        ${renderKeyStatsPanel(payload, 'Signal Summary')}
      </div>

      <div class="stage-grid stage-grid-2">
        ${renderMatchTape(data.recent_matches || [], 'Recent Match Tape', 'Latest archived matches tied to this player.')}
        ${renderInsightsPanel(payload)}
      </div>
    </div>
  `);
}

function renderTeamStage(data = {}) {
  const payload = state.lastPayload || {};
  const team = data.team || {};
  const stats = data.stats || {};

  renderCanvasHeader({
    eyebrow: 'Team Intelligence',
    title: data.title || team.name || 'Team Snapshot',
    subtitle: data.subtitle || 'Archive scope'
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <div class="entity-banner">
            ${renderAvatar({ name: team.name || data.title || 'Team' })}
            <div>
              <p class="section-kicker">Team Surface</p>
              <h3 class="stage-title">${safeText(team.name || data.title || 'Team Snapshot')}</h3>
              <p class="stage-subtitle">${safeText(data.subtitle || 'Contextual archive view')}</p>
            </div>
          </div>
          <p class="stage-summary">${safeText(payload.summary || data.summary || 'No summary available.')}</p>
        </div>
        <div class="metric-grid">
          ${renderMetricCard('Matches', formatNumber(stats.matches || 0), 'Sample size')}
          ${renderMetricCard('Wins', formatNumber(stats.wins || 0), 'Victories')}
          ${renderMetricCard('Win Rate', formatPercent(stats.win_rate || 0), 'Conversion rate')}
          ${renderMetricCard('Average Score', formatDecimal(stats.average_score || 0), 'Runs per match')}
          ${renderMetricCard('Losses', formatNumber(stats.losses || 0), 'Defeats')}
          ${renderMetricCard('No Result', formatNumber(stats.no_result || 0), 'Incomplete outcomes')}
        </div>
      </section>

      <div class="stage-grid stage-grid-2">
        ${renderMatchTape(data.recent_matches || [], 'Recent Team Tape', 'Latest archived matches in the current team scope.')}
        ${renderInsightsPanel(payload)}
      </div>
    </div>
  `);
}

function renderCompareStage(data = {}) {
  const payload = state.lastPayload || {};
  const left = data.left || {};
  const right = data.right || {};
  const leftStats = left.stats || {};
  const rightStats = right.stats || {};

  renderCanvasHeader({
    eyebrow: 'Head-to-Head Player Comparison',
    title: data.title || `${left.name || 'Player 1'} vs ${right.name || 'Player 2'}`,
    subtitle: data.subtitle || 'Side-by-side archive comparison'
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="surface-card compare-stage">
        <div class="compare-stage-head">
          <div class="compare-competitor">
            ${renderAvatar(left)}
            <div>
              <p class="section-kicker">Left Profile</p>
              <h3 class="section-title">${safeText(left.name || 'Player 1')}</h3>
              <p class="section-copy">${safeText(left.team || left.country || 'Archive')}</p>
            </div>
          </div>
          <div class="compare-versus">VS</div>
          <div class="compare-competitor">
            ${renderAvatar(right)}
            <div>
              <p class="section-kicker">Right Profile</p>
              <h3 class="section-title">${safeText(right.name || 'Player 2')}</h3>
              <p class="section-copy">${safeText(right.team || right.country || 'Archive')}</p>
            </div>
          </div>
        </div>
        <p class="stage-summary">${safeText(payload.summary || data.summary || 'No summary available.')}</p>
        <div class="compare-stat-grid">
          <section class="surface-card">
            <div class="section-head">
              <div>
                <p class="section-kicker">Pressure Split</p>
                <h3 class="section-title">Core Metrics</h3>
              </div>
            </div>
            <div class="stage-stack">
              ${renderCompareBar('Runs', leftStats.runs || 0, rightStats.runs || 0, formatNumber)}
              ${renderCompareBar('Average', leftStats.average || 0, rightStats.average || 0, (value) => formatDecimal(value))}
              ${renderCompareBar('Strike Rate', leftStats.strike_rate || 0, rightStats.strike_rate || 0, (value) => formatDecimal(value))}
              ${renderCompareBar('Wickets', leftStats.wickets || 0, rightStats.wickets || 0, formatNumber)}
              ${renderCompareBar('Economy', leftStats.economy || 0, rightStats.economy || 0, (value) => formatDecimal(value))}
            </div>
          </section>
          ${renderKeyStatsPanel(payload, 'Compare Summary')}
        </div>
      </section>

      ${renderInsightsPanel(payload)}
    </div>
  `);
}

function renderPerformerList(title, rows = [], formatter) {
  return `
    <section class="surface-card">
      <div class="section-head">
        <div>
          <p class="section-kicker">Performance</p>
          <h3 class="section-title">${safeText(title)}</h3>
        </div>
      </div>
      ${
        rows.length
          ? `<ul class="stat-list">
              ${rows
                .map(
                  (row) => `
                    <li>
                      <p class="data-title">${safeText(row.name || 'Player')}</p>
                      <p class="data-copy">${safeText(formatter(row))}</p>
                    </li>
                  `
                )
                .join('')}
            </ul>`
          : `<p class="empty-copy">No performance rows available.</p>`
      }
    </section>
  `;
}

function renderMatchSummaryStage(data = {}) {
  const payload = state.lastPayload || {};
  const match = data.match || {};
  const scoreCards = Array.isArray(match.score)
    ? match.score.map((row) => renderMetricCard(row.inning || 'Innings', `${row.runs || 0}/${row.wickets ?? '-'}`, `${row.overs ?? '-'} overs`))
    : [];

  renderCanvasHeader({
    eyebrow: 'Match Story',
    title: data.title || match.name || 'Match Summary',
    subtitle: data.subtitle || [formatDate(match.date || ''), match.venue].filter(Boolean).join(' | ')
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <p class="section-kicker">Result Signal</p>
          <h3 class="stage-title">${safeText(match.name || 'Match Summary')}</h3>
          <p class="stage-summary">${safeText(payload.summary || data.summary || match.summary || 'No summary available.')}</p>
          <div class="stage-meta-row">
            ${match.winner ? `<span class="meta-pill">${safeText(`Winner: ${match.winner}`)}</span>` : ''}
            ${match.match_type ? `<span class="meta-pill">${safeText(match.match_type)}</span>` : ''}
            ${match.venue ? `<span class="meta-pill">${safeText(match.venue)}</span>` : ''}
          </div>
        </div>
        <div class="metric-grid">
          ${scoreCards.join('')}
        </div>
      </section>

      <div class="stage-grid stage-grid-2">
        ${renderPerformerList(
          'Top Batters',
          Array.isArray(match.top_batters) ? match.top_batters : [],
          (row) => `${row.runs || 0} runs${row.balls ? ` in ${row.balls} balls` : ''}`
        )}
        ${renderPerformerList(
          'Top Bowlers',
          Array.isArray(match.top_bowlers) ? match.top_bowlers : [],
          (row) => `${row.wickets || 0}/${row.runs_conceded || 0}${row.overs ? ` in ${row.overs}` : ''}`
        )}
      </div>

      ${renderInsightsPanel(payload)}
    </div>
  `);
}

function renderHeadToHeadStage(data = {}) {
  const payload = state.lastPayload || {};
  const stats = data.stats || {};

  renderCanvasHeader({
    eyebrow: 'Head-to-Head',
    title: data.title || `${data.team1 || 'Team 1'} vs ${data.team2 || 'Team 2'}`,
    subtitle: data.subtitle || 'Archive rivalry snapshot'
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <p class="section-kicker">Rivalry Frame</p>
          <h3 class="stage-title">${safeText(data.title || `${data.team1 || 'Team 1'} vs ${data.team2 || 'Team 2'}`)}</h3>
          <p class="stage-summary">${safeText(payload.summary || data.summary || 'No summary available.')}</p>
        </div>
        <div class="metric-grid">
          ${renderMetricCard('Matches', formatNumber(stats.matches || 0), 'Total meetings')}
          ${renderMetricCard(data.team1 || 'Team 1', formatNumber(stats.wins_team_a || 0), 'Wins')}
          ${renderMetricCard(data.team2 || 'Team 2', formatNumber(stats.wins_team_b || 0), 'Wins')}
          ${renderMetricCard('No Result', formatNumber(stats.no_result || 0), 'Shared abandonments')}
        </div>
      </section>
      <div class="stage-grid stage-grid-2">
        ${renderMatchTape(data.recent_matches || [], 'Recent Meetings', 'Latest matches in this head-to-head rivalry.')}
        ${renderInsightsPanel(payload)}
      </div>
    </div>
  `);
}

function renderTopPlayersStage(data = {}) {
  const payload = state.lastPayload || {};

  renderCanvasHeader({
    eyebrow: 'Leaderboard Surface',
    title: data.title || 'Top Players',
    subtitle: data.subtitle || 'Archive ranking'
  });

  setCanvasBody(`
    <div class="stage-stack">
      ${renderLeaderboard(data.rows || [], data.title || 'Top Players', payload.summary || data.summary || 'Ranked performers returned by the current query.')}
      ${renderInsightsPanel(payload)}
    </div>
  `);
}

function renderLiveUpdateStage(data = {}) {
  const payload = state.lastPayload || {};
  const matches = [];
  if (data.live_match?.name) matches.push(data.live_match);
  if (Array.isArray(data.upcoming_matches)) matches.push(...data.upcoming_matches);
  if (Array.isArray(data.recent_matches)) matches.push(...data.recent_matches);

  renderCanvasHeader({
    eyebrow: 'Live Match Center',
    title: data.title || 'Live Update',
    subtitle: data.subtitle || 'Current and upcoming fixtures'
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="stage-hero">
        <div>
          <p class="section-kicker">Live Feed</p>
          <h3 class="stage-title">${safeText(data.title || 'Live Match Center')}</h3>
          <p class="stage-summary">${safeText(payload.summary || data.summary || data.provider_status?.message || 'No live summary available.')}</p>
          ${data.provider_status?.title ? `<div class="stage-meta-row"><span class="meta-pill">${safeText(data.provider_status.title)}</span></div>` : ''}
        </div>
        <div class="metric-grid">
          ${renderMetricCard('Live', data.live_match?.name ? 'Active' : 'No live game', 'Current live surface')}
          ${renderMetricCard('Upcoming', formatNumber((data.upcoming_matches || []).length), 'Scheduled matches')}
          ${renderMetricCard('Recent', formatNumber((data.recent_matches || []).length), 'Recent feed items')}
          ${renderMetricCard('Tracked Player', data.player?.name || 'None', data.player?.country || 'No live player card')}
        </div>
      </section>
      ${renderMatchTape(matches.filter((match) => match?.name), 'Live / Upcoming Tape', 'Live, scheduled, and recently returned fixtures from the feed.')}
      ${renderInsightsPanel(payload)}
    </div>
  `);
}

function renderSummaryStage(data = {}) {
  const payload = state.lastPayload || {};
  const suggestions = suggestionsFromPayload(payload);

  renderCanvasHeader({
    eyebrow: 'Summary Surface',
    title: payload.title || data.title || 'Cricket Intelligence',
    subtitle: payload.summary || data.summary || 'Natural language result'
  });

  setCanvasBody(`
    <div class="stage-stack">
      <section class="surface-card">
        <div class="section-head">
          <div>
            <p class="section-kicker">Summary</p>
            <h3 class="section-title">${safeText(payload.title || data.title || 'Cricket Intelligence')}</h3>
          </div>
        </div>
        <p class="stage-summary">${safeText(payload.summary || data.summary || payload.answer || 'No summary available.')}</p>
        ${suggestions.length ? renderChipButtons(suggestions) : ''}
      </section>
      ${renderKeyStatsPanel(payload, 'Signal Summary')}
      ${renderInsightsPanel(payload)}
    </div>
  `);
}

function renderDynamicStage(data = {}) {
  switch (data.type) {
    case 'player_stats':
      renderPlayerStage(data);
      break;
    case 'team_stats':
      renderTeamStage(data);
      break;
    case 'compare_players':
      renderCompareStage(data);
      break;
    case 'match_summary':
      renderMatchSummaryStage(data);
      break;
    case 'head_to_head':
      renderHeadToHeadStage(data);
      break;
    case 'top_players':
      renderTopPlayersStage(data);
      break;
    case 'live_update':
      renderLiveUpdateStage(data);
      break;
    default:
      renderSummaryStage(data);
      break;
  }
}

function renderChatMessage(role = 'assistant', body = '') {
  const label = role === 'user' ? 'Field Producer' : 'Analytics Desk';
  const avatar = role === 'user' ? 'YOU' : 'AI';
  return `
    <article class="chat-message ${role}">
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
        Broadcast canvas is live. Ask for a player, a team, a match summary, or a direct comparison and I will redraw the analytics stage accordingly.
      </p>
      ${renderChipButtons(STARTER_PROMPTS)}
    `
  );
}

function renderPendingAssistant() {
  return appendChatMessage(
    'assistant',
    `
      <p class="chat-copy">Parsing the prompt, pulling structured evidence, and laying out the canvas.</p>
      <div class="typing-line" aria-hidden="true"><span></span><span></span><span></span></div>
    `
  );
}

function renderAssistantPayload(payload = {}) {
  const summary = payload.summary || payload.answer || 'No answer returned.';
  const suggestions = suggestionsFromPayload(payload);
  return `
    <p class="chat-copy">${safeText(summary)}</p>
    ${suggestions.length ? renderChipButtons(suggestions) : ''}
  `;
}

function renderErrorStage(message = '') {
  renderCanvasHeader({
    eyebrow: 'Canvas Fault',
    title: 'Query could not be completed',
    subtitle: 'The analytics stage did not receive a usable payload.'
  });

  setCanvasBody(`
    <div class="surface-card empty-state">
      <h3>Request failed</h3>
      <p class="empty-copy">${safeText(message || 'Unable to complete this query right now.')}</p>
      ${renderChipButtons(STARTER_PROMPTS.slice(0, 3), 'starter-chip')}
    </div>
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.summary || 'Request failed.');
  }
  return payload;
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
    state.live = Array.isArray(liveResult.value.items) ? liveResult.value.items : [];
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
  if (!cleanQuestion) return;

  state.hasAskedQuestion = true;
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

    state.lastPayload = payload;
    updateChatMessage(pendingNode, 'assistant', renderAssistantPayload(payload));
    renderDynamicStage(detailData(payload));
  } catch (error) {
    updateChatMessage(
      pendingNode,
      'assistant',
      `<p class="chat-copy">${safeText(error.message || 'Unable to complete this query right now.')}</p>`
    );
    renderErrorStage(error.message);
  } finally {
    elements.sendButton.disabled = false;
    elements.sendButton.textContent = 'Launch Query';
    elements.chatInput.value = '';
    resizeComposer();
    elements.chatInput.focus();
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

  elements.starterChips.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-question]');
    if (!button) return;
    await runQuery(button.dataset.question || '');
  });

  elements.chatThread.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-question]');
    if (!button) return;
    await runQuery(button.dataset.question || '');
  });

  elements.mobileBack.addEventListener('click', closeCanvasOnMobile);
  window.addEventListener('resize', syncViewportMode);
}

function renderStarterDeck() {
  elements.starterChips.innerHTML = STARTER_PROMPTS.map(
    (prompt) => `<button class="starter-chip" type="button" data-question="${safeText(prompt)}">${safeText(prompt)}</button>`
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
