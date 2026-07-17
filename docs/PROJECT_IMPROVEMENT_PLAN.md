# Project Improvement Plan

## Current state

This is the working web client for the stronger Cricket API. It builds and has a verified video, but had no automated tests at baseline and should not be marketed as an independent flagship.

## Findings

- **Works:** query/response workflow, presentable UI, production build, backend integration contract, and demo.
- **Does not / missing:** automated browser tests, evidence-focused rendering for every answer type, and robust offline/back-end unavailable recovery.
- **UX / architecture:** loading/error states exist but need regression checks; the repository's technical depth is mainly in the API.
- **Testing / security:** no baseline test suite; browser environment values must stay non-secret.
- **Performance / docs / demo:** bundle/build are acceptable; video remains dependent on representative backend data.

## Recommendations

### Critical

- Keep backend-unavailable and unsupported-query states clear and recoverable.
- Present this repository only as part of the combined Cricket system.

### High value

- Add one browser smoke test across question, loading, grounded answer/evidence, and failure.
- Add accessible live-region behavior for asynchronous responses.

### Optional

- Add saved example queries without collecting personal usage data.

## Delivery constraints

- **Priority:** integration reliability; **complexity:** small; **dependencies:** Cricket API or deterministic test fixture.
- **Acceptance:** build and smoke workflow pass, errors are recoverable, and answer evidence remains visible.
- **Excluded:** duplicating API logic and presenting UI-only work as a separate flagship.
