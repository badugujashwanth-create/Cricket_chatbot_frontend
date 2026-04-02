const STARTER_PROMPTS = [
  'Virat Kohli stats',
  'Compare Virat Kohli vs Rohit Sharma',
  'India team stats in ODI',
  'Summarize the latest match',
  'Show recent live scores',
  'Top run scorers in 2024'
];

const elements = {
  starterChips: document.querySelector('#starter-chips'),
  chatForm: document.querySelector('#chat-form'),
  chatInput: document.querySelector('#chat-input'),
  sendButton: document.querySelector('#send-button'),
  statusPill: document.querySelector('#dataset-status-pill'),
  statusCopy: document.querySelector('#dataset-status-copy'),
  mobileBack: document.querySelector('#mobile-stage-back')
};

function cloneTemplate(templateId) {
  const template = document.querySelector(`#${templateId}`);
  if (!template) {
    throw new Error(`Missing template: ${templateId}`);
  }
  return template.content.cloneNode(true);
}

function createElement(tagName, classNames = []) {
  const node = document.createElement(tagName);
  classNames.filter(Boolean).forEach((className) => node.classList.add(className));
  return node;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
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
      phase: 'ready',
      pill: 'Archive live',
      copy: 'The local archive is indexed and ready for full analytics.',
      chip: 'Archive ready'
    };
  }

  if (source.status === 'error') {
    return {
      phase: 'error',
      pill: 'Archive error',
      copy: source.error || 'The archive failed to initialize.',
      chip: 'Offline'
    };
  }

  if (source.status === 'loading') {
    return {
      phase: 'loading',
      pill: 'Archive warming',
      copy: rows
        ? `${formatNumber(rows)} rows indexed so far.`
        : 'Preparing the local archive for analytics queries.',
      chip: rows ? `${formatCompact(rows)} rows` : 'Booting'
    };
  }

  return {
    phase: 'connecting',
    pill: 'Connecting',
    copy: 'Connecting to the local archive and live cricket feeds.',
    chip: 'Linking'
  };
}

function createReactiveStore(initialState = {}) {
  const emitter = new EventTarget();
  const proxyCache = new WeakMap();
  const rawCache = new WeakMap();
  const pendingEvents = new Map();
  let flushScheduled = false;

  function pathToString(parts = []) {
    return parts.filter((part) => part !== '').join('.');
  }

  function scheduleEmit(detail) {
    pendingEvents.set(detail.path, detail);
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      const events = [...pendingEvents.values()];
      pendingEvents.clear();
      events.forEach((entry) => {
        emitter.dispatchEvent(
          new CustomEvent('statechange', {
            detail: entry
          })
        );
      });
    });
  }

  function unwrap(value) {
    return rawCache.get(value) || value;
  }

  function proxify(target, path = []) {
    if (!target || typeof target !== 'object') return target;
    const rawTarget = unwrap(target);
    if (proxyCache.has(rawTarget)) return proxyCache.get(rawTarget);

    const proxy = new Proxy(rawTarget, {
      get(currentTarget, property, receiver) {
        const value = Reflect.get(currentTarget, property, receiver);
        return proxify(value, [...path, property]);
      },
      set(currentTarget, property, nextValue, receiver) {
        const previousValue = currentTarget[property];
        const rawNextValue = unwrap(nextValue);
        const didSet = Reflect.set(currentTarget, property, rawNextValue, receiver);
        if (!didSet || Object.is(previousValue, rawNextValue)) return didSet;

        scheduleEmit({
          path: pathToString([...path, property]),
          value: rawNextValue,
          previousValue
        });
        return didSet;
      },
      deleteProperty(currentTarget, property) {
        const previousValue = currentTarget[property];
        const didDelete = Reflect.deleteProperty(currentTarget, property);
        if (!didDelete) return didDelete;

        scheduleEmit({
          path: pathToString([...path, property]),
          value: undefined,
          previousValue
        });
        return didDelete;
      }
    });

    proxyCache.set(rawTarget, proxy);
    rawCache.set(proxy, rawTarget);
    return proxy;
  }

  function matchesPath(subscriptionPath = '', eventPath = '') {
    if (!subscriptionPath) return true;
    if (subscriptionPath === eventPath) return true;
    return eventPath.startsWith(`${subscriptionPath}.`);
  }

  function subscribe(subscriptionPath, listener) {
    const handler = (event) => {
      const detail = event.detail || {};
      if (!matchesPath(subscriptionPath, detail.path || '')) return;
      listener(detail);
    };

    emitter.addEventListener('statechange', handler);
    return () => emitter.removeEventListener('statechange', handler);
  }

  return {
    state: proxify(initialState),
    subscribe
  };
}

const { state, subscribe } = createReactiveStore({
  starterPrompts: [...STARTER_PROMPTS],
  chatHistory: [],
  canvasLayout: {},
  connectionStatus: statusMeta({}),
  archiveStatus: null,
  homeData: null,
  liveData: [],
  sessionId: '',
  hasAskedQuestion: false,
  isQuerying: false,
  activeRequestId: 0,
  pollTimer: null
});

function createChipButton(question = '') {
  const button = createElement('button', ['chip']);
  button.type = 'button';
  button.dataset.question = question;
  button.textContent = question;
  return button;
}

function createChipRow(items = []) {
  const row = createElement('div', ['chip-row']);
  items.filter(Boolean).forEach((item) => row.append(createChipButton(item)));
  return row;
}

function createTypingIndicator() {
  const indicator = createElement('div', ['typing-indicator']);
  const label = createElement('span', ['typing-label']);
  label.textContent = 'PROCESSING SIGNAL';
  const cursor = createElement('span', ['typing-cursor']);
  cursor.textContent = '_';
  indicator.append(label, cursor);
  return indicator;
}

function buildSectionShell({ kicker = '', title = '', copy = '', classes = [] } = {}) {
  const section = createElement('section', ['stage-panel', ...classes]);
  const heading = createElement('div', ['section-heading']);
  const kickerNode = createElement('p', ['section-kicker']);
  kickerNode.textContent = kicker;
  const titleNode = createElement('h3', ['section-title']);
  titleNode.textContent = title;
  heading.append(kickerNode, titleNode);

  if (copy) {
    const copyNode = createElement('p', ['section-copy']);
    copyNode.textContent = copy;
    heading.append(copyNode);
  }

  const body = createElement('div');
  section.append(heading, body);
  return { section, body };
}

function createMatchCard(match = {}) {
  const card = createElement('article', ['match-card']);
  const head = createElement('div', ['match-head']);
  const main = createElement('div', ['match-main']);
  const title = createElement('p', ['list-title']);
  title.textContent = match.name || 'Match';
  const date = createElement('p', ['list-subcopy']);
  date.textContent = formatDate(match.date || '');
  main.append(title, date);
  head.append(main);
  card.append(head);

  const chips = [];
  if (match.match_type) chips.push(match.match_type);
  if (match.venue) chips.push(match.venue);
  if (match.winner) chips.push(`Winner: ${match.winner}`);

  toArray(match.score).forEach((row) => {
    const wickets = row.wickets === null || row.wickets === undefined ? '-' : row.wickets;
    const overs = row.overs === null || row.overs === undefined ? '-' : row.overs;
    chips.push(`${row.inning || 'Innings'} ${row.runs || 0}/${wickets} (${overs})`);
  });

  if (chips.length) {
    const chipRow = createElement('div', ['stage-chip-row']);
    chips.forEach((chip) => {
      const chipNode = createElement('span', ['match-chip']);
      chipNode.textContent = chip;
      chipRow.append(chipNode);
    });
    card.append(chipRow);
  }

  const summary = match.summary || match.status;
  if (summary) {
    const copy = createElement('p', ['list-subcopy']);
    copy.textContent = summary;
    card.append(copy);
  }

  return card;
}

function createLeaderboardRow(row = {}, index = 0) {
  const card = createElement('article', ['list-row']);
  const left = createElement('div', ['leader-main']);
  const title = createElement('p', ['list-title']);
  title.textContent = row.player || row.name || 'Player';
  const subtitle = createElement('p', ['list-subcopy']);
  subtitle.textContent = row.team || row.country || 'Archive';
  left.append(title, subtitle);

  const right = createElement('div');
  const rank = createElement('div', ['list-rank']);
  rank.textContent = `#${row.rank ?? index + 1}`;
  const value = createElement('p', ['list-subcopy']);
  value.textContent = String(row.value ?? '-');
  right.append(rank, value);

  card.append(left, right);
  return card;
}

function renderWidget(widget = {}) {
  if (!widget || !widget.type) return createElement('div');

  if (widget.type === 'live_match_banner') {
    const banner = document.createElement('live-match-banner');
    banner.widget = widget;
    return banner;
  }

  if (widget.type === 'stat_grid') {
    const grid = createElement('div', ['stat-flex']);
    toArray(widget.items).forEach((item) => {
      const card = document.createElement('stat-card');
      card.widget = item;
      grid.append(card);
    });
    return grid;
  }

  if (widget.type === 'empty_state') {
    const section = createElement('section', ['stage-panel', 'empty-state']);
    const title = createElement('h3', ['empty-title']);
    title.textContent = widget.title || 'Nothing to show';
    const copy = createElement('p', ['empty-copy']);
    copy.textContent = widget.copy || 'No canvas widgets are available.';
    section.append(title, copy);
    if (toArray(widget.actions).length) {
      section.append(createChipRow(widget.actions));
    }
    return section;
  }

  if (widget.type === 'message_panel') {
    const { section, body } = buildSectionShell({
      kicker: widget.kicker || 'Summary',
      title: widget.title || 'Cricket Intelligence',
      copy: widget.copy || ''
    });
    const summary = createElement('p', ['hero-summary']);
    summary.textContent = widget.summary || 'No summary available.';
    body.append(summary);
    if (toArray(widget.actions).length) {
      body.append(createChipRow(widget.actions));
    }
    return section;
  }

  if (widget.type === 'leaderboard') {
    const { section, body } = buildSectionShell({
      kicker: widget.kicker || 'Ranking',
      title: widget.title || 'Leaderboard',
      copy: widget.copy || ''
    });
    const grid = createElement('div', ['list-grid']);
    const rows = toArray(widget.rows);
    if (rows.length) {
      rows.forEach((row, index) => grid.append(createLeaderboardRow(row, index)));
    } else {
      const empty = createElement('p', ['empty-copy']);
      empty.textContent = 'No ranked rows were returned.';
      grid.append(empty);
    }
    body.append(grid);
    return section;
  }

  if (widget.type === 'match_list') {
    const { section, body } = buildSectionShell({
      kicker: widget.kicker || 'Tape',
      title: widget.title || 'Match Tape',
      copy: widget.copy || ''
    });
    const grid = createElement('div', ['match-grid']);
    const matches = toArray(widget.matches);
    if (matches.length) {
      matches.forEach((match) => grid.append(createMatchCard(match)));
    } else {
      const empty = createElement('p', ['empty-copy']);
      empty.textContent = 'No match cards are available for this response yet.';
      grid.append(empty);
    }
    body.append(grid);
    return section;
  }

  if (widget.type === 'comparison_group') {
    const { section, body } = buildSectionShell({
      kicker: widget.kicker || 'Comparison',
      title: widget.title || 'Comparison',
      copy: widget.copy || ''
    });
    const grid = createElement('div', ['comparison-grid']);
    toArray(widget.bars).forEach((bar) => {
      const barNode = document.createElement('comparison-bar');
      barNode.widget = bar;
      grid.append(barNode);
    });
    body.append(grid);
    return section;
  }

  return createElement('div');
}

class ChatMessageElement extends HTMLElement {
  set message(value) {
    this._message = value || {};
    this.render();
  }

  render() {
    const fragment = cloneTemplate('chat-message-template');
    const article = fragment.querySelector('.chat-message');
    const role = fragment.querySelector('[data-field="role"]');
    const channel = fragment.querySelector('[data-field="channel"]');
    const prefix = fragment.querySelector('[data-field="prefix"]');
    const content = fragment.querySelector('[data-field="content"]');
    const stack = fragment.querySelector('.chat-content-stack');
    const message = this._message || {};
    const isUser = message.role === 'user';

    article.classList.toggle('user', isUser);
    article.classList.toggle('assistant', !isUser);
    article.dataset.role = isUser ? 'user' : 'assistant';
    role.textContent = isUser ? 'System Input' : 'Telemetry Output';
    channel.textContent = isUser ? 'INPUT' : 'OUTPUT';
    prefix.hidden = !isUser;
    content.textContent = message.content || '';

    if (message.pending) {
      stack.append(createTypingIndicator());
    }

    if (toArray(message.actions).length) {
      stack.append(createChipRow(message.actions));
    }

    this.replaceChildren(fragment);
  }
}

class ChatThreadElement extends HTMLElement {
  connectedCallback() {
    if (!this._mounted) {
      const fragment = cloneTemplate('chat-thread-template');
      this._messageRoot = fragment.querySelector('[data-role="messages"]');
      this.append(fragment);
      this._mounted = true;
    }

    this._unsubscribe = subscribe('chatHistory', () => this.scheduleRender());
    this.scheduleRender();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
  }

  scheduleRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this.render();
    });
  }

  render() {
    if (!this._messageRoot) return;
    const nodes = toArray(state.chatHistory).map((message) => {
      const node = document.createElement('chat-message');
      node.message = message;
      return node;
    });
    this._messageRoot.replaceChildren(...nodes);
    scrollToBottom(this);
  }
}

class StatCardElement extends HTMLElement {
  set widget(value) {
    this._widget = value || {};
    this.render();
  }

  render() {
    const fragment = cloneTemplate('stat-card-template');
    const card = fragment.querySelector('.stat-card');
    const label = fragment.querySelector('[data-field="label"]');
    const value = fragment.querySelector('[data-field="value"]');
    const note = fragment.querySelector('[data-field="note"]');
    const widget = this._widget || {};

    if (widget.tone) {
      card.classList.add(widget.tone);
    }

    label.textContent = widget.label || 'Signal';
    value.textContent = String(widget.value ?? '-');
    note.textContent = widget.note || '';
    note.hidden = !widget.note;
    this.replaceChildren(fragment);
  }
}

class LiveMatchBannerElement extends HTMLElement {
  set widget(value) {
    this._widget = value || {};
    this.render();
  }

  render() {
    const fragment = cloneTemplate('live-match-banner-template');
    const widget = this._widget || {};
    const kicker = fragment.querySelector('[data-field="kicker"]');
    const title = fragment.querySelector('[data-field="title"]');
    const subtitle = fragment.querySelector('[data-field="subtitle"]');
    const summary = fragment.querySelector('[data-field="summary"]');
    const chipRoot = fragment.querySelector('[data-role="chips"]');
    const statRoot = fragment.querySelector('[data-role="stats"]');

    kicker.textContent = widget.kicker || 'Live Feed';
    title.textContent = widget.title || 'Live Match Center';
    subtitle.textContent = widget.subtitle || '';
    subtitle.hidden = !widget.subtitle;
    summary.textContent = widget.summary || '';
    summary.hidden = !widget.summary;

    chipRoot.replaceChildren(
      ...toArray(widget.chips)
        .filter(Boolean)
        .map((chip) => {
          const node = createElement('span', ['stage-chip']);
          node.textContent = chip;
          return node;
        })
    );

    statRoot.replaceChildren(
      ...toArray(widget.stats).map((item) => {
        const card = document.createElement('stat-card');
        card.widget = item;
        return card;
      })
    );

    this.replaceChildren(fragment);
  }
}

class ComparisonBarElement extends HTMLElement {
  set widget(value) {
    this._widget = value || {};
    this.render();
  }

  render() {
    const fragment = cloneTemplate('comparison-bar-template');
    const widget = this._widget || {};
    const label = fragment.querySelector('[data-field="label"]');
    const leftValue = fragment.querySelector('[data-field="left-value"]');
    const rightValue = fragment.querySelector('[data-field="right-value"]');
    const leftBar = fragment.querySelector('[data-role="left-bar"]');
    const rightBar = fragment.querySelector('[data-role="right-bar"]');

    const leftAmount = Number(widget.leftAmount || 0);
    const rightAmount = Number(widget.rightAmount || 0);
    const total = leftAmount + rightAmount;
    const leftRatio = total > 0 ? Math.max(8, Math.round((leftAmount / total) * 100)) : 50;
    const rightRatio = total > 0 ? Math.max(8, Math.round((rightAmount / total) * 100)) : 50;

    label.textContent = widget.label || 'Comparison';
    leftValue.textContent = widget.leftValue || '';
    rightValue.textContent = widget.rightValue || '';
    leftBar.style.width = `${leftRatio}%`;
    rightBar.style.width = `${rightRatio}%`;
    this.replaceChildren(fragment);
  }
}

class DynamicCanvasElement extends HTMLElement {
  connectedCallback() {
    if (!this._mounted) {
      const fragment = cloneTemplate('dynamic-canvas-template');
      this._eyebrow = fragment.querySelector('[data-field="eyebrow"]');
      this._title = fragment.querySelector('[data-field="title"]');
      this._subtitle = fragment.querySelector('[data-field="subtitle"]');
      this._chipRoot = fragment.querySelector('[data-role="chips"]');
      this._widgetRoot = fragment.querySelector('[data-role="widgets"]');
      this._scrollRegion = fragment.querySelector('.stage-scroll');
      this.style.display = 'grid';
      this.style.gridTemplateRows = 'auto minmax(0, 1fr)';
      this.style.gap = '18px';
      this.style.height = '100%';
      this.append(fragment);
      this._mounted = true;
    }

    this._unsubscribe = subscribe('canvasLayout', () => this.scheduleRender());
    this.scheduleRender();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
  }

  scheduleRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this.render();
    });
  }

  render() {
    const layout = state.canvasLayout || {};
    this._eyebrow.textContent = layout.eyebrow || 'Omni-Channel Canvas';
    this._title.textContent = layout.title || 'Cricket Analytics Broadcast';
    this._subtitle.textContent = layout.subtitle || '';
    this._subtitle.hidden = !layout.subtitle;

    const chips = toArray(layout.chips).filter(Boolean);
    this._chipRoot.replaceChildren(
      ...chips.map((chip) => {
        const node = createElement('span', ['stage-chip']);
        node.textContent = chip;
        return node;
      })
    );

    const widgets = toArray(layout.widgets).map((widget) => renderWidget(widget));
    this._widgetRoot.replaceChildren(...widgets);
    this._scrollRegion.setAttribute('aria-busy', layout.busy ? 'true' : 'false');
  }
}

if (!customElements.get('chat-message')) {
  customElements.define('chat-message', ChatMessageElement);
}

if (!customElements.get('chat-thread')) {
  customElements.define('chat-thread', ChatThreadElement);
}

if (!customElements.get('stat-card')) {
  customElements.define('stat-card', StatCardElement);
}

if (!customElements.get('live-match-banner')) {
  customElements.define('live-match-banner', LiveMatchBannerElement);
}

if (!customElements.get('comparison-bar')) {
  customElements.define('comparison-bar', ComparisonBarElement);
}

if (!customElements.get('dynamic-canvas')) {
  customElements.define('dynamic-canvas', DynamicCanvasElement);
}

function fetchJson(url, options = {}) {
  return fetch(url, options).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.summary || 'Request failed.');
    }
    return payload;
  });
}

function renderStarterDeck() {
  elements.starterChips.replaceChildren(
    ...toArray(state.starterPrompts).map((prompt) => createChipButton(prompt))
  );
}

function renderConnectionStatus() {
  elements.statusPill.textContent = state.connectionStatus.pill;
  elements.statusCopy.textContent = state.connectionStatus.copy;
}

function renderComposerState() {
  elements.sendButton.disabled = Boolean(state.isQuerying);
  elements.sendButton.textContent = state.isQuerying ? 'Thinking...' : 'Send';
}

function resizeComposer() {
  const input = elements.chatInput;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function openCanvasOnMobile() {
  // Phase 1 uses a single-column chat layout with no separate mobile canvas.
}

function closeCanvasOnMobile() {
  // Phase 1 uses a single-column chat layout with no separate mobile canvas.
}

function syncViewportMode() {
  if (window.innerWidth >= 768) {
    closeCanvasOnMobile();
  }
}

function nextMessageId() {
  return globalThis.crypto?.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function appendChatMessage(role = 'assistant', content = '', options = {}) {
  state.chatHistory.push({
    id: nextMessageId(),
    role,
    content,
    pending: Boolean(options.pending),
    actions: toArray(options.actions)
  });
  return state.chatHistory[state.chatHistory.length - 1];
}

function updateChatMessage(messageId = '', patch = {}) {
  const target = toArray(state.chatHistory).find((message) => message.id === messageId);
  if (!target) return;
  Object.entries(patch).forEach(([key, value]) => {
    target[key] = value;
  });
}

function buildBootCanvasLayout() {
  const status = state.archiveStatus || {};
  return {
    eyebrow: 'Omni-Channel Canvas',
    title: 'Broadcast stage warming',
    subtitle: 'Natural language controls will take over as soon as the archive is ready.',
    chips: [state.connectionStatus.pill],
    widgets: [
      {
        type: 'live_match_banner',
        kicker: 'System Bring-Up',
        title: 'Stadium Night signal path is online',
        summary: state.connectionStatus.copy,
        stats: [
          { label: 'Status', value: state.connectionStatus.pill, note: 'Archive readiness', tone: 'highlight' },
          { label: 'Rows', value: formatCompact(status.rows_processed || 0), note: 'Indexed so far' },
          { label: 'Control', value: 'Chat', note: 'Primary command surface' },
          { label: 'Theme', value: 'Night', note: 'Broadcast interface' }
        ]
      },
      {
        type: 'empty_state',
        title: 'Awaiting first command',
        copy: 'Ask for a player, a team, a match, or a comparison to generate the first analytics composition.',
        actions: state.starterPrompts.slice(0, 4)
      }
    ]
  };
}

function buildLandingCanvasLayout() {
  const home = state.homeData || {};
  const quickStats = home.quick_stats || {};
  const topPlayers = toArray(home.top_players).slice(0, 6);
  const liveItems = toArray(state.liveData).slice(0, 4);
  const fallbackMatches = toArray(home.recent_matches).slice(0, 4);

  return {
    eyebrow: 'Omni-Channel Canvas',
    title: 'Command the field with language',
    subtitle: 'Use the left command center to summon player stories, live surfaces, and comparison scenes.',
    chips: ['Canvas online', liveItems.length ? `${liveItems.length} live feeds` : 'Archive-first mode'],
    widgets: [
      {
        type: 'live_match_banner',
        kicker: 'Opening Feed',
        title: 'One canvas. Every cricket question.',
        summary:
          'This stage is built around natural language resolution. Ask for player stats, match stories, team form, live updates, or side-by-side comparisons and the canvas will rebuild around that intent.',
        stats: [
          { label: 'Matches', value: formatCompact(quickStats.matches || 0), note: 'Archive footprint', tone: 'highlight' },
          { label: 'Players', value: formatCompact(quickStats.players || 0), note: 'Profiles in scope' },
          { label: 'Teams', value: formatCompact(quickStats.teams || 0), note: 'Competitive entities' },
          { label: 'Seasons', value: quickStats.seasons || 'N/A', note: 'Coverage window' }
        ]
      },
      {
        type: 'leaderboard',
        kicker: 'Ranking',
        title: 'Featured Batters',
        copy: 'High-output names currently loaded into the archive.',
        rows: topPlayers.map((player, index) => ({
          rank: index + 1,
          player: player.name,
          team: player.team,
          value: `${formatNumber(player.runs || 0)} runs`
        }))
      },
      {
        type: 'match_list',
        kicker: 'Tape',
        title: liveItems.length ? 'Live Signal' : 'Recent Archive Tape',
        copy: liveItems.length
          ? 'Live or recent feed items from the connected match provider.'
          : 'Latest archived matches available locally.',
        matches: liveItems.length ? liveItems : fallbackMatches
      }
    ]
  };
}

function buildSkeletonCanvasLayout(question = '') {
  return {
    eyebrow: 'Analytics Canvas',
    title: 'Resolving Query',
    subtitle: question || 'Interpreting the prompt and composing the next stage.',
    chips: [state.connectionStatus.chip],
    busy: true,
    widgets: [
      {
        type: 'live_match_banner',
        kicker: 'Query Mapping',
        title: 'Signal path is warming up',
        summary: 'Fetching structured evidence and preparing the next analytics canvas.',
        stats: [
          { label: 'Intent', value: 'Parsing', note: 'Understanding the prompt', tone: 'highlight' },
          { label: 'Archive', value: state.connectionStatus.pill, note: 'Current data source state' },
          { label: 'Renderer', value: 'Canvas', note: 'Preparing reactive widgets' }
        ]
      }
    ]
  };
}

function buildErrorCanvasLayout(message = '') {
  return {
    eyebrow: 'Canvas Fault',
    title: 'Query could not be completed',
    subtitle: 'The analytics stage did not receive a usable payload.',
    chips: ['Fault'],
    widgets: [
      {
        type: 'empty_state',
        title: 'Request failed',
        copy: message || 'Unable to complete this query right now.',
        actions: state.starterPrompts.slice(0, 3)
      }
    ]
  };
}

function numericStatCards(items = []) {
  return items
    .filter((item) => item.value !== undefined && item.value !== null)
    .map((item) => ({
      label: item.label,
      value: item.value,
      note: item.note || '',
      tone: item.tone || ''
    }));
}

function buildPlayerCanvasLayout(payload = {}, data = {}) {
  const player = data.player || {};
  const stats = data.stats || {};
  const recentMatches = toArray(data.recent_matches || stats.recent_matches).slice(0, 6);

  return {
    eyebrow: 'Player Surface',
    title: player.name || 'Player Stats',
    subtitle: player.team || 'Archive player profile',
    chips: [player.team, 'Player stats'].filter(Boolean),
    widgets: [
      {
        type: 'stat_grid',
        items: numericStatCards([
          { label: 'Matches', value: formatNumber(stats.matches || 0), note: 'Archive sample', tone: 'highlight' },
          { label: 'Runs', value: formatNumber(stats.runs || 0), note: 'Career total' },
          { label: 'Average', value: formatDecimal(stats.average || 0), note: 'Batting average' },
          { label: 'Strike Rate', value: formatDecimal(stats.strike_rate || 0), note: 'Scoring tempo' },
          { label: 'Wickets', value: formatNumber(stats.wickets || 0), note: 'Bowling return' },
          { label: 'Economy', value: formatDecimal(stats.economy || 0), note: 'Runs conceded per over' }
        ])
      },
      {
        type: 'message_panel',
        kicker: 'Analyst Readout',
        title: 'Summary',
        copy: 'Structured response from the archive-backed analytics layer.',
        summary: payload.summary || payload.answer || 'No summary available.',
        actions: suggestionsFromPayload(payload)
      },
      {
        type: 'match_list',
        kicker: 'Tape',
        title: 'Recent Matches',
        copy: 'Latest archived matches contributing to this player view.',
        matches: recentMatches
      }
    ]
  };
}

function buildTeamCanvasLayout(payload = {}, data = {}) {
  const team = data.team || {};
  const stats = data.stats || {};
  return {
    eyebrow: 'Team Surface',
    title: team.name || 'Team Stats',
    subtitle: payload.summary || 'Archive team performance snapshot',
    chips: ['Team stats'],
    widgets: [
      {
        type: 'stat_grid',
        items: numericStatCards([
          { label: 'Matches', value: formatNumber(stats.matches || 0), note: 'Archive sample', tone: 'highlight' },
          { label: 'Wins', value: formatNumber(stats.wins || 0), note: 'Victories' },
          { label: 'Win Rate', value: `${formatDecimal(stats.win_rate || 0)}%`, note: 'Share of matches won' },
          { label: 'Average Score', value: formatDecimal(stats.average_score || 0), note: 'Runs per match' },
          { label: 'Runs', value: formatNumber(stats.runs || 0), note: 'Total team runs' },
          { label: 'Wickets Lost', value: formatNumber(stats.wickets_lost || 0), note: 'Dismissals recorded' }
        ])
      },
      {
        type: 'message_panel',
        kicker: 'Analyst Readout',
        title: 'Summary',
        copy: 'Verified archive interpretation for the current team scope.',
        summary: payload.summary || payload.answer || 'No summary available.',
        actions: suggestionsFromPayload(payload)
      },
      {
        type: 'match_list',
        kicker: 'Tape',
        title: 'Recent Matches',
        copy: 'Latest matches contributing to this team snapshot.',
        matches: toArray(stats.recent_matches).slice(0, 6)
      }
    ]
  };
}

function buildCompareCanvasLayout(payload = {}, data = {}) {
  const left = data.left || {};
  const right = data.right || {};
  const leftStats = left.stats || {};
  const rightStats = right.stats || {};

  return {
    eyebrow: 'Compare Surface',
    title: `${left.name || 'Player A'} vs ${right.name || 'Player B'}`,
    subtitle: payload.summary || 'Archive comparison snapshot',
    chips: ['Versus mode'],
    widgets: [
      {
        type: 'stat_grid',
        items: [
          { label: left.name || 'Left', value: formatNumber(leftStats.runs || 0), note: 'Runs', tone: 'highlight' },
          { label: right.name || 'Right', value: formatNumber(rightStats.runs || 0), note: 'Runs' },
          { label: 'Left SR', value: formatDecimal(leftStats.strike_rate || 0), note: 'Strike rate' },
          { label: 'Right SR', value: formatDecimal(rightStats.strike_rate || 0), note: 'Strike rate' }
        ]
      },
      {
        type: 'comparison_group',
        kicker: 'Pressure Split',
        title: 'Core Metrics',
        copy: 'Shared-scale view of the compared player signals.',
        bars: [
          {
            label: 'Runs',
            leftAmount: Number(leftStats.runs || 0),
            rightAmount: Number(rightStats.runs || 0),
            leftValue: `${left.name || 'Left'}: ${formatNumber(leftStats.runs || 0)}`,
            rightValue: `${right.name || 'Right'}: ${formatNumber(rightStats.runs || 0)}`
          },
          {
            label: 'Average',
            leftAmount: Number(leftStats.average || 0),
            rightAmount: Number(rightStats.average || 0),
            leftValue: `${left.name || 'Left'}: ${formatDecimal(leftStats.average || 0)}`,
            rightValue: `${right.name || 'Right'}: ${formatDecimal(rightStats.average || 0)}`
          },
          {
            label: 'Strike Rate',
            leftAmount: Number(leftStats.strike_rate || 0),
            rightAmount: Number(rightStats.strike_rate || 0),
            leftValue: `${left.name || 'Left'}: ${formatDecimal(leftStats.strike_rate || 0)}`,
            rightValue: `${right.name || 'Right'}: ${formatDecimal(rightStats.strike_rate || 0)}`
          },
          {
            label: 'Wickets',
            leftAmount: Number(leftStats.wickets || 0),
            rightAmount: Number(rightStats.wickets || 0),
            leftValue: `${left.name || 'Left'}: ${formatNumber(leftStats.wickets || 0)}`,
            rightValue: `${right.name || 'Right'}: ${formatNumber(rightStats.wickets || 0)}`
          }
        ]
      },
      {
        type: 'message_panel',
        kicker: 'Analyst Readout',
        title: 'Summary',
        copy: 'Comparison summary returned by the current backend query.',
        summary: payload.summary || payload.answer || 'No comparison summary available.',
        actions: suggestionsFromPayload(payload)
      }
    ]
  };
}

function buildMatchSummaryCanvasLayout(payload = {}, data = {}) {
  const match = data.match || {};
  const scoreCards = toArray(match.score || data.score).slice(0, 4);

  return {
    eyebrow: 'Match Story',
    title: match.name || data.title || 'Match Summary',
    subtitle: [formatDate(match.date || ''), match.venue].filter(Boolean).join(' | '),
    chips: [match.winner ? `Winner: ${match.winner}` : '', match.match_type].filter(Boolean),
    widgets: [
      {
        type: 'live_match_banner',
        kicker: 'Result Signal',
        title: match.name || 'Match Summary',
        summary: payload.summary || match.summary || 'No summary available.',
        chips: [match.venue, formatDate(match.date || ''), match.winner ? `Winner: ${match.winner}` : '', match.match_type].filter(Boolean),
        stats: scoreCards.length
          ? scoreCards.map((row) => ({
              label: row.inning || 'Innings',
              value: `${row.runs || 0}/${row.wickets ?? '-'}`,
              note: `${row.overs ?? '-'} overs`
            }))
          : [{ label: 'Scorecard', value: 'Unavailable', note: 'No inning data returned', tone: 'highlight' }]
      },
      {
        type: 'leaderboard',
        kicker: 'Batting',
        title: 'Top Batters',
        copy: 'Highest batting contributions from this match.',
        rows: toArray(match.top_batters).slice(0, 4).map((row, index) => ({
          rank: index + 1,
          player: row.name,
          team: row.team,
          value: `${row.runs || 0} runs${row.balls ? ` in ${row.balls} balls` : ''}`
        }))
      },
      {
        type: 'leaderboard',
        kicker: 'Bowling',
        title: 'Top Bowlers',
        copy: 'Best bowling figures from the scorecard.',
        rows: toArray(match.top_bowlers).slice(0, 4).map((row, index) => ({
          rank: index + 1,
          player: row.name,
          team: row.team || 'Archive',
          value: `${row.wickets || 0}/${row.runs_conceded || 0}${row.overs ? ` in ${row.overs}` : ''}`
        }))
      }
    ]
  };
}

function buildHeadToHeadCanvasLayout(payload = {}, data = {}) {
  const stats = data.stats || {};
  return {
    eyebrow: 'Head-to-Head',
    title: data.title || `${data.team1 || 'Team 1'} vs ${data.team2 || 'Team 2'}`,
    subtitle: payload.summary || 'Archive rivalry snapshot',
    chips: ['Rivalry view'],
    widgets: [
      {
        type: 'comparison_group',
        kicker: 'Pressure Split',
        title: 'Wins Balance',
        copy: 'Head-to-head distribution for the selected rivalry.',
        bars: [
          {
            label: 'Wins',
            leftAmount: Number(stats.wins_team_a || 0),
            rightAmount: Number(stats.wins_team_b || 0),
            leftValue: `${data.team1 || 'Team 1'}: ${formatNumber(stats.wins_team_a || 0)}`,
            rightValue: `${data.team2 || 'Team 2'}: ${formatNumber(stats.wins_team_b || 0)}`
          }
        ]
      },
      {
        type: 'stat_grid',
        items: [
          { label: 'Matches', value: formatNumber(stats.matches || 0), note: 'Total meetings', tone: 'highlight' },
          { label: data.team1 || 'Team 1', value: formatNumber(stats.wins_team_a || 0), note: 'Wins' },
          { label: data.team2 || 'Team 2', value: formatNumber(stats.wins_team_b || 0), note: 'Wins' },
          { label: 'No Result', value: formatNumber(stats.no_result || 0), note: 'Abandonments' }
        ]
      },
      {
        type: 'match_list',
        kicker: 'Tape',
        title: 'Recent Meetings',
        copy: 'Latest matches in this rivalry sample.',
        matches: toArray(data.recent_matches || stats.recent_matches).slice(0, 6)
      }
    ]
  };
}

function buildTopPlayersCanvasLayout(payload = {}, data = {}) {
  return {
    eyebrow: 'Leaderboard Surface',
    title: data.title || 'Top Players',
    subtitle: payload.summary || 'Archive ranking',
    chips: [data.metric ? `Metric: ${data.metric}` : 'Ranking'],
    widgets: [
      {
        type: 'leaderboard',
        kicker: 'Ranking',
        title: data.title || 'Top Players',
        copy: 'Ranked performers returned by the current query.',
        rows: toArray(data.rows)
      },
      {
        type: 'message_panel',
        kicker: 'Analyst Readout',
        title: 'Summary',
        copy: 'Short explanation for the current ranking scope.',
        summary: payload.summary || payload.answer || 'No ranking summary available.',
        actions: suggestionsFromPayload(payload)
      }
    ]
  };
}

function buildLiveUpdateCanvasLayout(payload = {}, data = {}) {
  const matches = [];
  if (data.live_match?.name) matches.push(data.live_match);
  if (Array.isArray(data.upcoming_matches)) matches.push(...data.upcoming_matches);
  if (Array.isArray(data.recent_matches)) matches.push(...data.recent_matches);

  return {
    eyebrow: 'Live Match Center',
    title: data.title || 'Live Update',
    subtitle: data.subtitle || 'Current and upcoming fixtures',
    chips: [data.provider_status?.title, data.live_match?.name ? 'Live signal active' : 'No live match'].filter(Boolean),
    widgets: [
      {
        type: 'live_match_banner',
        kicker: 'Live Feed',
        title: data.title || 'Live Match Center',
        subtitle: data.player?.name || data.provider_status?.title || '',
        summary: payload.summary || data.summary || data.provider_status?.message || 'No live summary available.',
        stats: [
          { label: 'Live', value: data.live_match?.name ? 'Active' : 'Idle', note: 'Current live surface', tone: 'highlight' },
          { label: 'Upcoming', value: formatNumber(toArray(data.upcoming_matches).length), note: 'Scheduled matches' },
          { label: 'Recent', value: formatNumber(toArray(data.recent_matches).length), note: 'Recent feed items' },
          { label: 'Tracked Player', value: data.player?.name || 'None', note: data.player?.country || 'No live player card' }
        ]
      },
      {
        type: 'match_list',
        kicker: 'Tape',
        title: 'Live / Upcoming Tape',
        copy: 'Live, scheduled, and recent fixtures from the provider feed.',
        matches: matches.filter((match) => match?.name)
      }
    ]
  };
}

function buildSummaryCanvasLayout(payload = {}, data = {}) {
  const keyStats = toArray(payload.key_stats);
  return {
    eyebrow: 'Summary Surface',
    title: payload.title || data.title || 'Cricket Intelligence',
    subtitle: payload.summary || data.summary || 'Natural language result',
    chips: ['Summary'],
    widgets: [
      {
        type: 'message_panel',
        kicker: 'Summary',
        title: payload.title || data.title || 'Cricket Intelligence',
        copy: 'High-level result generated from the active query.',
        summary: payload.summary || data.summary || payload.answer || 'No summary available.',
        actions: suggestionsFromPayload(payload)
      },
      ...(keyStats.length
        ? [
            {
              type: 'stat_grid',
              items: keyStats.map((item) => ({
                label: item.label || 'Signal',
                value:
                  item.left !== undefined || item.right !== undefined
                    ? `${item.left ?? '-'} / ${item.right ?? '-'}`
                    : String(item.value ?? '-'),
                note: ''
              }))
            }
          ]
        : [])
    ]
  };
}

function buildCanvasLayoutFromPayload(payload = {}) {
  const data = detailData(payload);

  switch (data.type) {
    case 'player_stats':
      return buildPlayerCanvasLayout(payload, data);
    case 'team_stats':
      return buildTeamCanvasLayout(payload, data);
    case 'compare_players':
      return buildCompareCanvasLayout(payload, data);
    case 'match_summary':
      return buildMatchSummaryCanvasLayout(payload, data);
    case 'head_to_head':
      return buildHeadToHeadCanvasLayout(payload, data);
    case 'top_players':
      return buildTopPlayersCanvasLayout(payload, data);
    case 'live_update':
      return buildLiveUpdateCanvasLayout(payload, data);
    default:
      return buildSummaryCanvasLayout(payload, data);
  }
}

const SESSION_STORAGE_KEY = 'cricket-chatbot-session-id';
let activeStream = null;
let statusPollTimer = null;

function getOrCreateSessionId() {
  const fallback = nextMessageId();
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fallback);
    return fallback;
  } catch (_) {
    return fallback;
  }
}

function scrollToBottom(target = document.querySelector('#chat-thread')) {
  const node = target;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (node && typeof node.scrollTo === 'function' && node.scrollHeight > node.clientHeight + 4) {
        node.scrollTo({
          top: node.scrollHeight,
          behavior: 'smooth'
        });
      }
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    });
  });
}

function parseEventPayload(event) {
  try {
    return JSON.parse(String(event?.data || '{}'));
  } catch (_) {
    return {};
  }
}

function closeActiveStream() {
  if (!activeStream) return;
  activeStream.close();
  activeStream = null;
}

function answerTextFromPayload(payload = {}) {
  return String(payload.answer || payload.summary || payload.message || 'No answer was returned.').trim();
}

function setLandingCanvasIfIdle() {
  if (state.hasAskedQuestion) return;
  state.canvasLayout = state.connectionStatus.phase === 'ready' ? buildLandingCanvasLayout() : buildBootCanvasLayout();
}

async function refreshArchiveStatus() {
  try {
    const status = await fetchJson('/api/status');
    state.archiveStatus = status;
    state.connectionStatus = statusMeta(status);
    if (status?.status === 'ready') {
      if (statusPollTimer) {
        clearInterval(statusPollTimer);
        statusPollTimer = null;
      }
      await refreshHomeData();
    }
  } catch (error) {
    state.connectionStatus = statusMeta({
      status: 'error',
      error: error?.message || 'Unable to load archive status.'
    });
  } finally {
    setLandingCanvasIfIdle();
  }
}

async function refreshHomeData() {
  try {
    state.homeData = await fetchJson('/api/home');
  } catch (_) {
    // Keep the existing landing surface if home data is still warming up.
  } finally {
    setLandingCanvasIfIdle();
  }
}

async function refreshLiveData() {
  try {
    const payload = await fetchJson('/api/cricapi/live-scores?includeRecent=true&limit=4');
    state.liveData = toArray(payload.items);
  } catch (_) {
    state.liveData = [];
  } finally {
    setLandingCanvasIfIdle();
  }
}

function ensureStatusPolling() {
  if (statusPollTimer) return;
  statusPollTimer = window.setInterval(() => {
    if (state.connectionStatus.phase === 'ready') {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
      return;
    }
    void refreshArchiveStatus();
  }, 15000);
}

function updatePendingAssistantMessage(messageId = '', statusMessage = '') {
  updateChatMessage(messageId, {
    content: String(statusMessage || 'Working on your question...').trim(),
    pending: true
  });
  scrollToBottom();
}

function completeAssistantMessage(messageId = '', payload = {}) {
  updateChatMessage(messageId, {
    content: answerTextFromPayload(payload),
    pending: false,
    actions: suggestionsFromPayload(payload)
  });
  state.canvasLayout = buildCanvasLayoutFromPayload(payload);
  scrollToBottom();
  openCanvasOnMobile();
}

function failAssistantMessage(messageId = '', payload = {}) {
  const message = answerTextFromPayload(payload) || 'The live stream ended before an answer arrived.';
  updateChatMessage(messageId, {
    content: message,
    pending: false,
    actions: state.starterPrompts.slice(0, 3)
  });
  state.canvasLayout = buildErrorCanvasLayout(message);
  scrollToBottom();
}

function finishQuery(requestId) {
  if (requestId !== state.activeRequestId) return;
  closeActiveStream();
  state.isQuerying = false;
}

function buildStreamUrl(question = '') {
  const url = new URL('/api/query/stream', window.location.origin);
  url.searchParams.set('question', question);
  if (state.sessionId) {
    url.searchParams.set('sessionId', state.sessionId);
  }
  return url.toString();
}

function runQuery(rawQuestion = '') {
  const question = String(rawQuestion || '').trim();
  if (!question || state.isQuerying) return;

  closeActiveStream();
  state.activeRequestId += 1;
  const requestId = state.activeRequestId;

  state.isQuerying = true;
  state.hasAskedQuestion = true;
  appendChatMessage('user', question);
  const assistantMessage = appendChatMessage('assistant', 'Connecting to the live stream...', {
    pending: true
  });

  elements.chatInput.value = '';
  resizeComposer();
  state.canvasLayout = buildSkeletonCanvasLayout(question);
  openCanvasOnMobile();
  scrollToBottom();

  const stream = new EventSource(buildStreamUrl(question));
  activeStream = stream;

  stream.addEventListener('status', (event) => {
    if (requestId !== state.activeRequestId) return;
    const payload = parseEventPayload(event);
    updatePendingAssistantMessage(assistantMessage.id, payload.message || 'Working on your question...');
  });

  stream.addEventListener('answer', (event) => {
    if (requestId !== state.activeRequestId) return;
    const payload = parseEventPayload(event);
    completeAssistantMessage(assistantMessage.id, payload);
  });

  stream.addEventListener('error', (event) => {
    if (requestId !== state.activeRequestId) return;
    const payload = parseEventPayload(event);
    if (Object.keys(payload).length) {
      failAssistantMessage(assistantMessage.id, payload);
      return;
    }

    failAssistantMessage(assistantMessage.id, {
      answer: 'The live stream was interrupted before the response completed.'
    });
    finishQuery(requestId);
  });

  stream.addEventListener('done', () => {
    if (requestId !== state.activeRequestId) return;
    finishQuery(requestId);
  });
}

function seedInitialChat() {
  if (toArray(state.chatHistory).length) return;
  appendChatMessage(
    'assistant',
    'Ask about a player, team, match, live score, or comparison and I will answer it here in the chat.',
    {
      actions: state.starterPrompts.slice(0, 4)
    }
  );
}

function handleChipClick(event) {
  const trigger = event.target.closest('.chip[data-question]');
  if (!trigger) return;
  event.preventDefault();
  const question = String(trigger.dataset.question || '').trim();
  if (!question) return;
  runQuery(question);
}

function bindUi() {
  elements.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runQuery(elements.chatInput.value);
  });

  elements.chatInput.addEventListener('input', () => {
    resizeComposer();
  });

  if (elements.mobileBack) {
    elements.mobileBack.addEventListener('click', () => {
      closeCanvasOnMobile();
    });
  }

  document.addEventListener('click', handleChipClick);
  window.addEventListener('resize', syncViewportMode);
}

async function bootstrapApp() {
  state.sessionId = getOrCreateSessionId();
  seedInitialChat();
  renderStarterDeck();
  renderConnectionStatus();
  renderComposerState();
  resizeComposer();
  setLandingCanvasIfIdle();
  ensureStatusPolling();

  await Promise.allSettled([refreshArchiveStatus(), refreshHomeData(), refreshLiveData()]);
  setLandingCanvasIfIdle();
}

subscribe('starterPrompts', () => renderStarterDeck());
subscribe('connectionStatus', () => {
  renderConnectionStatus();
  setLandingCanvasIfIdle();
});
subscribe('isQuerying', () => renderComposerState());
subscribe('homeData', () => setLandingCanvasIfIdle());
subscribe('liveData', () => setLandingCanvasIfIdle());

bindUi();
void bootstrapApp();
