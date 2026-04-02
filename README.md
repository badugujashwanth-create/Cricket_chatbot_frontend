# Cricket Chat Bot Frontend

Plain HTML, CSS, and browser-hosted React frontend for the Cricket Chat Bot experience. The UI is a centered single-column chat surface that turns natural-language questions into one structured cricket response block.

## What This Frontend Does

- Provides a chat-driven interface for cricket questions
- Renders one structured response card inside the chat thread
- Supports player, team, match, comparison, record, squad, and playing-XI responses
- Uses zero build tooling and runs directly in the browser through CDN-hosted React

## File Layout

- `index.html`: app shell, layout regions, and semantic containers
- `styles.css`: dark cricket UI theme and responsive layout
- `app.jsx`: root app bootstrap
- `components/`: Header, chat window, and input components
- `pages/Home.jsx`: query flow and application state

## UI Model

The UI renders one chat thread. Each assistant reply is shown as a single structured response card driven by the backend payload type.

## Backend Dependency

This frontend is not standalone by default. It expects the backend to be available on the same origin, usually because the backend serves these static files directly.

Primary endpoints used by the UI:

- `GET /api/status`
- `GET /api/home`
- `GET /api/cricapi/live-scores?limit=4&includeRecent=true`
- `POST /api/query`

The UI renders Wikipedia-backed player and team images when the backend provides them.

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

1. On load, the UI renders the assistant welcome state.
2. When the user submits a question, the frontend posts it to `/api/query`.
3. The assistant inserts one structured response block into the chat thread.

## UX Features

- Auto-growing message composer
- Single-card assistant responses
- Inline squad and playing-XI grids
- Wikipedia-backed images and descriptions in the response card

## Design Direction

The current UI uses a minimal dark cricket dashboard style with one professional response card per answer.

## No Build Step

This repository intentionally avoids bundlers and frameworks.

- No npm install is required for the frontend itself
- No transpilation build step is required
- The browser loads `index.html`, `styles.css`, and the JSX files directly through Babel standalone

## Development Notes

- The frontend assumes backend JSON responses return stable `type`, `title`, `summary`, `stats`, and `extra` fields.
- Squad cards read `extra.players` and render them inline in the same response block.

## Example Queries

- `Virat Kohli stats`
- `Compare Virat Kohli vs Rohit Sharma`
- `India team stats in ODI`
- `Summarize the latest match`
- `Show recent live scores`
- `Top run scorers in 2024`

## Repository Scope

This frontend repository is published separately from the backend repository. It is designed to pair with the backend service, but the frontend git history remains independent.
