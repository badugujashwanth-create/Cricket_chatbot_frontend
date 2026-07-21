# Cricket Intelligence Web

[![CI](https://github.com/badugujashwanth-create/cricket-chatbot-web/actions/workflows/ci.yml/badge.svg)](https://github.com/badugujashwanth-create/cricket-chatbot-web/actions/workflows/ci.yml)

React client for the dataset-grounded [Cricket Intelligence API](https://github.com/badugujashwanth-create/cricket-chatbot-api). It submits cricket questions, renders the API's typed evidence contract, and makes unavailable data visible instead of presenting unsupported statistics.

> Portfolio prototype. The verified local profile uses repository-curated data. It does not claim live scores, Cricbuzz connectivity, official rankings, exhaustive statistics, predictions, or production availability.

[![Open the current Cricket Intelligence case study](docs/demo/demo-thumbnail.png)](https://jashwanth-portfolio-ten.vercel.app/work/cricket-intelligence/)

[Current API walkthrough MP4](https://jashwanth-portfolio-ten.vercel.app/media/cricket-api/demo.mp4) · [Download WebM](https://jashwanth-portfolio-ten.vercel.app/media/cricket-api/demo.webm) · [Captions](https://jashwanth-portfolio-ten.vercel.app/media/cricket-api/demo-captions.vtt)

The older web-only recording remains in `docs/demo` as historical evidence but is not promoted as the current combined-product walkthrough.

## Verified workflow

1. Read API, archive, and optional-provider availability from `/api/status`.
2. Ask a guided repository-grounded question such as `What is LBW?`.
3. Inspect the evidence label and returned sources.
4. Ask an out-of-scope or unavailable-data question.
5. Receive a typed unavailable state without fabricated zero-value statistics.

The Socket.IO connection is an update channel only. A connected socket does not prove live cricket-provider data is available.

## Run locally

Requirements: Node.js 22+ and a running Cricket Intelligence API.

```powershell
npm ci
npm run dev
```

The development server opens on `http://127.0.0.1:5173` and proxies `/api` plus `/socket.io` to `http://127.0.0.1:3001` by default.

Optional overrides:

```dotenv
VITE_BACKEND_URL=http://127.0.0.1:3001
VITE_SOCKET_URL=http://127.0.0.1:3001
```

## Verification

```powershell
npm test
npm run build
npm audit
```

The browser suite covers the grounded answer, unavailable-data behavior, request errors, guided prompts, update-channel wording, mobile layout, and the absence of external runtime CDN dependencies.

## Product boundary

- The browser does not calculate cricket statistics.
- Evidence and availability come from the API response.
- Optional provider and archive capability is reported separately from socket connectivity.
- Missing archive data remains unavailable; the UI does not convert it into a verified zero.
- External providers, credentials, ingestion, authentication, and production hosting are outside this release.

## Release status

The v1.0.0 candidate includes the evidence-first client, local Tailwind build, production bundle, Playwright workflow checks, and a clean npm audit. Existing demo media predates this interface and is intentionally not claimed as current release evidence while the separate public-media reconciliation is open.

## License and support

No license is inferred. This repository is a portfolio prototype and provides no production, data-accuracy, availability, or support warranty.
