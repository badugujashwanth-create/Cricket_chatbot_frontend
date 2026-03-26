const ARCHIVE_TOTAL_ROWS = 10850731;

const state = {
  options: {
    teams: [],
    seasons: [],
    playerNames: []
  },
  players: {
    query: '',
    page: 1,
    limit: 20,
    totalPages: 1,
    total: 0,
    items: [],
    isLoading: false,
    isAppending: false,
    exhausted: false,
    prefetched: new Map(),
    cache: new Map(),
    requestToken: 0,
    controller: null,
    searchDebounce: null
  },
  matches: {
    team: '',
    season: '',
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
    cache: new Map(),
    prefetched: new Map(),
    controller: null,
    requestToken: 0,
    isLoading: false
  },
  home: {
    quickStats: {},
    topPlayers: [],
    recentMatches: [],
    livePulse: [],
    trendingPlayers: []
  },
  ui: {
    activePage: 'home',
    theme: 'light',
    sidebarCollapsed: false,
    playersObserver: null,
    sectionObserver: null
  },
  datasetStatus: {
    status: 'idle',
    rows_processed: 0
  },
  playerImages: new Map(),
  playerDetails: new Map(),
  matchDetails: new Map()
};

const pageMeta = {
  home: {
    title: 'Dashboard',
    subtitle: 'A single premium workspace for players, matches, comparisons, and AI insights.'
  },
  players: {
    title: 'Players',
    subtitle: 'Search player profiles, scan form, and open detailed summaries.'
  },
  matches: {
    title: 'Matches',
    subtitle: 'Filter scorecards, jump into summaries, and review recent contests.'
  },
  compare: {
    title: 'Compare',
    subtitle: 'Put two players side by side with an analyst-style comparison panel.'
  },
  chat: {
    title: 'Chat',
    subtitle: 'Ask archive, live, and comparison questions in one conversation.'
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

function debounce(fn, wait = 250) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
}

function trimCache(map = new Map(), maxEntries = 60) {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
}

function setMapCache(map = new Map(), key = '', value, maxEntries = 60) {
  if (!key) return value;
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  trimCache(map, maxEntries);
  return value;
}

function getMapCache(map = new Map(), key = '') {
  if (!key || !map.has(key)) return null;
  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

function abortRequest(controller) {
  if (controller) {
    controller.abort();
  }
}

function playerListKey({ query = state.players.query, page = 1, limit = state.players.limit } = {}) {
  return JSON.stringify({
    query: normalizeText(query || ''),
    page: Number(page || 1),
    limit: Number(limit || state.players.limit)
  });
}

function matchesListKey({
  team = state.matches.team,
  season = state.matches.season,
  page = state.matches.page,
  limit = state.matches.limit
} = {}) {
  return JSON.stringify({
    team: normalizeText(team || ''),
    season: normalizeText(season || ''),
    page: Number(page || 1),
    limit: Number(limit || state.matches.limit)
  });
}

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatCompact(value) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function formatDate(value = '') {
  if (!value) return 'Date not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'CS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function hashString(text = '') {
  return [...String(text || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function hueForValue(text = '') {
  return hashString(text) % 360;
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildAvatarDataUri(name = '') {
  const initials = getInitials(name);
  const hue = hueForValue(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 68%, 54%)" />
          <stop offset="100%" stop-color="hsl(${(hue + 55) % 360}, 82%, 63%)" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#g)" />
      <circle cx="60" cy="60" r="54" fill="rgba(255,255,255,0.08)" />
      <text x="60" y="70" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="42" font-weight="700" fill="#07131d">${initials}</text>
    </svg>
  `;
  return svgToDataUri(svg);
}

function teamCode(name = '') {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'TM';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase();
}

function buildTeamLogoDataUri(name = '') {
  const code = teamCode(name);
  const hue = hueForValue(name) + 30;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="crest" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue % 360}, 62%, 46%)" />
          <stop offset="100%" stop-color="hsl(${(hue + 80) % 360}, 82%, 60%)" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="96" height="96" rx="28" fill="url(#crest)" />
      <path d="M60 22 L91 36 V62 C91 82 75 96 60 102 C45 96 29 82 29 62 V36 Z" fill="rgba(255,255,255,0.14)" />
      <text x="60" y="72" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="28" font-weight="700" fill="#f7fcff">${code}</text>
    </svg>
  `;
  return svgToDataUri(svg);
}

function playerImageEntry(name = '') {
  const key = normalizeText(name);
  const cached = state.playerImages.get(key);
  if (cached) return cached;
  return {
    image_url: buildAvatarDataUri(name),
    country: '',
    resolved: false
  };
}

function imageUrlForPlayer(name = '') {
  return playerImageEntry(name).image_url || buildAvatarDataUri(name);
}

function countryForPlayer(player = {}) {
  if (player.country) return player.country;
  return playerImageEntry(player.name || '').country || '';
}

function applyImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback-src]').forEach((img) => {
    img.onerror = () => {
      if (img.dataset.failed === 'true') return;
      img.dataset.failed = 'true';
      img.src = img.dataset.fallbackSrc;
    };
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.summary || 'Request failed');
  }
  return payload;
}

function loadTheme() {
  const stored = localStorage.getItem('cricket-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  state.ui.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('cricket-theme', theme);
  $('#theme-toggle-label').textContent = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

function setSidebarCollapsed(collapsed) {
  state.ui.sidebarCollapsed = collapsed;
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

function updatePageChrome(pageName = 'home') {
  const meta = pageMeta[pageName] || pageMeta.home;
  $('#page-title').textContent = meta.title;
  $('#page-subtitle').textContent = meta.subtitle;
}

function setActivePage(pageName = 'home') {
  state.ui.activePage = pageName;

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.page === pageName);
  });

  updatePageChrome(pageName);
}

function pageFocusSelector(pageName = '') {
  if (pageName === 'players') return '#players-search';
  if (pageName === 'matches') return '#matches-team-filter';
  if (pageName === 'compare') return '#compare-player-1';
  if (pageName === 'chat') return '#chat-question';
  return '';
}

function scrollToPage(pageName = 'home', { behavior = 'smooth', focusSelector = '' } = {}) {
  const element = pages[pageName];
  if (!element) return;

  element.scrollIntoView({
    behavior,
    block: 'start'
  });

  if (focusSelector) {
    const target = element.querySelector(focusSelector);
    if (target) {
      window.setTimeout(() => {
        target.focus({ preventScroll: true });
      }, behavior === 'smooth' ? 320 : 0);
    }
  }
}

function switchPage(pageName = 'home', { scroll = true, behavior = 'smooth', focusSelector = '' } = {}) {
  setActivePage(pageName);
  closeSidebar();
  if (scroll) {
    scrollToPage(pageName, {
      behavior,
      focusSelector
    });
  }
}

function setupSectionObserver() {
  if (state.ui.sectionObserver || !('IntersectionObserver' in window)) return;

  const entriesByName = new Map();
  state.ui.sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pageName = entry.target.id.replace(/^page-/, '');
        entriesByName.set(pageName, entry);
      });

      const visible = [...entriesByName.entries()]
        .filter(([, entry]) => entry.isIntersecting)
        .sort((left, right) => {
          if (right[1].intersectionRatio !== left[1].intersectionRatio) {
            return right[1].intersectionRatio - left[1].intersectionRatio;
          }
          return Math.abs(left[1].boundingClientRect.top) - Math.abs(right[1].boundingClientRect.top);
        })[0];

      if (visible?.[0]) {
        setActivePage(visible[0]);
      }
    },
    {
      rootMargin: '-16% 0px -48% 0px',
      threshold: [0.1, 0.2, 0.35, 0.5]
    }
  );

  Object.values(pages).forEach((element) => {
    if (element) {
      state.ui.sectionObserver.observe(element);
    }
  });
}

function loadingProgress(status = {}) {
  const rows = Number(status.rows_processed || 0);
  if (!rows) return 8;
  return Math.min(100, Math.max(10, Math.round((rows / ARCHIVE_TOTAL_ROWS) * 100)));
}

function statusMessage(status = {}) {
  const rows = Number(status.rows_processed || 0);
  if (status.status === 'ready') {
    return {
      title: 'Archive ready',
      copy: 'The local dataset is fully loaded and ready for search.',
      badge: 'Archive ready'
    };
  }

  if (status.status === 'error') {
    return {
      title: 'Archive error',
      copy: status.error || 'The local dataset failed to load.',
      badge: 'Archive error'
    };
  }

  if (status.status === 'loading') {
    return {
      title: 'Loading archive',
      copy: rows ? `${formatNumber(rows)} rows processed so far.` : 'Preparing the local dataset.',
      badge: rows ? `Loading ${loadingProgress(status)}%` : 'Archive warming up'
    };
  }

  return {
    title: 'Preparing archive',
    copy: 'Connecting to the local dataset.',
    badge: 'Preparing archive'
  };
}

function updateArchiveStatus(status = {}) {
  state.datasetStatus = status;
  const meta = statusMessage(status);
  $('#status-title').textContent = meta.title;
  $('#status-copy').textContent = meta.copy;
  $('#header-status-badge').textContent = meta.badge;
}

function matchLabel(match = {}) {
  const teams = Array.isArray(match.teams) ? match.teams.filter(Boolean) : [];
  if (teams.length >= 2) return `${teams[0]} vs ${teams[1]}`;
  if (teams.length === 1) return teams[0];
  return String(match.name || 'Match');
}

function matchSummary(match = {}) {
  return match.summary || match.result || match.status || match.winner || 'Summary not available';
}

function scoreLine(score = {}) {
  const wickets = score.wickets === null || score.wickets === undefined ? '-' : score.wickets;
  const overs = score.overs === null || score.overs === undefined ? '-' : score.overs;
  return `${score.inning || 'Team'} ${score.runs || 0}/${wickets} (${overs})`;
}

function chooseBestPlayerMatch(items = [], playerName = '') {
  const cleanTarget = normalizeText(playerName);
  if (!cleanTarget) return null;

  return [...items]
    .map((item) => {
      const cleanName = normalizeText(item.name || '');
      let score = 0;
      if (cleanName === cleanTarget) score += 100;
      if (cleanName.startsWith(cleanTarget) || cleanTarget.startsWith(cleanName)) score += 60;
      if (cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName)) score += 40;
      const targetParts = cleanTarget.split(' ');
      const candidateParts = cleanName.split(' ');
      const targetLast = targetParts[targetParts.length - 1] || '';
      const candidateLast = candidateParts[candidateParts.length - 1] || '';
      if (targetLast && targetLast === candidateLast) score += 20;
      return { item, score };
    })
    .sort((left, right) => right.score - left.score)[0]?.item || null;
}

async function resolvePlayerImage(name = '') {
  const key = normalizeText(name);
  if (!key) {
    return {
      image_url: buildAvatarDataUri(name),
      country: '',
      resolved: true
    };
  }

  const existing = state.playerImages.get(key);
  if (existing?.resolved) return existing;
  if (existing?.loading) return existing;

  const fallback = existing || {
    image_url: buildAvatarDataUri(name),
    country: '',
    resolved: false
  };

  state.playerImages.set(key, { ...fallback, loading: true });

  try {
    const payload = await fetchJson(`/api/cricapi/players/search?q=${encodeURIComponent(name)}&limit=4`);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const best = chooseBestPlayerMatch(items, name);
    const resolved = {
      image_url: best?.image_url || fallback.image_url,
      country: best?.country || fallback.country || '',
      resolved: true
    };
    state.playerImages.set(key, resolved);
    return resolved;
  } catch (_) {
    const resolved = { ...fallback, resolved: true };
    state.playerImages.set(key, resolved);
    return resolved;
  }
}

async function hydrateFeaturedPlayerImages(players = [], rerender) {
  const names = [...new Set(players.map((player) => String(player?.name || '').trim()).filter(Boolean))];
  const unresolved = names.filter((name) => !state.playerImages.get(normalizeText(name))?.resolved);
  if (!unresolved.length) return;
  await Promise.allSettled(unresolved.slice(0, 8).map((name) => resolvePlayerImage(name)));
  if (typeof rerender === 'function') {
    rerender();
  }
}

function renderSkeletonCard() {
  return `
    <article class="card loading-card">
      <div class="player-head">
        <div class="skeleton-avatar"></div>
        <div class="stack-list" style="width: 100%;">
          <div class="skeleton-line" style="width: 72%;"></div>
          <div class="skeleton-line" style="width: 48%;"></div>
        </div>
      </div>
      <div class="metric-chip-row">
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
      </div>
      <div class="skeleton-line" style="width: 100%;"></div>
    </article>
  `;
}

function renderSkeletonGrid(count = 3) {
  return Array.from({ length: count }, () => renderSkeletonCard()).join('');
}

function setPlayersLoadingState({ initial = false, loading = false, count = 3 } = {}) {
  const inlineLoader = $('#players-loading-more');
  const skeletons = $('#players-load-more-skeletons');
  if (initial) {
    $('#players-list').innerHTML = loading ? renderSkeletonGrid(count) : $('#players-list').innerHTML;
  }
  inlineLoader.classList.toggle('hidden', !loading || initial);
  skeletons.classList.toggle('hidden', !loading || initial);
  if (!initial) {
    skeletons.innerHTML = loading ? renderSkeletonGrid(count) : '';
  }
}

function setMatchesLoadingState(loading = false, count = 4) {
  const container = $('#matches-list');
  if (!loading) return;
  container.innerHTML = renderSkeletonGrid(count);
}

function renderLoadingPanel(status = {}) {
  const progress = loadingProgress(status);
  const meta = statusMessage(status);
  return `
    <article class="card loading-card">
      <div class="match-card-top">
        <div class="spinner" aria-hidden="true"></div>
        <div>
          <strong>${safeText(meta.title)}</strong>
          <p class="card-meta">${safeText(meta.copy)}</p>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${progress}%;"></div>
      </div>
      <p class="metric-note">Large archive loads take a few minutes on the first start.</p>
    </article>
  `;
}

function preferredPlayerName(player = {}) {
  return player.canonical_name || player.name || 'Player';
}

function preferredPlayerImageUrl(player = {}) {
  return String(player.image_url || player.imageUrl || '').trim() || imageUrlForPlayer(preferredPlayerName(player));
}

function renderMessageHtml(kind, bodyHtml) {
  const label = kind === 'user' ? 'You' : 'Cricket AI';
  const initials = kind === 'user' ? 'You' : 'AI';
  return `
    <article class="msg ${kind}">
      <div class="msg-head">
        <span class="msg-avatar">${safeText(initials)}</span>
        <span>${safeText(label)}</span>
      </div>
      ${bodyHtml}
    </article>
  `;
}

function renderBootState(status = {}) {
  updateArchiveStatus(status);
  $('#hero-chip-row').innerHTML = `
    <span class="mini-chip">Archive warming</span>
    <span class="mini-chip">${safeText(status.rows_processed ? `${formatNumber(status.rows_processed)} rows` : 'Connecting')}</span>
    <span class="mini-chip">Live pulse ready after boot</span>
  `;
  $('#home-live-pulse').innerHTML = renderLoadingPanel(status);
  $('#home-quick-stats').innerHTML = Array.from({ length: 4 }, () => '<article class="card skeleton-card"></article>').join('');
  $('#home-top-players').innerHTML = renderSkeletonGrid(3);
  $('#home-trending-players').innerHTML = renderSkeletonGrid(3);
  $('#home-recent-matches').innerHTML = renderSkeletonGrid(4);
  $('#players-list').innerHTML = renderSkeletonGrid(6);
  $('#matches-list').innerHTML = renderSkeletonGrid(4);
  $('#compare-result').innerHTML = renderLoadingPanel(status);
  $('#chat-messages').innerHTML = renderMessageHtml(
    'bot',
    `
      <div class="msg-body">
        <p>Preparing the archive. You can explore the layout while the dataset finishes loading.</p>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${loadingProgress(status)}%;"></div>
        </div>
      </div>
    `
  );
}

async function waitForDatasetReady({ timeoutMs = 15 * 60 * 1000, pollMs = 3000 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await fetchJson('/api/status');
      renderBootState(status);

      if (status.status === 'ready') {
        updateArchiveStatus(status);
        return status;
      }

      if (status.status === 'error') {
        throw new Error(status.error || 'The local dataset failed to load.');
      }
    } catch (error) {
      renderBootState({
        status: 'loading',
        rows_processed: 0,
        error: error.message
      });
    }

    await delay(pollMs);
  }

  throw new Error('The local dataset is still loading. Please refresh in a moment.');
}

function renderEmptyState(title, description) {
  return `
    <article class="card empty-state">
      <strong>${safeText(title)}</strong>
      <p class="empty-text">${safeText(description)}</p>
    </article>
  `;
}

function renderPlayerAvatar(player = {}, { large = false } = {}) {
  const name = preferredPlayerName(player);
  const fallback = buildAvatarDataUri(name);
  const imageUrl = preferredPlayerImageUrl(player);
  const sizeClass = large ? 'avatar lg' : 'avatar';
  const wrapClass = large ? 'avatar-wrap lg' : 'avatar-wrap';
  const size = large ? 92 : 72;

  return `
    <div class="${wrapClass}">
      <img
        class="${sizeClass}"
        src="${safeText(imageUrl)}"
        data-fallback-src="${safeText(fallback)}"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        width="${size}"
        height="${size}"
        alt="${safeText(name)}"
      />
    </div>
  `;
}

function playerHeader(player = {}) {
  const country = countryForPlayer(player);
  const name = preferredPlayerName(player);
  return `
    <div class="player-head player-card-identity">
      ${renderPlayerAvatar(player)}
      <div class="player-meta">
        <strong class="player-name">${safeText(name)}</strong>
        <p class="player-team">${safeText(player.team || country || 'Team not available')}</p>
      </div>
    </div>
  `;
}

function renderStatChip(label, value) {
  return `<span class="stat-chip"><strong>${safeText(value)}</strong> ${safeText(label)}</span>`;
}

function renderDatasetChip(player = {}, label = 'Archive alias') {
  const datasetName = String(player.dataset_name || '').trim();
  const canonicalName = preferredPlayerName(player);
  if (!datasetName || normalizeText(datasetName) === normalizeText(canonicalName)) return '';
  return `<span class="mini-chip">${safeText(label)}: ${safeText(datasetName)}</span>`;
}

function compareMetricValue(stats = {}, key = '') {
  const value = Number(stats?.[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function formatCompareMetric(key = '', value = 0) {
  if (key === 'runs' || key === 'wickets') return formatNumber(Math.round(value));
  return Number(value || 0).toFixed(2);
}

function renderComparisonBar(label, leftValue, rightValue, key) {
  const left = compareMetricValue({ value: leftValue }, 'value');
  const right = compareMetricValue({ value: rightValue }, 'value');
  const max = Math.max(left, right, 1);
  const leftWidth = `${Math.max((left / max) * 100, left > 0 ? 8 : 0)}%`;
  const rightWidth = `${Math.max((right / max) * 100, right > 0 ? 8 : 0)}%`;

  return `
    <div class="compare-bar-row">
      <div class="compare-bar-copy">
        <strong>${safeText(label)}</strong>
        <span>${safeText(formatCompareMetric(key, left))} vs ${safeText(formatCompareMetric(key, right))}</span>
      </div>
      <div class="compare-bar-track" aria-hidden="true">
        <span class="compare-bar-fill left" style="width: ${leftWidth};"></span>
        <span class="compare-bar-fill right" style="width: ${rightWidth};"></span>
      </div>
    </div>
  `;
}

function renderPlayerCard(player = {}) {
  const stats = player.stats || {};
  const matches = stats.matches || player.matches || 0;
  const runs = stats.runs || player.runs || 0;
  const wickets = stats.wickets || player.wickets || 0;
  const average = Number(stats.average || player.average || 0).toFixed(2);
  return `
    <article class="card player-card">
      <div class="player-card-top">
        ${playerHeader(player)}
        <span class="player-badge">Verified Player</span>
      </div>
      <div class="player-stat-preview">
        <div class="player-stat-item">
          <span class="player-stat-label">Matches</span>
          <strong class="player-stat-value">${safeText(formatNumber(matches))}</strong>
        </div>
        <div class="player-stat-item">
          <span class="player-stat-label">Runs</span>
          <strong class="player-stat-value">${safeText(formatCompact(runs))}</strong>
        </div>
        <div class="player-stat-item">
          <span class="player-stat-label">Wickets</span>
          <strong class="player-stat-value">${safeText(formatCompact(wickets))}</strong>
        </div>
        <div class="player-stat-item">
          <span class="player-stat-label">Average</span>
          <strong class="player-stat-value">${safeText(average)}</strong>
        </div>
      </div>
      <p class="card-meta player-card-copy">
        Strike rate ${safeText(Number(stats.strike_rate || player.strike_rate || 0).toFixed(2))},
        economy ${safeText(Number(stats.economy || player.economy || 0).toFixed(2))}.
      </p>
      <div class="card-actions">
        <button class="ghost-button" type="button" data-player-id="${safeText(player.id || '')}">Open profile</button>
      </div>
    </article>
  `;
}

function renderTrendCard(player = {}) {
  const stats = player.stats || {};
  const name = preferredPlayerName(player);
  return `
    <article class="card trend-card">
      <div class="player-head">
        ${renderPlayerAvatar(player)}
        <div class="player-meta">
          <strong class="player-name">${safeText(name)}</strong>
          <p class="player-team">${safeText(player.team || countryForPlayer(player) || 'Archive')}</p>
        </div>
      </div>
      <div class="metric-chip-row">
        <span class="mini-chip">SR ${safeText(Number(stats.strike_rate || player.strike_rate || 0).toFixed(1))}</span>
        <span class="mini-chip">Runs ${safeText(formatCompact(stats.runs || player.runs || 0))}</span>
      </div>
    </article>
  `;
}

function renderTeamRow(name = '') {
  const logo = buildTeamLogoDataUri(name);
  return `
    <div class="match-team-row">
      <img class="team-logo" src="${safeText(logo)}" alt="${safeText(name || 'Team')}" loading="lazy" />
      <div class="player-meta">
        <strong>${safeText(name || 'Team')}</strong>
        <p class="player-team">${safeText(teamCode(name || 'TM'))}</p>
      </div>
    </div>
  `;
}

function renderMatchCard(match = {}) {
  const teams = Array.isArray(match.teams) ? match.teams.filter(Boolean) : [];
  const [teamA = 'Team A', teamB = 'Team B'] = teams;
  return `
    <article class="card match-card">
      <div class="match-card-top">
        <div class="match-meta">
          <strong class="match-title">${safeText(matchLabel(match))}</strong>
          <p class="match-date">${safeText(formatDate(match.date || match.date_time_gmt || ''))}</p>
        </div>
        <span class="status-badge">${safeText(match.winner ? `Winner: ${match.winner}` : match.status || 'Archive')}</span>
      </div>
      <div class="match-versus">
        ${renderTeamRow(teamA)}
        <div class="match-divider">vs</div>
        ${renderTeamRow(teamB)}
      </div>
      <div class="match-meta-row">
        ${match.venue ? `<span class="team-pill">${safeText(match.venue)}</span>` : ''}
        ${(match.format || match.match_type) ? `<span class="mini-chip">${safeText(match.format || match.match_type)}</span>` : ''}
      </div>
      <p class="card-meta">${safeText(matchSummary(match))}</p>
      <div class="card-actions">
        <button class="ghost-button" type="button" data-match-id="${safeText(match.id || '')}">Open scorecard</button>
      </div>
    </article>
  `;
}

function renderLivePulseCard(match = {}) {
  return `
    <article class="card live-pulse-card">
      <div class="match-card-top">
        <div class="live-pulse-meta">
          <strong>${safeText(matchLabel(match))}</strong>
          <p class="match-date">${safeText(match.status || 'Status unavailable')}</p>
        </div>
        <span class="status-badge">${safeText(match.live ? 'Live' : 'Recent')}</span>
      </div>
      ${Array.isArray(match.score) && match.score.length
        ? `<div class="metric-chip-row">${match.score
            .slice(0, 2)
            .map((score) => `<span class="stat-chip">${safeText(scoreLine(score))}</span>`)
            .join('')}</div>`
        : ''}
      <p class="card-meta">${safeText(match.venue || formatDate(match.date || match.date_time_gmt || ''))}</p>
    </article>
  `;
}

function renderQuickStats(quickStats = {}) {
  const cards = [
    {
      label: 'Matches',
      value: formatCompact(quickStats.matches || 0),
      note: 'Verified scorecards available'
    },
    {
      label: 'Players',
      value: formatCompact(quickStats.players || 0),
      note: 'Searchable profiles in archive'
    },
    {
      label: 'Teams',
      value: formatCompact(quickStats.teams || 0),
      note: 'International and domestic mix'
    },
    {
      label: 'Seasons',
      value: quickStats.seasons || 'N/A',
      note: 'Coverage window'
    }
  ];

  $('#home-quick-stats').innerHTML = cards
    .map(
      (card) => `
        <article class="card stat-card">
          <span class="summary-label">${safeText(card.label)}</span>
          <strong class="summary-value">${safeText(card.value)}</strong>
          <p class="metric-note">${safeText(card.note)}</p>
        </article>
      `
    )
    .join('');
}

function renderHeroChips(quickStats = {}, liveItems = []) {
  const chips = [
    `Archive: ${formatCompact(quickStats.matches || 0)} matches`,
    `Players: ${formatCompact(quickStats.players || 0)}`,
    `Seasons: ${quickStats.seasons || 'N/A'}`,
    liveItems.length ? `Live pulse: ${liveItems.length} match feeds` : 'Live pulse available'
  ];
  $('#hero-chip-row').innerHTML = chips.map((chip) => `<span class="mini-chip">${safeText(chip)}</span>`).join('');
}

function renderHomePlayers(players = []) {
  const container = $('#home-top-players');
  if (!players.length) {
    container.innerHTML = renderEmptyState('No featured players', 'Top player cards will appear here once data is ready.');
    return;
  }
  container.innerHTML = players.slice(0, 6).map(renderPlayerCard).join('');
  applyImageFallbacks(container);
}

function renderTrendingPlayers(players = []) {
  const container = $('#home-trending-players');
  if (!players.length) {
    container.innerHTML = renderEmptyState('No trending players', 'Trending metrics will appear here once player data is loaded.');
    return;
  }
  container.innerHTML = players.slice(0, 4).map(renderTrendCard).join('');
  applyImageFallbacks(container);
}

function renderHomeMatches(matches = []) {
  const container = $('#home-recent-matches');
  if (!matches.length) {
    container.innerHTML = renderEmptyState('No recent matches', 'Recent scorecards will appear here once matches are available.');
    return;
  }
  container.innerHTML = matches.slice(0, 6).map(renderMatchCard).join('');
}

function renderHomeLivePulse(items = []) {
  const container = $('#home-live-pulse');
  if (!items.length) {
    container.innerHTML = renderEmptyState(
      'No live pulse yet',
      'Live and recent match cards will appear here when the external feed returns data.'
    );
    return;
  }
  container.innerHTML = items.slice(0, 3).map(renderLivePulseCard).join('');
}

function buildTrendingPlayers(players = []) {
  return [...players]
    .sort((left, right) => {
      const srDiff = Number(right.strike_rate || right.stats?.strike_rate || 0) - Number(left.strike_rate || left.stats?.strike_rate || 0);
      if (srDiff !== 0) return srDiff;
      return Number(right.runs || right.stats?.runs || 0) - Number(left.runs || left.stats?.runs || 0);
    })
    .slice(0, 4);
}

function renderHome() {
  renderHeroChips(state.home.quickStats, state.home.livePulse);
  renderHomeLivePulse(state.home.livePulse);
  renderQuickStats(state.home.quickStats);
  renderHomePlayers(state.home.topPlayers);
  renderTrendingPlayers(state.home.trendingPlayers);
  renderHomeMatches(state.home.recentMatches);
}

async function loadHome() {
  const [homeResult, liveResult] = await Promise.allSettled([
    fetchJson('/api/home'),
    fetchJson('/api/cricapi/live-scores?limit=3&includeRecent=true')
  ]);

  const homePayload =
    homeResult.status === 'fulfilled'
      ? homeResult.value
      : {
          quick_stats: {},
          top_players: [],
          recent_matches: []
        };

  state.home.quickStats = homePayload.quick_stats || {};
  state.home.topPlayers = homePayload.top_players || [];
  state.home.recentMatches = homePayload.recent_matches || [];
  state.home.livePulse = liveResult.status === 'fulfilled' ? liveResult.value.items || [] : [];
  state.home.trendingPlayers = buildTrendingPlayers(homePayload.top_players || []);

  renderHome();
  hydrateFeaturedPlayerImages(
    [...state.home.topPlayers, ...state.home.trendingPlayers],
    () => renderHome()
  );
}

function mergeItemsById(existing = [], incoming = []) {
  const map = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return [...map.values()];
}

function renderPlayerList(payload = {}, { append = false } = {}) {
  const container = $('#players-list');
  const items = Array.isArray(payload.items) ? payload.items : [];
  const page = Number(payload.pagination?.page || 1);
  const totalPages = Number(payload.pagination?.total_pages || 1);
  const total = Number(payload.pagination?.total || 0);

  state.players.page = page;
  state.players.totalPages = totalPages;
  state.players.total = total;
  state.players.exhausted = page >= totalPages;
  state.players.items = append ? mergeItemsById(state.players.items, items) : items;

  const loadedCount = state.players.items.length;
  $('#players-summary').textContent = total ? `${formatNumber(total)} players found` : 'No players found';

  if (!state.players.items.length) {
    container.innerHTML = renderEmptyState('No players found', 'Try a broader search or remove the current filter.');
  } else {
    container.innerHTML = state.players.items.map(renderPlayerCard).join('');
    applyImageFallbacks(container);
  }

  $('#players-page-label').textContent = total
    ? `Showing ${formatNumber(loadedCount)} of ${formatNumber(total)} players`
    : 'No players in view';
}

function renderRecentMatchList(matches = []) {
  if (!matches.length) {
    return '<p class="detail-note">No recent matches available.</p>';
  }
  return `
    <ul class="detail-list">
      ${matches
        .map(
          (match) => `
            <li>
              <strong>${safeText(matchLabel(match))}</strong>
              <p class="card-meta">${safeText(formatDate(match.date || ''))}</p>
              <p class="card-meta">${safeText(match.result || match.summary || '')}</p>
            </li>
          `
        )
        .join('')}
    </ul>
  `;
}

function renderPlayerFormCards(matches = []) {
  if (!matches.length) {
    return '<p class="detail-note">No recent archived matches available for this player.</p>';
  }

  return `
    <div class="player-form-grid">
      ${matches
        .map((match) => {
          const chips = [
            match.runs !== null && match.runs !== undefined ? renderStatChip('runs', formatNumber(match.runs || 0)) : '',
            match.balls ? renderStatChip('balls', formatNumber(match.balls)) : '',
            match.wickets ? renderStatChip('wickets', formatNumber(match.wickets)) : '',
            match.format ? `<span class="mini-chip">${safeText(match.format)}</span>` : ''
          ]
            .filter(Boolean)
            .join('');

          return `
            <article class="player-form-card">
              <div class="player-form-head">
                <div>
                  <strong class="match-title">${safeText(matchLabel(match))}</strong>
                  <p class="card-meta">${safeText(formatDate(match.date || ''))}</p>
                </div>
                ${match.venue ? `<span class="team-pill">${safeText(match.venue)}</span>` : ''}
              </div>
              ${chips ? `<div class="metric-chip-row">${chips}</div>` : ''}
              ${match.result ? `<p class="card-meta">${safeText(match.result)}</p>` : ''}
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function formatMetricValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    if (Number.isInteger(value)) return formatNumber(value);
    return Number(value.toFixed(2)).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }
  return String(value);
}

function renderResponseHeader(details = {}, payload = {}) {
  const title = String(details.title || '').trim() || 'Cricket Intelligence';
  const subtitle = String(details.subtitle || '').trim();
  const type = String(details.type || payload.type || '').trim();
  const kickerMap = {
    player_stats: 'Player Snapshot',
    team_stats: 'Team Snapshot',
    compare_players: 'Comparison',
    match_summary: 'Match Center',
    live_update: 'Live Desk',
    top_players: 'Leaderboard',
    head_to_head: 'Head to Head',
    glossary: 'Explainer'
  };
  return `
    <div class="response-head">
      <div>
        <span class="response-kicker">${safeText(kickerMap[type] || 'Analyst Brief')}</span>
        <h3 class="response-title">${safeText(title)}</h3>
        ${subtitle ? `<p class="response-subtitle">${safeText(subtitle)}</p>` : ''}
      </div>
    </div>
  `;
}

function renderSummaryCard(payload = {}) {
  const summary = String(payload.summary || payload.answer || '').trim();
  if (!summary) return '';
  return `
    <article class="response-note response-summary">
      <span class="detail-note">Summary</span>
      <p>${safeText(summary)}</p>
    </article>
  `;
}

function renderKeyStatGrid(payload = {}) {
  const stats = Array.isArray(payload.key_stats) ? payload.key_stats.filter(Boolean) : [];
  if (!stats.length) return '';
  return `
    <div class="key-stat-grid">
      ${stats
        .map((stat) => {
          const label = safeText(stat.label || 'Metric');
          const value =
            stat.left !== undefined || stat.right !== undefined
              ? `${formatMetricValue(stat.left)} vs ${formatMetricValue(stat.right)}`
              : formatMetricValue(stat.value);
          return `
            <article class="key-stat-card">
              <span class="detail-note">${label}</span>
              <strong>${safeText(value)}</strong>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderInsightsList(payload = {}) {
  const insights = Array.isArray(payload.insights)
    ? payload.insights.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (!insights.length) return '';
  return `
    <div class="section-block insight-block">
      <div class="section-head compact">
        <div>
          <h3>Insights</h3>
        </div>
      </div>
      <ul class="insight-list">
        ${insights.map((insight) => `<li>${safeText(insight)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderMatchBriefCard(match = {}, { label = '' } = {}) {
  if (!match?.name) return '';
  return `
    <article class="match-brief-card">
      <div class="match-brief-top">
        <div>
          <strong class="match-title">${safeText(match.name)}</strong>
          <p class="card-meta">${safeText(formatDate(match.date || ''))}</p>
        </div>
        ${label ? `<span class="mini-chip">${safeText(label)}</span>` : ''}
      </div>
      <div class="metric-chip-row">
        ${match.match_type ? `<span class="stat-chip">${safeText(match.match_type)}</span>` : ''}
        ${match.venue ? `<span class="stat-chip">${safeText(match.venue)}</span>` : ''}
      </div>
      ${Array.isArray(match.score) && match.score.length ? `<div class="metric-chip-row">${match.score.map((row) => `<span class="stat-chip">${safeText(scoreLine(row))}</span>`).join('')}</div>` : ''}
      ${match.status ? `<p class="card-meta">${safeText(match.status)}</p>` : ''}
    </article>
  `;
}

function renderMatchDeck(matches = [], { label = '' } = {}) {
  const items = Array.isArray(matches) ? matches.filter((match) => match?.name) : [];
  if (!items.length) return '';
  return `
    <div class="match-brief-grid">
      ${items.map((match) => renderMatchBriefCard(match, { label })).join('')}
    </div>
  `;
}

function renderLeaderboardCards(details = {}) {
  const rows = Array.isArray(details.rows) ? details.rows : [];
  if (!rows.length) return '<p class="detail-note">No leaderboard rows available.</p>';
  return `
    <div class="leaderboard-grid">
      ${rows.slice(0, 5)
        .map(
          (row) => `
            <article class="leaderboard-card">
              <span class="leaderboard-rank">${safeText(`#${row.rank || ''}`)}</span>
              <div class="player-head">
                ${renderPlayerAvatar({ name: row.player })}
                <div class="player-meta">
                  <strong class="player-name">${safeText(row.player || 'Player')}</strong>
                  <p class="player-team">${safeText(row.team || 'Archive')}</p>
                </div>
              </div>
              <div class="leaderboard-value">${safeText(row.value || '-')}</div>
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderPlayerDetail(payload = {}) {
  const card = $('#player-detail');
  const stats = payload.stats || {};
  const recentMatches = Array.isArray(payload.recent_matches) ? payload.recent_matches.slice(0, 6) : [];
  const name = preferredPlayerName(payload);
  const team = payload.team || payload.country || countryForPlayer(payload) || 'Archive data';
  const description =
    String(payload.description || '').trim() ||
    `${name} profile with batting, bowling, and recent-form details from the verified archive.`;
  const datasetChip = renderDatasetChip(payload, 'Archive record');
  const average = Number(stats.average || 0).toFixed(2);
  const strikeRate = Number(stats.strike_rate || 0).toFixed(2);
  const economy = Number(stats.economy || 0).toFixed(2);

  card.classList.remove('hidden');
  card.innerHTML = `
    <section class="player-profile-hero">
      <div class="player-profile-intro">
        <div class="player-profile-head">
          ${renderPlayerAvatar(payload, { large: true })}
          <div class="player-profile-copy">
            <span class="response-kicker">Player Profile</span>
            <h2 class="player-profile-title">${safeText(name)}</h2>
            <p class="player-profile-subtitle">${safeText(team)}</p>
            <div class="metric-chip-row">
              <span class="player-badge">Verified archive stats</span>
              ${payload.country ? `<span class="mini-chip">${safeText(payload.country)}</span>` : ''}
              ${datasetChip}
              ${payload.wikipedia_url ? `<a class="mini-chip" href="${safeText(payload.wikipedia_url)}" target="_blank" rel="noreferrer">Wikipedia</a>` : ''}
            </div>
          </div>
        </div>
        <p class="player-profile-description">${safeText(description)}</p>
      </div>
      <div class="player-profile-highlight-grid">
        <article class="player-profile-highlight">
          <span class="detail-note">Matches</span>
          <strong>${safeText(formatNumber(stats.matches || 0))}</strong>
          <p class="card-meta">Across the verified archive.</p>
        </article>
        <article class="player-profile-highlight">
          <span class="detail-note">Runs</span>
          <strong>${safeText(formatNumber(stats.runs || 0))}</strong>
          <p class="card-meta">Career batting output.</p>
        </article>
        <article class="player-profile-highlight">
          <span class="detail-note">Wickets</span>
          <strong>${safeText(formatNumber(stats.wickets || 0))}</strong>
          <p class="card-meta">Career bowling return.</p>
        </article>
        <article class="player-profile-highlight">
          <span class="detail-note">Average</span>
          <strong>${safeText(average)}</strong>
          <p class="card-meta">Batting average.</p>
        </article>
      </div>
    </section>

    <div class="player-profile-section-grid">
      <section class="player-profile-section">
        <div class="section-head compact">
          <div>
            <h3>Batting Profile</h3>
            <p class="subline">Production, volume, and scoring tempo.</p>
          </div>
        </div>
        <div class="detail-grid player-detail-grid">
          <div class="detail-stat"><span class="detail-note">Innings</span><strong>${safeText(formatNumber(stats.innings || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Runs</span><strong>${safeText(formatNumber(stats.runs || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Balls Faced</span><strong>${safeText(formatNumber(stats.balls_faced || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Dismissals</span><strong>${safeText(formatNumber(stats.dismissals || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Average</span><strong>${safeText(average)}</strong></div>
          <div class="detail-stat"><span class="detail-note">Strike Rate</span><strong>${safeText(strikeRate)}</strong></div>
          <div class="detail-stat"><span class="detail-note">Fours</span><strong>${safeText(formatNumber(stats.fours || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Sixes</span><strong>${safeText(formatNumber(stats.sixes || 0))}</strong></div>
        </div>
      </section>

      <section class="player-profile-section">
        <div class="section-head compact">
          <div>
            <h3>Bowling Profile</h3>
            <p class="subline">Workload, control, and wicket-taking return.</p>
          </div>
        </div>
        <div class="detail-grid player-detail-grid">
          <div class="detail-stat"><span class="detail-note">Bowling Innings</span><strong>${safeText(formatNumber(stats.bowling_innings || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Wickets</span><strong>${safeText(formatNumber(stats.wickets || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Balls Bowled</span><strong>${safeText(formatNumber(stats.balls_bowled || 0))}</strong></div>
          <div class="detail-stat"><span class="detail-note">Overs Bowled</span><strong>${safeText(stats.overs_bowled || '0')}</strong></div>
          <div class="detail-stat"><span class="detail-note">Economy</span><strong>${safeText(economy)}</strong></div>
          <div class="detail-stat"><span class="detail-note">Dot Balls</span><strong>${safeText(formatNumber(stats.dot_balls || 0))}</strong></div>
        </div>
      </section>
    </div>

    <div class="section-block">
      <div class="section-head compact">
        <div>
          <h3>Recent Form</h3>
          <p class="subline">Latest archived matches shown in a larger match-card format.</p>
        </div>
      </div>
      ${renderPlayerFormCards(recentMatches)}
    </div>
  `;
  applyImageFallbacks(card);
}

async function openPlayerDetail(playerId = '', { scroll = true } = {}) {
  const cacheKey = String(playerId || '').trim();
  const cached = getMapCache(state.playerDetails, cacheKey);
  const payload =
    cached || (await fetchJson(`/api/players/${encodeURIComponent(playerId)}`));
  setMapCache(state.playerDetails, cacheKey, payload, 80);
  renderPlayerDetail(payload);
  if (scroll) {
    $('#player-detail')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
  resolvePlayerImage(payload.name || '').then(() => renderPlayerDetail(payload));
}

async function fetchPlayerPage({ query = state.players.query, page = 1, signal, preferPrefetch = true } = {}) {
  const key = playerListKey({ query, page });
  if (preferPrefetch) {
    const prefetched = getMapCache(state.players.prefetched, key);
    if (prefetched) {
      return setMapCache(state.players.cache, key, prefetched, 80);
    }
  }

  const cached = getMapCache(state.players.cache, key);
  if (cached) return cached;

  const limit = state.players.limit;
  const encodedQuery = encodeURIComponent(query || '');
  const payload = await fetchJson(`/api/players/search?q=${encodedQuery}&page=${page}&limit=${limit}`, {
    signal
  });
  return setMapCache(state.players.cache, key, payload, 80);
}

async function prefetchPlayersPage(page = state.players.page + 1) {
  if (page > state.players.totalPages && state.players.totalPages > 1) return;
  const query = state.players.query || '';
  const key = playerListKey({ query, page });
  if (state.players.cache.has(key) || state.players.prefetched.has(key)) return;

  try {
    const limit = state.players.limit;
    const encodedQuery = encodeURIComponent(query);
    const payload = await fetchJson(`/api/players/search?q=${encodedQuery}&page=${page}&limit=${limit}`);
    setMapCache(state.players.prefetched, key, payload, 40);
  } catch (_) {
    // Ignore prefetch failures and keep the visible request path clean.
  }
}

function chooseAutoOpenPlayer(items = [], query = '') {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery || cleanQuery.length < 4) return null;

  const ranked = [...items]
    .map((item) => {
      const cleanName = normalizeText(item.name || '');
      let score = 0;

      if (cleanName === cleanQuery) score += 120;
      if (cleanName.startsWith(cleanQuery)) score += 55;
      if (cleanName.includes(cleanQuery)) score += 34;

      const queryParts = cleanQuery.split(' ').filter(Boolean);
      const nameParts = cleanName.split(' ').filter(Boolean);
      const queryLast = queryParts[queryParts.length - 1] || '';
      const nameLast = nameParts[nameParts.length - 1] || '';
      if (queryLast && queryLast === nameLast) score += 16;
      if (queryParts.length >= 2 && queryParts.every((part) => cleanName.includes(part))) score += 24;

      return { item, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best || best.score < 60) return null;
  if (normalizeText(best.item?.name || '') === cleanQuery) return best.item;
  if (items.length === 1) return best.item;
  if ((best.score - (runnerUp?.score || 0)) >= 18) return best.item;
  return null;
}

async function maybeAutoOpenPlayer(payload = {}, { reset = false } = {}) {
  if (!reset || !state.players.query.trim()) return;
  const candidate = chooseAutoOpenPlayer(Array.isArray(payload.items) ? payload.items : [], state.players.query);
  if (!candidate?.id) return;
  await openPlayerDetail(candidate.id, { scroll: true });
}

async function loadPlayers({ reset = false, page = state.players.page, append = false } = {}) {
  const token = ++state.players.requestToken;

  if (reset) {
    abortRequest(state.players.controller);
    state.players.controller = new AbortController();
    state.players.page = 1;
    state.players.totalPages = 1;
    state.players.total = 0;
    state.players.items = [];
    state.players.exhausted = false;
    $('#player-detail').classList.add('hidden');
    setPlayersLoadingState({ initial: true, loading: true, count: 6 });
    state.players.isLoading = true;
  } else if (append) {
    if (state.players.isAppending || state.players.isLoading || state.players.exhausted) return;
    state.players.isAppending = true;
    setPlayersLoadingState({ loading: true, count: 3 });
  } else {
    abortRequest(state.players.controller);
    state.players.controller = new AbortController();
    state.players.isLoading = true;
    setPlayersLoadingState({ initial: true, loading: true, count: 6 });
  }

  try {
    const payload = await fetchPlayerPage({
      query: state.players.query,
      page,
      signal: reset || !append ? state.players.controller?.signal : undefined
    });
    if (token !== state.players.requestToken) return;
    renderPlayerList(payload, { append });
    if (reset) {
      await maybeAutoOpenPlayer(payload, { reset: true });
    }
    setPlayersLoadingState({ loading: false });
    void prefetchPlayersPage(Number(payload.pagination?.page || page) + 1);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    $('#players-summary').textContent = 'Unable to load players';
    if (!state.players.items.length) {
      $('#players-list').innerHTML = renderEmptyState(
        'Player search failed',
        error.message || 'Unable to load players right now.'
      );
    }
  } finally {
    if (token === state.players.requestToken) {
      state.players.isLoading = false;
      state.players.isAppending = false;
      setPlayersLoadingState({ loading: false });
    }
  }
}

async function loadMorePlayers() {
  if (state.players.exhausted) return;
  const nextPage = state.players.page + 1;
  if (nextPage > state.players.totalPages && state.players.totalPages > 1) return;
  await loadPlayers({ page: nextPage, append: true });
}

function fillOptions({ teams = [], seasons = [] }) {
  state.options.teams = teams;
  state.options.seasons = seasons;

  const teamSelect = $('#matches-team-filter');
  const seasonSelect = $('#matches-season-filter');

  teamSelect.innerHTML = '<option value="">All teams</option>';
  teams.forEach((team) => {
    teamSelect.insertAdjacentHTML('beforeend', `<option value="${safeText(team)}">${safeText(team)}</option>`);
  });

  seasonSelect.innerHTML = '<option value="">All seasons</option>';
  seasons.forEach((season) => {
    seasonSelect.insertAdjacentHTML('beforeend', `<option value="${safeText(season)}">${safeText(season)}</option>`);
  });
}

async function loadPlayerNames() {
  const payload = await fetchJson('/api/players/search?page=1&limit=200');
  state.options.playerNames = (payload.items || []).map((row) => row.name);
  $('#player-options').innerHTML = state.options.playerNames
    .map((name) => `<option value="${safeText(name)}"></option>`)
    .join('');
}

function renderMatches(payload = {}) {
  const container = $('#matches-list');
  const items = Array.isArray(payload.items) ? payload.items : [];
  const pagination = payload.pagination || {};
  const page = Number(pagination.page || state.matches.page);
  const totalPages = Number(pagination.total_pages || 1);
  const total = Number(pagination.total || 0);

  state.matches.page = page;
  state.matches.totalPages = totalPages;
  state.matches.total = total;

  $('#matches-summary').textContent = total ? `${formatNumber(total)} matches in view` : 'No matches found';

  if (!items.length) {
    container.innerHTML = renderEmptyState('No matches found', 'Try a different team or season filter.');
  } else {
    container.innerHTML = items.map(renderMatchCard).join('');
  }

  $('#matches-page-label').textContent = `Page ${page} of ${totalPages}`;
  $('#matches-prev').disabled = page <= 1;
  $('#matches-next').disabled = page >= totalPages;
}

function renderScoreGrid(match = {}) {
  if (!Array.isArray(match.innings) || !match.innings.length) {
    return '<p class="detail-note">No innings breakdown available.</p>';
  }

  return `
    <div class="score-grid">
      ${match.innings
        .map(
          (inning) => `
            <div class="score-box">
              <span class="detail-note">${safeText(inning.batting_team || `Inning ${inning.inning || ''}`)}</span>
              <strong>${safeText(`${inning.runs || 0}/${inning.wickets ?? '-'} (${inning.overs || '-'})`)}</strong>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderTopPerformers(title, rows = [], formatter) {
  if (!rows.length) return '';
  return `
    <div class="section-block">
      <div class="section-head compact">
        <div>
          <h3>${safeText(title)}</h3>
        </div>
      </div>
      <ul class="detail-list">
        ${rows
          .map((row) => `<li><strong>${safeText(row.name)}</strong><p class="card-meta">${safeText(formatter(row))}</p></li>`)
          .join('')}
      </ul>
    </div>
  `;
}

function renderMatchDetail(match = {}) {
  const card = $('#match-detail');
  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="detail-top">
      <div>
        <strong class="match-title">${safeText(matchLabel(match))}</strong>
        <p class="card-meta">${safeText(formatDate(match.date || ''))}${match.venue ? ` | ${safeText(match.venue)}` : ''}</p>
      </div>
      <div class="metric-chip-row">
        ${match.winner ? `<span class="player-badge">${safeText(`Winner: ${match.winner}`)}</span>` : ''}
        ${match.format ? `<span class="mini-chip">${safeText(match.format)}</span>` : ''}
      </div>
    </div>
    <p class="card-meta">${safeText(match.summary || match.result || 'Result not available')}</p>
    ${renderScoreGrid(match)}
    ${renderTopPerformers('Top Batters', Array.isArray(match.top_batters) ? match.top_batters.slice(0, 4) : [], (row) => `${row.runs} runs in ${row.balls} balls`)}
    ${renderTopPerformers('Top Bowlers', Array.isArray(match.top_bowlers) ? match.top_bowlers.slice(0, 4) : [], (row) => `${row.wickets}/${row.runs_conceded} in ${row.overs} overs`)}
  `;
}

async function openMatchDetail(matchId = '', { scroll = true } = {}) {
  const cacheKey = String(matchId || '').trim();
  const cached = getMapCache(state.matchDetails, cacheKey);
  const payload =
    cached || (await fetchJson(`/api/matches/${encodeURIComponent(matchId)}`));
  setMapCache(state.matchDetails, cacheKey, payload, 80);
  renderMatchDetail(payload);
  if (scroll) {
    $('#match-detail')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

async function fetchMatchesPage({ page = state.matches.page, signal, preferPrefetch = true } = {}) {
  const key = matchesListKey({ page });
  if (preferPrefetch) {
    const prefetched = getMapCache(state.matches.prefetched, key);
    if (prefetched) {
      return setMapCache(state.matches.cache, key, prefetched, 80);
    }
  }

  const cached = getMapCache(state.matches.cache, key);
  if (cached) return cached;

  const offset = (page - 1) * state.matches.limit;
  const params = new URLSearchParams({
    limit: String(state.matches.limit),
    offset: String(offset)
  });
  if (state.matches.team) params.set('team', state.matches.team);
  if (state.matches.season) params.set('season', state.matches.season);
  const payload = await fetchJson(`/api/matches?${params.toString()}`, { signal });
  return setMapCache(state.matches.cache, key, payload, 80);
}

async function prefetchMatchesPage(page = state.matches.page + 1) {
  if (page > state.matches.totalPages && state.matches.totalPages > 1) return;
  const key = matchesListKey({ page });
  if (state.matches.cache.has(key) || state.matches.prefetched.has(key)) return;

  try {
    const offset = (page - 1) * state.matches.limit;
    const params = new URLSearchParams({
      limit: String(state.matches.limit),
      offset: String(offset)
    });
    if (state.matches.team) params.set('team', state.matches.team);
    if (state.matches.season) params.set('season', state.matches.season);
    const payload = await fetchJson(`/api/matches?${params.toString()}`);
    setMapCache(state.matches.prefetched, key, payload, 40);
  } catch (_) {
    // Ignore background prefetch failures.
  }
}

async function loadMatches({ page = state.matches.page, reset = false } = {}) {
  const token = ++state.matches.requestToken;
  abortRequest(state.matches.controller);
  state.matches.controller = new AbortController();
  state.matches.isLoading = true;
  if (reset) {
    $('#match-detail').classList.add('hidden');
    setMatchesLoadingState(true, 4);
  }

  try {
    const payload = await fetchMatchesPage({
      page,
      signal: state.matches.controller.signal
    });
    if (token !== state.matches.requestToken) return;
    renderMatches(payload);
    void prefetchMatchesPage(Number(payload.pagination?.page || page) + 1);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    $('#matches-summary').textContent = 'Unable to load matches';
    $('#matches-list').innerHTML = renderEmptyState(
      'Match filter failed',
      error.message || 'Unable to load matches right now.'
    );
  } finally {
    if (token === state.matches.requestToken) {
      state.matches.isLoading = false;
    }
  }
}

function renderCompareTable(details = {}) {
  const left = details.left || {};
  const right = details.right || {};
  const hasLeft = Boolean(left.canonical_name || left.name);
  const hasRight = Boolean(right.canonical_name || right.name);
  const leftName = preferredPlayerName(left);
  const rightName = preferredPlayerName(right);
  const leftTeam = left.team || countryForPlayer(left) || 'Archive';
  const rightTeam = right.team || countryForPlayer(right) || 'Archive';
  const leftDatasetChip = renderDatasetChip(left);
  const rightDatasetChip = renderDatasetChip(right);
  if (!hasLeft || !hasRight) {
    return '<p class="detail-note">Comparison data is not available.</p>';
  }

  const leftRuns = compareMetricValue(left.stats, 'runs');
  const rightRuns = compareMetricValue(right.stats, 'runs');
  const leftWickets = compareMetricValue(left.stats, 'wickets');
  const rightWickets = compareMetricValue(right.stats, 'wickets');
  const leftAverage = compareMetricValue(left.stats, 'average');
  const rightAverage = compareMetricValue(right.stats, 'average');
  const leftStrikeRate = compareMetricValue(left.stats, 'strike_rate');
  const rightStrikeRate = compareMetricValue(right.stats, 'strike_rate');
  const leftEconomy = compareMetricValue(left.stats, 'economy');
  const rightEconomy = compareMetricValue(right.stats, 'economy');

  return `
    <div class="compare-head">
      <div class="compare-player compare-player-card">
        ${renderPlayerAvatar(left)}
        <div class="player-meta">
          <strong class="player-name">${safeText(leftName)}</strong>
          <p class="player-team">${safeText(leftTeam)}</p>
          ${leftDatasetChip ? `<div class="metric-chip-row">${leftDatasetChip}</div>` : ''}
        </div>
      </div>
      <div class="compare-vs">VS</div>
      <div class="compare-player compare-player-card">
        ${renderPlayerAvatar(right)}
        <div class="player-meta">
          <strong class="player-name">${safeText(rightName)}</strong>
          <p class="player-team">${safeText(rightTeam)}</p>
          ${rightDatasetChip ? `<div class="metric-chip-row">${rightDatasetChip}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="compare-metric-grid">
      <div class="compare-metric"><span class="detail-note">Runs</span><strong>${safeText(formatNumber(leftRuns))} vs ${safeText(formatNumber(rightRuns))}</strong></div>
      <div class="compare-metric"><span class="detail-note">Wickets</span><strong>${safeText(formatNumber(leftWickets))} vs ${safeText(formatNumber(rightWickets))}</strong></div>
      <div class="compare-metric"><span class="detail-note">Average</span><strong>${safeText(leftAverage.toFixed(2))} vs ${safeText(rightAverage.toFixed(2))}</strong></div>
      <div class="compare-metric"><span class="detail-note">Strike Rate</span><strong>${safeText(leftStrikeRate.toFixed(2))} vs ${safeText(rightStrikeRate.toFixed(2))}</strong></div>
    </div>
    <div class="card compare-bars">
      ${renderComparisonBar('Runs', leftRuns, rightRuns, 'runs')}
      ${renderComparisonBar('Wickets', leftWickets, rightWickets, 'wickets')}
      ${renderComparisonBar('Average', leftAverage, rightAverage, 'average')}
      ${renderComparisonBar('Strike Rate', leftStrikeRate, rightStrikeRate, 'strike_rate')}
      ${renderComparisonBar('Economy', leftEconomy, rightEconomy, 'economy')}
    </div>
    <table class="simple-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>${safeText(leftName)}</th>
          <th>${safeText(rightName)}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Runs</td><td>${safeText(formatNumber(leftRuns))}</td><td>${safeText(formatNumber(rightRuns))}</td></tr>
        <tr><td>Average</td><td>${safeText(leftAverage.toFixed(2))}</td><td>${safeText(rightAverage.toFixed(2))}</td></tr>
        <tr><td>Strike Rate</td><td>${safeText(leftStrikeRate.toFixed(2))}</td><td>${safeText(rightStrikeRate.toFixed(2))}</td></tr>
        <tr><td>Wickets</td><td>${safeText(formatNumber(leftWickets))}</td><td>${safeText(formatNumber(rightWickets))}</td></tr>
        <tr><td>Economy</td><td>${safeText(leftEconomy.toFixed(2))}</td><td>${safeText(rightEconomy.toFixed(2))}</td></tr>
      </tbody>
    </table>
  `;
}

async function runCompare() {
  const player1 = $('#compare-player-1').value.trim();
  const player2 = $('#compare-player-2').value.trim();
  const resultBox = $('#compare-result');

  if (!player1 || !player2) {
    resultBox.innerHTML = renderEmptyState('Missing players', 'Enter both player names before running a comparison.');
    return;
  }

  resultBox.innerHTML = renderLoadingPanel({
    status: 'loading',
    rows_processed: state.datasetStatus.rows_processed
  });

  const payload = await fetchJson('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: `Compare ${player1} vs ${player2}` })
  });

  const details = payload.details || payload.data || {};
  const detailBody =
    details.type === 'compare_players' ? renderCompareTable(details) : renderChatDetails(details);
  resultBox.innerHTML = `
    <article class="compare-card">
      ${renderResponseHeader(details, payload)}
      ${renderSummaryCard(payload)}
      ${renderKeyStatGrid(payload)}
      ${renderInsightsList(payload)}
      ${detailBody}
    </article>
  `;
  applyImageFallbacks(resultBox);

  const names = [details.left?.canonical_name || details.left?.name, details.right?.canonical_name || details.right?.name].filter(Boolean);
  await Promise.allSettled(names.map((name) => resolvePlayerImage(name)));
  const hydratedDetailBody =
    details.type === 'compare_players' ? renderCompareTable(details) : renderChatDetails(details);
  resultBox.innerHTML = `
    <article class="compare-card">
      ${renderResponseHeader(details, payload)}
      ${renderSummaryCard(payload)}
      ${renderKeyStatGrid(payload)}
      ${renderInsightsList(payload)}
      ${hydratedDetailBody}
    </article>
  `;
  applyImageFallbacks(resultBox);
}

function renderTopPlayersDetails(details = {}) {
  const rows = Array.isArray(details.rows) ? details.rows : [];
  if (!rows.length) return '<p class="detail-note">No extra details available.</p>';
  return `
    ${renderLeaderboardCards(details)}
    <table class="simple-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Team</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${safeText(row.rank)}</td>
                <td>${safeText(row.player)}</td>
                <td>${safeText(row.team)}</td>
                <td>${safeText(row.value)}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderLiveUpdateDetails(details = {}) {
  const liveMatch = details.live_match || {};
  const nextMatch = details.next_match || {};
  const upcomingMatches = Array.isArray(details.upcoming_matches) ? details.upcoming_matches : [];
  const recentMatches = Array.isArray(details.recent_matches) ? details.recent_matches : [];
  const player = details.player || {};
  const providerStatus = details.provider_status || {};
  return `
    ${providerStatus.message ? `<article class="response-note status-note"><span class="detail-note">${safeText(providerStatus.title || 'Live Feed')}</span><p>${safeText(providerStatus.message)}</p></article>` : ''}
    ${liveMatch.name ? `<div class="section-block"><div class="section-head compact"><div><h3>Live Match</h3><p class="subline">Current match center.</p></div></div>${renderMatchBriefCard(liveMatch, { label: 'Live' })}</div>` : ''}
    ${upcomingMatches.length ? `<div class="section-block"><div class="section-head compact"><div><h3>Upcoming Matches</h3><p class="subline">Next scheduled fixtures from CricAPI.</p></div></div>${renderMatchDeck(upcomingMatches, { label: 'Upcoming' })}</div>` : ''}
    ${!upcomingMatches.length && nextMatch.name ? `<div class="section-block"><div class="section-head compact"><div><h3>Next Match</h3></div></div>${renderMatchBriefCard(nextMatch, { label: 'Upcoming' })}</div>` : ''}
    ${recentMatches.length ? `<div class="section-block"><div class="section-head compact"><div><h3>Recent Matches</h3><p class="subline">Latest tracked live or recent fixtures.</p></div></div>${renderMatchDeck(recentMatches.slice(0, 3), { label: 'Recent' })}</div>` : ''}
    ${player.name ? `<article class="response-note"><span class="detail-note">Tracked Player</span><p>${safeText(preferredPlayerName(player))}${player.country ? ` | ${safeText(player.country)}` : ''}</p></article>` : ''}
    ${!providerStatus.message && !liveMatch.name && !nextMatch.name && !recentMatches.length ? '<p class="detail-note">No live or scheduled matches are available right now.</p>' : ''}
  `;
}

function renderChatDetails(details = {}) {
  const type = details.type || 'summary';

  if (type === 'player_stats') {
    const player = details.player || {};
    const hasPlayer = Boolean(player.canonical_name || player.name);
    const name = preferredPlayerName(player);
    const team = player.team || player.country || countryForPlayer(player) || 'Archive';
    const playerDatasetChip = renderDatasetChip(player);
    return `
      ${hasPlayer ? `
        <div class="chat-player-card">
          ${renderPlayerAvatar(player, { large: true })}
          <div class="player-meta">
            <strong class="player-name">${safeText(name)}</strong>
            <p class="player-team">${safeText(team)}</p>
            ${(playerDatasetChip || player.wikipedia_url) ? `
              <div class="metric-chip-row">
                ${playerDatasetChip}
                ${player.wikipedia_url ? `<a class="mini-chip" href="${safeText(player.wikipedia_url)}" target="_blank" rel="noreferrer">Wikipedia</a>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      <div class="detail-grid">
        <div class="detail-stat"><span class="detail-note">Runs</span><strong>${safeText(formatNumber(details.stats?.runs || 0))}</strong></div>
        <div class="detail-stat"><span class="detail-note">Wickets</span><strong>${safeText(formatNumber(details.stats?.wickets || 0))}</strong></div>
        <div class="detail-stat"><span class="detail-note">Average</span><strong>${safeText(Number(details.stats?.average || 0).toFixed(2))}</strong></div>
        <div class="detail-stat"><span class="detail-note">Strike Rate</span><strong>${safeText(Number(details.stats?.strike_rate || 0).toFixed(2))}</strong></div>
      </div>
      ${renderRecentMatchList(Array.isArray(details.recent_matches) ? details.recent_matches.slice(0, 4) : [])}
    `;
  }

  if (type === 'team_stats') {
    return `
      <div class="detail-grid">
        <div class="detail-stat"><span class="detail-note">Matches</span><strong>${safeText(formatNumber(details.stats?.matches || 0))}</strong></div>
        <div class="detail-stat"><span class="detail-note">Wins</span><strong>${safeText(formatNumber(details.stats?.wins || 0))}</strong></div>
        <div class="detail-stat"><span class="detail-note">Win Rate</span><strong>${safeText(formatPercent(details.stats?.win_rate || 0))}</strong></div>
        <div class="detail-stat"><span class="detail-note">Average Score</span><strong>${safeText(Number(details.stats?.average_score || 0).toFixed(2))}</strong></div>
      </div>
      ${renderRecentMatchList(Array.isArray(details.recent_matches) ? details.recent_matches.slice(0, 4) : [])}
    `;
  }

  if (type === 'match_summary') {
    const match = details.match || {};
    return `
      ${renderMatchBriefCard(match, { label: match.match_type || 'Match' })}
      ${renderScoreGrid(match)}
    `;
  }

  if (type === 'compare_players') return renderCompareTable(details);
  if (type === 'top_players') return renderTopPlayersDetails(details);

  if (type === 'head_to_head') {
    return `
      <table class="simple-table">
        <tbody>
          <tr><th>Matches</th><td>${safeText(formatNumber(details.stats?.matches || 0))}</td></tr>
          <tr><th>${safeText(details.team1 || 'Team 1')} wins</th><td>${safeText(formatNumber(details.stats?.wins_team_a || 0))}</td></tr>
          <tr><th>${safeText(details.team2 || 'Team 2')} wins</th><td>${safeText(formatNumber(details.stats?.wins_team_b || 0))}</td></tr>
          <tr><th>No result</th><td>${safeText(formatNumber(details.stats?.no_result || 0))}</td></tr>
        </tbody>
      </table>
    `;
  }

  if (type === 'glossary') {
    return `<article class="response-note"><span class="detail-note">Explanation</span><p>${safeText(details.explanation || '')}</p></article>`;
  }

  if (type === 'live_update') return renderLiveUpdateDetails(details);
  if (type === 'summary') return '';

  return '<p class="detail-note">No extra details available.</p>';
}

function renderChatPayload(payload = {}) {
  const details = payload.details || payload.data || {};
  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.followups)
      ? payload.followups
      : [];

  return `
    <div class="msg-body response-shell">
      ${renderResponseHeader(details, payload)}
      ${renderSummaryCard(payload)}
      ${renderKeyStatGrid(payload)}
      ${renderInsightsList(payload)}
      ${renderChatDetails(details)}
      ${suggestions.length ? `<div class="chip-row">${suggestions.map((suggestion) => `<button class="chip" data-question="${safeText(suggestion)}" type="button">${safeText(suggestion)}</button>`).join('')}</div>` : ''}
    </div>
  `;
}

async function hydrateChatPayload(payload = {}) {
  const details = payload.details || payload.data || {};
  const playerNames = new Set();

  [details.player, details.left, details.right]
    .filter(Boolean)
    .forEach((player) => {
      const name = preferredPlayerName(player);
      if (name) playerNames.add(name);
    });

  (Array.isArray(details.rows) ? details.rows : []).forEach((row) => {
    const name = String(row.player || '').trim();
    if (name) playerNames.add(name);
  });

  if (!playerNames.size) return;
  await Promise.allSettled([...playerNames].map((name) => resolvePlayerImage(name)));
}

function appendMessage(kind, bodyHtml) {
  const box = $('#chat-messages');
  box.insertAdjacentHTML('beforeend', renderMessageHtml(kind, bodyHtml));
  box.scrollTop = box.scrollHeight;
  return box.lastElementChild;
}

function updateMessage(node, kind, bodyHtml) {
  if (!node) return;
  node.outerHTML = renderMessageHtml(kind, bodyHtml);
}

async function askChat(question) {
  appendMessage('user', `<div class="msg-body"><p>${safeText(question)}</p></div>`);

  const sendButton = $('#chat-send');
  sendButton.disabled = true;
  sendButton.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending';

  let streamFinished = false;
  let gotAnswer = false;
  let placeholder = appendMessage(
    'bot',
    '<div class="msg-body"><p>Searching the archive and live context...</p></div>'
  );
  const stream = new EventSource(`/api/query/stream?question=${encodeURIComponent(question)}`);

  function finish() {
    if (streamFinished) return;
    streamFinished = true;
    stream.close();
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
  }

  stream.addEventListener('status', (event) => {
    const payload = JSON.parse(event.data || '{}');
    updateMessage(
      placeholder,
      'bot',
      `<div class="msg-body"><p>${safeText(payload.message || 'Searching the archive and live context...')}</p></div>`
    );
    placeholder = $('#chat-messages').lastElementChild || placeholder;
  });

  stream.addEventListener('answer', (event) => {
    const payload = JSON.parse(event.data || '{}');
    gotAnswer = true;
    updateMessage(placeholder, 'bot', renderChatPayload(payload));
    placeholder = $('#chat-messages').lastElementChild || placeholder;
    void hydrateChatPayload(payload).then(() => {
      updateMessage(placeholder, 'bot', renderChatPayload(payload));
      placeholder = $('#chat-messages').lastElementChild || placeholder;
    });
  });

  stream.addEventListener('error', (event) => {
    const payload = JSON.parse(event.data || '{}');
    updateMessage(
      placeholder,
      'bot',
      `<div class="msg-body"><p>${safeText(payload.summary || payload.answer || 'Unable to answer right now.')}</p></div>`
    );
    placeholder = $('#chat-messages').lastElementChild || placeholder;
    finish();
  });

  stream.addEventListener('done', () => {
    finish();
  });

  stream.onerror = () => {
    if (streamFinished || gotAnswer) {
      finish();
      return;
    }

    updateMessage(
      placeholder,
      'bot',
      '<div class="msg-body"><p>The search stream closed before the answer finished.</p></div>'
    );
    placeholder = $('#chat-messages').lastElementChild || placeholder;
    finish();
  };
}

function setupPlayersObserver() {
  if (state.ui.playersObserver) return;
  const sentinel = $('#players-scroll-sentinel');
  if (!sentinel || !('IntersectionObserver' in window)) return;

  state.ui.playersObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (state.ui.activePage !== 'players') return;
      if (state.players.isLoading || state.players.isAppending || state.players.exhausted) return;
      void loadMorePlayers();
    },
    {
      rootMargin: '280px 0px'
    }
  );

  state.ui.playersObserver.observe(sentinel);
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () =>
      switchPage(button.dataset.page, {
        focusSelector: pageFocusSelector(button.dataset.page)
      })
    );
  });

  document.querySelectorAll('[data-page-target]').forEach((button) => {
    button.addEventListener('click', () =>
      switchPage(button.dataset.pageTarget, {
        focusSelector: pageFocusSelector(button.dataset.pageTarget)
      })
    );
  });

  $('#sidebar-toggle').addEventListener('click', () => {
    setSidebarCollapsed(!state.ui.sidebarCollapsed);
  });

  $('#mobile-menu').addEventListener('click', openSidebar);
  $('#sidebar-overlay').addEventListener('click', closeSidebar);
  $('#theme-toggle').addEventListener('click', () => {
    applyTheme(state.ui.theme === 'dark' ? 'light' : 'dark');
  });

  const runPlayerSearch = async () => {
    state.players.query = $('#players-search').value.trim();
    await loadPlayers({ reset: true, page: 1 });
  };
  const debouncedPlayerSearch = debounce(() => {
    state.players.query = $('#players-search').value.trim();
    void loadPlayers({ reset: true, page: 1 });
  }, 280);

  $('#players-search-btn').addEventListener('click', async () => {
    await runPlayerSearch();
  });

  $('#players-search').addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await runPlayerSearch();
  });

  $('#players-search').addEventListener('input', () => {
    debouncedPlayerSearch();
  });

  $('#players-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    await openPlayerDetail(button.dataset.playerId || '');
  });

  $('#home-top-players').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    switchPage('players', {
      focusSelector: '#players-search'
    });
    await openPlayerDetail(button.dataset.playerId || '');
  });

  const runMatchFilter = async () => {
    state.matches.team = $('#matches-team-filter').value;
    state.matches.season = $('#matches-season-filter').value;
    await loadMatches({ page: 1, reset: true });
  };
  const debouncedMatchFilter = debounce(() => {
    state.matches.team = $('#matches-team-filter').value;
    state.matches.season = $('#matches-season-filter').value;
    void loadMatches({ page: 1, reset: true });
  }, 160);

  $('#matches-apply-filter').addEventListener('click', async () => {
    await runMatchFilter();
  });

  $('#matches-team-filter').addEventListener('change', () => {
    debouncedMatchFilter();
  });

  $('#matches-season-filter').addEventListener('change', () => {
    debouncedMatchFilter();
  });

  $('#matches-prev').addEventListener('click', async () => {
    if (state.matches.page <= 1) return;
    await loadMatches({ page: state.matches.page - 1 });
  });

  $('#matches-next').addEventListener('click', async () => {
    if (state.matches.page >= state.matches.totalPages) return;
    await loadMatches({ page: state.matches.page + 1 });
  });

  $('#matches-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-match-id]');
    if (!button) return;
    await openMatchDetail(button.dataset.matchId || '');
  });

  $('#home-recent-matches').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-match-id]');
    if (!button) return;
    switchPage('matches', {
      focusSelector: '#matches-team-filter'
    });
    await openMatchDetail(button.dataset.matchId || '');
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

  $('#chat-messages').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-question]');
    if (!button) return;
    await askChat(button.dataset.question || '');
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 920) {
      closeSidebar();
    }
  });

  setupPlayersObserver();
  setupSectionObserver();
}

async function init() {
  document.body.classList.add('single-dashboard');
  Object.values(pages).forEach((element) => {
    element?.classList.add('is-active');
  });
  bindEvents();
  applyTheme(loadTheme());
  setActivePage('home');

  renderBootState({
    status: 'loading',
    rows_processed: 0
  });

  await waitForDatasetReady();

  const options = await fetchJson('/api/options');
  fillOptions(options);
  await Promise.all([
    loadHome(),
    loadPlayers({ reset: true, page: 1 }),
    loadMatches({ page: 1, reset: true }),
    loadPlayerNames()
  ]);
  updateArchiveStatus({
    status: 'ready',
    rows_processed: ARCHIVE_TOTAL_ROWS
  });
}

init().catch((error) => {
  console.error(error);
  updateArchiveStatus({
    status: 'error',
    rows_processed: state.datasetStatus.rows_processed,
    error: error.message
  });
  $('#chat-messages').innerHTML = renderMessageHtml(
    'bot',
    `<div class="msg-body"><p>${safeText(error.message || 'Something went wrong.')}</p></div>`
  );
});
