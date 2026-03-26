# Cricket Stats AI Frontend

Premium split-pane cricket analytics UI built with plain HTML, CSS, and JavaScript.

## What This Repo Contains

- `index.html`: split-pane Omni-Channel Canvas shell
- `styles.css`: Stadium Night design system, glassmorphism, layout, and motion
- `script.js`: conversational query flow, dynamic stage rendering, and responsive state handling

## Current UX

- Fixed left command center with conversational chat controls
- Dynamic analytics canvas on the right that redraws from `/api/query` response types
- Stadium Night theme with Inter body copy and Oswald data headlines
- Skeleton loading state for the canvas while queries resolve
- Mobile bottom-sheet stage that slides over the chat after a query
- Follow-up action chips for rapid query chaining

## Backend Dependency

This frontend expects the backend API to be available on the same origin by default.

Main endpoints used:

- `GET /api/status`
- `GET /api/home`
- `POST /api/query`
- `GET /api/home`
- `GET /api/cricapi/live-scores`

## Local Run

This repo is static, but the intended local run path is through the backend server:

1. Start the backend from the backend repo.
2. Open `http://localhost:3000`.

If you want to serve the frontend separately, use any static server and point API requests to the backend host.

## Notes

- No frontend build step is required.
- No frontend build step is required.
- The right canvas is driven primarily from the `/api/query` payload `data.type` field.
- The current dynamic stage handles `player_stats`, `team_stats`, `compare_players`, `match_summary`, `head_to_head`, `top_players`, and `live_update`.
