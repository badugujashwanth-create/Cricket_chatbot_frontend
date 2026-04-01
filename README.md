# Cricket Chat Bot Frontend

Plain HTML, CSS, and JavaScript frontend for the Cricket Chat Bot experience. The UI is a split-pane cricket analytics canvas that turns natural-language questions into dynamic player, team, match, comparison, leaderboard, and live-update views.

## What This Frontend Does

- Provides a chat-driven interface for cricket questions
- Renders a dynamic analytics stage based on backend response types
- Shows archive readiness and boot state from the backend
- Surfaces live-score highlights from CricAPI-backed endpoints
- Supports desktop split-pane layout and mobile stage takeover behavior
- Uses zero build tooling and runs directly in the browser

## File Layout

- `index.html`: app shell, layout regions, and semantic containers
- `styles.css`: Stadium Night visual system, responsive layout, and motion
- `script.js`: API calls, chat flow, state management, and dynamic stage rendering

## UI Model

The interface is split into two primary zones:

- Left pane: chat controls, starter prompts, and conversation thread
- Right pane: analytics stage that rebuilds itself from the latest payload

The canvas renderer is driven by the backend response `data.type`. Current stage modes include:

- `player_stats`
- `team_stats`
- `compare_players`
- `match_summary`
- `head_to_head`
- `top_players`
- `live_update`
- fallback summary mode for any unrecognized payload

## Backend Dependency

This frontend is not standalone by default. It expects the backend to be available on the same origin, usually because the backend serves these static files directly.

Primary endpoints used by the UI:

- `GET /api/status`
- `GET /api/home`
- `GET /api/cricapi/live-scores?limit=4&includeRecent=true`
- `POST /api/query`

The UI also fetches player headshots from Wikipedia and falls back to generated avatars when no image is found.

## Local Run

### Recommended workflow

1. Start the backend from the backend repository.
2. Open `http://localhost:3000`.

Because the backend hosts the frontend, this is the intended development path.

### Static-only workflow

If you serve this frontend from a static server, the API requests still need a reachable backend. In that case you must either:

- serve the frontend from the same origin as the backend, or
- adjust the API request paths to point at the backend host

## Interaction Flow

1. On load, the UI renders a boot state and checks `GET /api/status`.
2. If the archive is ready, it loads the landing data from `/api/home`.
3. It also requests a small live-score strip from `/api/cricapi/live-scores`.
4. When the user submits a question, the frontend posts it to `/api/query`.
5. The assistant summary is inserted into the chat thread.
6. The stage renderer selects a dedicated layout based on `payload.data.type`.

## UX Features

- Starter prompt chips for quick exploration
- Auto-growing message composer
- Animated skeleton state while queries are resolving
- Structured stage layouts for different cricket intents
- Follow-up suggestion chips from backend suggestions or followups
- Mobile canvas mode with a stage-back control
- Status pill showing archive readiness and loading progress

## Design Direction

The current UI uses a broadcast-style visual system:

- Stadium Night theme
- bold analytics cards and signal rows
- conversational left rail with chip-based prompting
- motion-driven transitions for stage updates

## No Build Step

This repository intentionally avoids bundlers and frameworks.

- No npm install is required for the frontend itself
- No transpilation step is required
- The browser loads `index.html`, `styles.css`, and `script.js` directly

## Development Notes

- The frontend assumes backend JSON responses return stable `summary`, `data`, and suggestion fields.
- The canvas content is derived from normalized response objects rather than hard-coded routes.
- `script.js` uses a single shared state object to coordinate status polling, live cards, and active requests.
- On smaller screens, the analytics stage opens over the chat after a query is sent.

## Example Queries

- `Virat Kohli stats`
- `Compare Virat Kohli vs Rohit Sharma`
- `India team stats in ODI`
- `Summarize the latest match`
- `Show recent live scores`
- `Top run scorers in 2024`

## Repository Scope

This frontend repository is published separately from the backend repository. It is designed to pair with the backend service, but the frontend git history remains independent.
