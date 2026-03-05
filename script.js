const state = {
  options: {
    teams: [],
    seasons: [],
    venues: [],
    playerNames: []
  },
  players: {
    q: '',
    page: 1,
    limit: 12,
    totalPages: 1
  },
  matches: {
    team: '',
    season: '',
    venue: '',
    offset: 0,
    limit: 10,
    total: 0
  }
};

const $ = (selector) => document.querySelector(selector);

const pages = {
  home: $('#page-home'),
  players: $('#page-players'),
  matches: $('#page-matches'),
  compare: $('#page-compare'),
  chat: $('#page-chat')
};

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchJson(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload;
}

function switchPage(pageName) {
  Object.entries(pages).forEach(([name, element]) => {
    if (!element) return;
    element.classList.toggle('is-active', name === pageName);
  });
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.page === pageName);
  });
}

function renderQuickStats(quickStats = {}) {
  const container = $('#home-quick-stats');
  const entries = [
    ['Matches', quickStats.matches || 0],
    ['Players', quickStats.players || 0],
    ['Teams', quickStats.teams || 0],
    ['Seasons', quickStats.seasons || 'N/A']
  ];

  container.innerHTML = entries
    .map(
      ([label, value]) => `
        <article class="card">
          <p class="card-text">${safeText(label)}</p>
          <div class="card-value">${safeText(value)}</div>
        </article>
      `
    )
    .join('');
}

function renderHomePlayers(players = []) {
  const container = $('#home-top-players');
  container.innerHTML = players
    .slice(0, 6)
    .map(
      (player) => `
        <article class="card">
          <h3 class="card-title">${safeText(player.name)}</h3>
          <p class="card-text">${safeText(player.team || 'Team not available')}</p>
          <p class="card-text">Runs: ${safeText(player.runs || 0)}</p>
          <p class="card-text">Wickets: ${safeText(player.wickets || 0)}</p>
        </article>
      `
    )
    .join('');
}

function renderHomeMatches(matches = []) {
  const container = $('#home-recent-matches');
  container.innerHTML = matches
    .slice(0, 6)
    .map(
      (match) => `
        <article class="card">
          <h3 class="card-title">${safeText((match.teams || []).join(' vs '))}</h3>
          <p class="card-text">${safeText(match.date || '')}</p>
          <p class="card-text">${safeText(match.venue || '')}</p>
          <p class="card-text">${safeText(match.result || '')}</p>
        </article>
      `
    )
    .join('');
}

async function loadHome() {
  const home = await fetchJson('/api/home');
  renderQuickStats(home.quick_stats || {});
  renderHomePlayers(home.top_players || []);
  renderHomeMatches(home.recent_matches || []);
}

function renderPlayerList(payload = {}) {
  const container = $('#players-list');
  const items = payload.items || [];
  const page = payload.pagination?.page || 1;
  const totalPages = payload.pagination?.total_pages || 1;
  state.players.totalPages = totalPages;

  if (!items.length) {
    container.innerHTML = '<article class="card">No players found.</article>';
  } else {
    container.innerHTML = items
      .map(
        (player) => `
          <article class="card">
            <h3 class="card-title">${safeText(player.name)}</h3>
            <p class="card-text">${safeText(player.team || 'Team not available')}</p>
            <p class="card-text">Runs: ${safeText(player.stats?.runs || 0)}</p>
            <p class="card-text">Wickets: ${safeText(player.stats?.wickets || 0)}</p>
            <button type="button" data-player-id="${safeText(player.id)}">View details</button>
          </article>
        `
      )
      .join('');
  }

  $('#players-page-label').textContent = `Page ${page} of ${totalPages}`;
  $('#players-prev').disabled = page <= 1;
  $('#players-next').disabled = page >= totalPages;
}

function renderPlayerDetail(payload) {
  const card = $('#player-detail');
  const stats = payload.stats || {};
  const recent = payload.recent_matches || [];
  const head = recent.slice(0, 3);
  const tail = recent.slice(3, 5);

  card.classList.remove('hidden');
  card.innerHTML = `
    <h2>${safeText(payload.name)}</h2>
    <p class="card-text">${safeText(payload.team || 'Team not available')}</p>
    <table class="simple-table">
      <tbody>
        <tr><th>Runs</th><td>${safeText(stats.runs || 0)}</td></tr>
        <tr><th>Wickets</th><td>${safeText(stats.wickets || 0)}</td></tr>
        <tr><th>Average</th><td>${safeText(stats.average || 0)}</td></tr>
        <tr><th>Strike Rate</th><td>${safeText(stats.strike_rate || 0)}</td></tr>
        <tr><th>Economy</th><td>${safeText(stats.economy || 0)}</td></tr>
      </tbody>
    </table>
    <h3>Recent Matches</h3>
    <ul>
      ${head
        .map((match) => `<li>${safeText(match.date || '')} - ${safeText((match.teams || []).join(' vs '))}</li>`)
        .join('')}
    </ul>
    ${
      tail.length
        ? `
          <details>
            <summary>Show more</summary>
            <ul>
              ${tail
                .map(
                  (match) =>
                    `<li>${safeText(match.date || '')} - ${safeText((match.teams || []).join(' vs '))}</li>`
                )
                .join('')}
            </ul>
          </details>
        `
        : ''
    }
  `;
}

async function loadPlayers() {
  const q = encodeURIComponent(state.players.q || '');
  const page = state.players.page;
  const limit = state.players.limit;
  const payload = await fetchJson(`/api/players/search?q=${q}&page=${page}&limit=${limit}`);
  renderPlayerList(payload);
}

function renderMatches(payload = {}) {
  const container = $('#matches-list');
  const items = payload.items || [];
  const total = payload.pagination?.total || 0;
  const offset = payload.pagination?.offset || 0;
  const limit = payload.pagination?.limit || state.matches.limit;

  state.matches.total = total;
  state.matches.offset = offset;
  state.matches.limit = limit;

  if (!items.length) {
    container.innerHTML = '<article class="card">No matches found.</article>';
  } else {
    container.innerHTML = items
      .map(
        (match) => `
          <article class="card">
            <h3 class="card-title">${safeText((match.teams || []).join(' vs '))}</h3>
            <p class="card-text">${safeText(match.date || '')} - ${safeText(match.season || '')}</p>
            <p class="card-text">${safeText(match.venue || '')}</p>
            <p class="card-text">${safeText(match.result || '')}</p>
            <button type="button" data-match-id="${safeText(match.id)}">View details</button>
          </article>
        `
      )
      .join('');
  }

  const start = total ? offset + 1 : 0;
  const end = Math.min(offset + limit, total);
  $('#matches-page-label').textContent = `Showing ${start}-${end} of ${total}`;
  $('#matches-prev').disabled = offset <= 0;
  $('#matches-next').disabled = offset + limit >= total;
}

function renderMatchDetail(match) {
  const card = $('#match-detail');
  card.classList.remove('hidden');
  const topBatters = (match.top_batters || [])
    .slice(0, 3)
    .map((row) => `${row.name} ${row.runs}`)
    .join(', ');
  const topBowlers = (match.top_bowlers || [])
    .slice(0, 3)
    .map((row) => `${row.name} ${row.wickets}/${row.runs_conceded}`)
    .join(', ');

  card.innerHTML = `
    <h2>${safeText((match.teams || []).join(' vs '))}</h2>
    <p class="card-text">${safeText(match.date || '')} - ${safeText(match.venue || '')}</p>
    <p class="card-text">Winner: ${safeText(match.winner || 'Not available')}</p>
    <p class="card-text">${safeText(match.summary || '')}</p>
    <p class="card-text">Top batters: ${safeText(topBatters || 'Not available')}</p>
    <p class="card-text">Top bowlers: ${safeText(topBowlers || 'Not available')}</p>
  `;
}

async function loadMatches() {
  const params = new URLSearchParams({
    limit: String(state.matches.limit),
    offset: String(state.matches.offset)
  });
  if (state.matches.team) params.set('team', state.matches.team);
  if (state.matches.season) params.set('season', state.matches.season);
  if (state.matches.venue) params.set('venue', state.matches.venue);
  const payload = await fetchJson(`/api/matches?${params.toString()}`);
  renderMatches(payload);
}

function fillOptions({ teams = [], seasons = [], venues = [] }) {
  state.options.teams = teams;
  state.options.seasons = seasons;
  state.options.venues = venues;

  const teamSelect = $('#matches-team-filter');
  const seasonSelect = $('#matches-season-filter');
  const venueSelect = $('#matches-venue-filter');

  teamSelect.innerHTML = '<option value="">All teams</option>';
  teams.forEach((team) => {
    teamSelect.insertAdjacentHTML('beforeend', `<option value="${safeText(team)}">${safeText(team)}</option>`);
  });

  seasonSelect.innerHTML = '<option value="">All seasons</option>';
  seasons.forEach((season) => {
    seasonSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${safeText(season)}">${safeText(season)}</option>`
    );
  });

  venueSelect.innerHTML = '<option value="">All venues</option>';
  venues.forEach((venue) => {
    venueSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${safeText(venue)}">${safeText(venue)}</option>`
    );
  });
}

async function loadPlayerNames() {
  const payload = await fetchJson('/api/players/search?page=1&limit=200');
  state.options.playerNames = (payload.items || []).map((row) => row.name);
  const dataList = $('#player-options');
  dataList.innerHTML = state.options.playerNames
    .map((name) => `<option value="${safeText(name)}"></option>`)
    .join('');
}

function tableFromCompareData(data = {}) {
  if (!data.left || !data.right) return '<p class="card-text">Comparison not available.</p>';
  const left = data.left;
  const right = data.right;

  return `
    <table class="simple-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>${safeText(left.name)}</th>
          <th>${safeText(right.name)}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Runs</td><td>${safeText(left.stats?.runs || 0)}</td><td>${safeText(right.stats?.runs || 0)}</td></tr>
        <tr><td>Wickets</td><td>${safeText(left.stats?.wickets || 0)}</td><td>${safeText(right.stats?.wickets || 0)}</td></tr>
        <tr><td>Average</td><td>${safeText(left.stats?.average || 0)}</td><td>${safeText(right.stats?.average || 0)}</td></tr>
        <tr><td>Strike Rate</td><td>${safeText(left.stats?.strike_rate || 0)}</td><td>${safeText(right.stats?.strike_rate || 0)}</td></tr>
        <tr><td>Economy</td><td>${safeText(left.stats?.economy || 0)}</td><td>${safeText(right.stats?.economy || 0)}</td></tr>
      </tbody>
    </table>
  `;
}

async function runCompare() {
  const left = $('#compare-player-1').value.trim();
  const right = $('#compare-player-2').value.trim();
  const resultBox = $('#compare-result');
  if (!left || !right) {
    resultBox.innerHTML = '<article class="card">Please enter both player names.</article>';
    return;
  }

  resultBox.innerHTML = '<article class="card">Loading comparison...</article>';
  const payload = await fetchJson('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: `Compare ${left} vs ${right}`
    })
  });

  resultBox.innerHTML = `
    <article class="card">
      <p>${safeText(payload.answer || '')}</p>
      ${tableFromCompareData(payload.data)}
    </article>
  `;
}

function detailsForData(data = {}) {
  const type = data.type || '';
  if (type === 'player_stats') {
    return `
      <table class="simple-table">
        <tbody>
          <tr><th>Player</th><td>${safeText(data.player?.name || '')}</td></tr>
          <tr><th>Runs</th><td>${safeText(data.stats?.runs || 0)}</td></tr>
          <tr><th>Wickets</th><td>${safeText(data.stats?.wickets || 0)}</td></tr>
          <tr><th>Average</th><td>${safeText(data.stats?.average || 0)}</td></tr>
          <tr><th>Strike Rate</th><td>${safeText(data.stats?.strike_rate || 0)}</td></tr>
          <tr><th>Economy</th><td>${safeText(data.stats?.economy || 0)}</td></tr>
        </tbody>
      </table>
    `;
  }
  if (type === 'team_stats') {
    return `
      <table class="simple-table">
        <tbody>
          <tr><th>Team</th><td>${safeText(data.team?.name || '')}</td></tr>
          <tr><th>Matches</th><td>${safeText(data.stats?.matches || 0)}</td></tr>
          <tr><th>Wins</th><td>${safeText(data.stats?.wins || 0)}</td></tr>
          <tr><th>Win Rate</th><td>${safeText(data.stats?.win_rate || 0)}%</td></tr>
        </tbody>
      </table>
    `;
  }
  if (type === 'top_players') {
    const rows = (data.rows || []).slice(0, 10);
    return `
      <table class="simple-table">
        <thead>
          <tr><th>Rank</th><th>Player</th><th>Team</th><th>Value</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr><td>${safeText(row.rank)}</td><td>${safeText(row.player)}</td><td>${safeText(
                  row.team
                )}</td><td>${safeText(row.value)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }
  if (type === 'compare_players') {
    return tableFromCompareData(data);
  }
  if (type === 'match_summary') {
    return `
      <table class="simple-table">
        <tbody>
          <tr><th>Match</th><td>${safeText((data.match?.teams || []).join(' vs '))}</td></tr>
          <tr><th>Date</th><td>${safeText(data.match?.date || '')}</td></tr>
          <tr><th>Venue</th><td>${safeText(data.match?.venue || '')}</td></tr>
          <tr><th>Winner</th><td>${safeText(data.match?.winner || '')}</td></tr>
        </tbody>
      </table>
    `;
  }
  if (type === 'head_to_head') {
    return `
      <table class="simple-table">
        <tbody>
          <tr><th>Teams</th><td>${safeText(data.team1 || '')} vs ${safeText(data.team2 || '')}</td></tr>
          <tr><th>Matches</th><td>${safeText(data.stats?.matches || 0)}</td></tr>
          <tr><th>${safeText(data.team1 || '')} Wins</th><td>${safeText(data.stats?.wins_team_a || 0)}</td></tr>
          <tr><th>${safeText(data.team2 || '')} Wins</th><td>${safeText(data.stats?.wins_team_b || 0)}</td></tr>
        </tbody>
      </table>
    `;
  }
  if (type === 'glossary') {
    return `<p class="card-text">Term: ${safeText(data.term || '')}</p>`;
  }
  return '<p class="card-text">No extra details.</p>';
}

function appendMessage(kind, contentHtml) {
  const box = $('#chat-messages');
  box.insertAdjacentHTML(
    'beforeend',
    `
      <article class="msg ${kind}">
        <div class="msg-head">${kind === 'user' ? 'You' : 'Cricket Stats'}</div>
        ${contentHtml}
      </article>
    `
  );
  box.scrollTop = box.scrollHeight;
}

async function askChat(question) {
  appendMessage('user', `<p>${safeText(question)}</p>`);
  const sendButton = $('#chat-send');
  sendButton.disabled = true;
  sendButton.textContent = 'Sending...';

  try {
    const payload = await fetchJson('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question
      })
    });

    const details = detailsForData(payload.data || {});
    const followups =
      payload.followups && payload.followups.length
        ? `<p class="card-text">Try next: ${safeText(payload.followups.slice(0, 3).join(' | '))}</p>`
        : '';

    appendMessage(
      'bot',
      `
        <p>${safeText(payload.answer || '')}</p>
        <details>
          <summary>Show details</summary>
          ${details}
        </details>
        ${followups}
      `
    );
  } catch (error) {
    appendMessage('bot', `<p>${safeText(error.message || 'Unable to answer right now.')}</p>`);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => switchPage(button.dataset.page));
  });

  $('#players-search-btn').addEventListener('click', async () => {
    state.players.q = $('#players-search').value.trim();
    state.players.page = 1;
    await loadPlayers();
  });

  $('#players-prev').addEventListener('click', async () => {
    if (state.players.page <= 1) return;
    state.players.page -= 1;
    await loadPlayers();
  });

  $('#players-next').addEventListener('click', async () => {
    if (state.players.page >= state.players.totalPages) return;
    state.players.page += 1;
    await loadPlayers();
  });

  $('#players-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    const player = await fetchJson(`/api/players/${encodeURIComponent(button.dataset.playerId)}`);
    renderPlayerDetail(player);
  });

  $('#matches-apply-filter').addEventListener('click', async () => {
    state.matches.team = $('#matches-team-filter').value;
    state.matches.season = $('#matches-season-filter').value;
    state.matches.venue = $('#matches-venue-filter').value;
    state.matches.offset = 0;
    await loadMatches();
  });

  $('#matches-prev').addEventListener('click', async () => {
    if (state.matches.offset <= 0) return;
    state.matches.offset = Math.max(0, state.matches.offset - state.matches.limit);
    await loadMatches();
  });

  $('#matches-next').addEventListener('click', async () => {
    if (state.matches.offset + state.matches.limit >= state.matches.total) return;
    state.matches.offset += state.matches.limit;
    await loadMatches();
  });

  $('#matches-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-match-id]');
    if (!button) return;
    const match = await fetchJson(`/api/matches/${encodeURIComponent(button.dataset.matchId)}`);
    renderMatchDetail(match);
  });

  $('#compare-run').addEventListener('click', async () => {
    await runCompare();
  });

  $('#chat-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#chat-question');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    await askChat(question);
  });

  $('#chat-suggestions').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-question]');
    if (!button) return;
    await askChat(button.dataset.question || '');
  });

}

async function init() {
  bindEvents();

  $('#home-quick-stats').innerHTML = '<article class="card">Loading...</article>';
  $('#players-list').innerHTML = '<article class="card">Loading...</article>';
  $('#matches-list').innerHTML = '<article class="card">Loading...</article>';

  const [options] = await Promise.all([fetchJson('/api/options')]);
  fillOptions(options);
  await Promise.all([loadHome(), loadPlayers(), loadMatches(), loadPlayerNames()]);
}

init().catch((error) => {
  console.error(error);
  $('#chat-messages').innerHTML = `<article class="msg bot"><p>${safeText(error.message)}</p></article>`;
});
