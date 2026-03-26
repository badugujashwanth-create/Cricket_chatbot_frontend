# Cricket Stats AI Frontend

Premium single-page cricket analytics UI built with plain HTML, CSS, and JavaScript.

## What This Repo Contains

- `index.html`: app shell and section layout
- `styles.css`: premium visual system, responsive layout, and component styling
- `script.js`: client-side state, search flows, rendering, and API integration

## Current UX

- Single scrolling dashboard instead of separate page transitions
- Premium visual styling with stronger typography and layered panels
- Large player profile view that opens automatically for strong player-name matches
- Match explorer, comparison panel, and AI chat in the same continuous interface

## Backend Dependency

This frontend expects the backend API to be available on the same origin by default.

Main endpoints used:

- `GET /api/status`
- `GET /api/home`
- `GET /api/options`
- `GET /api/players/search`
- `GET /api/players/:id`
- `GET /api/matches`
- `GET /api/matches/:id`
- `POST /api/query`
- `GET /api/query/stream`
- `GET /api/cricapi/live-scores`

## Local Run

This repo is static, but the intended local run path is through the backend server:

1. Start the backend from the backend repo.
2. Open `http://localhost:3000`.

If you want to serve the frontend separately, use any static server and point API requests to the backend host.

## Notes

- No frontend build step is required.
- Tailwind CDN is used only for utility classes already embedded in `index.html`.
- Player images and extra player metadata are hydrated from backend-provided profile data.
