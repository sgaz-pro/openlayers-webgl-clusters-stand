# Agent Context

This file is a compact orientation map for future work on the repo.
It is intentionally shorter and more task-focused than `README.md`.

## Purpose

The project is a TypeScript monorepo demo for exploring large point datasets on an OpenLayers map.
The repo is currently standardized on Node.js 24 and npm 11 for local work and CI.

Core idea:

- server generates deterministic synthetic geodata
- app downloads one large JSON payload with progress
- app transfers the downloaded JSON buffer into a Web Worker
- worker parses JSON and builds the `supercluster` index off-thread
- map re-queries clusters only on `moveend`
- dataset download progress is based on decoded JSON bytes; server sends `X-Uncompressed-Content-Length` to avoid `>100%` progress with gzip/brotli
- app also tracks download duration and shows it alongside byte progress

## Top-level map

- `.github/workflows`: CI and scheduled security automation
- `.github/dependabot.yml`: dependency update cadence and grouping
- `shared/points.ts`: API and dataset contracts
- `shared/worker.ts`: worker RPC contracts
- `packages/server`: HTTP API and synthetic dataset generator
- `packages/app`: React UI, MobX stores, OpenLayers map, worker client

## Most important entry points

- `packages/server/src/index.ts`: server boot, host/port, route handling
- `packages/server/src/generators/syntheticDataset.ts`: synthetic point generation
- `packages/app/src/app/App.tsx`: fullscreen app shell with overlay control panel
- `packages/app/src/components/ConnectionPanel.tsx`: server/connection section with native form controls
- `packages/app/src/components/DisplayPanel.tsx`: cluster settings form and apply action
- `packages/app/src/components/MetricsPanel.tsx`: runtime metrics section
- `packages/app/src/components/SelectedObservablePanel.tsx`: selected marker details and clear-selection action
- `packages/app/src/components/MapView.tsx`: OpenLayers map lifecycle, cluster zoom and observable selection
- `packages/app/src/map/icons.ts`: SVG icon catalog for point categories
- `packages/app/src/models/ObservableModel.ts`: leaf marker model with icon/label state for a single visible point
- `packages/app/src/stores/DatasetStore.ts`: load phases and progress
- `packages/app/src/stores/HealthStore.ts`: `/api/health` status, latency and server clock
- `packages/app/src/stores/ClusterStore.ts`: worker RPC, visible cluster state and selected observable state
- `packages/app/src/workers/supercluster.worker.ts`: off-thread cluster index
- `.github/workflows/ci.yml`: typecheck and build on `push`/`pull_request`, server smoke test only on manual `workflow_dispatch`
- `.github/workflows/codeql.yml`: scheduled CodeQL scan for JS/TS

## Current runtime behavior

- App opens with a fullscreen map and a right overlay control panel.
- On mobile, the right panel is hidden behind a burger and slides over the map.
- The right panel contains four collapsible sections: selected observable, server/connection, cluster/display settings, metrics.
- The right panel starts with a "Выбранный Observable" section that shows the selected marker name and current lon/lat, plus a clear-selection button.
- App runs a health check on mount and can refresh it manually from the connection section.
- Dataset startup is still manual.
- User enters `Количество observable`, chooses dataset type, and clicks `Подключиться`.
- Loading phases are: `idle`, `downloading`, `parsing`, `indexing`, `ready`, `error`.
- The app targets `0.0.0.0` for dev host binding.
- Supported dataset modes are `mixed`, `industrial` and `coincident`.
- The client shell currently uses native browser controls and lightweight custom CSS.
- Clusters are rendered as circles, with orange styling when they contain stacked same-coordinate leaves.
- Visible leaf points are represented by `ObservableModel`: one feature now carries both the SVG icon and the text label.
- Same-coordinate leaf points are rendered without local expansion logic for now: icons and labels simply overlap on the same pixel.
- Clicking a leaf marker makes its label bold and mutes labels of other visible markers; clicking empty map space resets label styles to default.
- If several observables overlap at the clicked pixel, the app currently selects the first hit feature returned by OpenLayers.
- At maximum zoom, labels are intentionally allowed to overlap and the query bbox is padded so edge labels do not disappear too early.
- Cluster query zoom is intentionally compressed near the top of the zoom range so dense areas only fully раскрываются on the last two view zoom levels.
- The display section now exposes editable `supercluster` parameters plus `denseRevealViewZoom`, and applying them rebuilds the worker index without re-downloading the dataset.

## Common change map

If you need to change dataset request parameters:

- `packages/app/src/components/ConnectionPanel.tsx`
- `packages/app/src/constants.ts`
- `packages/server/src/config.ts`

If you need to change health check UX:

- `packages/app/src/stores/HealthStore.ts`
- `packages/app/src/api/fetchHealth.ts`
- `packages/app/src/components/ConnectionPanel.tsx`

If you need to change loading/progress behavior:

- `packages/app/src/stores/DatasetStore.ts`
- `packages/app/src/api/downloadJsonBuffer.ts`
- `packages/app/src/workers/workerClient.ts`
- `shared/worker.ts`

If you need to change clustering behavior:

- `packages/app/src/constants.ts`
- `packages/app/src/components/DisplayPanel.tsx`
- `packages/app/src/stores/ClusterStore.ts`
- `packages/app/src/workers/workerClient.ts`
- `packages/app/src/workers/supercluster.worker.ts`

If you need to change map rendering:

- `packages/app/src/components/MapView.tsx`
- `packages/app/src/map/layers.ts`
- `packages/app/src/map/featureFactories.ts`
- `packages/app/src/models/ObservableModel.ts`
- `packages/app/src/map/icons.ts`

If you need to change the overlay shell / right panel layout:

- `packages/app/src/app/App.tsx`
- `packages/app/src/app/App.css`
- `packages/app/src/components/SelectedObservablePanel.tsx`
- `packages/app/src/components/ConnectionPanel.tsx`
- `packages/app/src/components/DisplayPanel.tsx`
- `packages/app/src/components/MetricsPanel.tsx`

If you need to change repository automation:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/dependabot.yml`

If you need to change server-side data realism:

- `packages/server/src/generators/syntheticDataset.ts`
- `packages/server/src/generators/industrialNames.ts`
- `packages/server/src/generators/prng.ts`

## Constraints worth preserving

- do not use `deck.gl`
- do not patch OpenLayers internals unless truly necessary
- do not render labels for the entire dataset at once; keep labels scoped to visible points
- keep `supercluster` indexing in a Web Worker
- keep cluster refresh on `moveend`, not per frame
- keep the map as the primary fullscreen surface; the control panel should stay an overlay, not reflow the map

## Quick commands

```bash
npm install
npm run dev:server
npm run dev:app
npm run typecheck
npm run build
```

## Useful follow-up docs

- `docs/APP_ARCHITECTURE.md`
- `docs/SERVER_ARCHITECTURE.md`
- `docs/CHANGE_MAP.md`
