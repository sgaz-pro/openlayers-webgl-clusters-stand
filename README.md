# OpenLayers Large Cluster Demo

Monorepo demo on TypeScript with two workspace packages:

- `app`: React + Vite + MobX + OpenLayers + `supercluster`
- `server`: Node.js HTTP server with deterministic synthetic geodata generation

The demo loads a large dataset with one `GET` request, shows download progress, transfers the downloaded JSON buffer into a Web Worker, parses and indexes it off-thread, and re-queries visible clusters only on `moveend`.

## Stack

- React 18 + TypeScript + Vite
- MobX + `mobx-react-lite`
- OpenLayers 10
- `supercluster`
- Node.js HTTP server on TypeScript
- npm workspaces

## Extra docs

- [`AGENT_CONTEXT.md`](./AGENT_CONTEXT.md): fast project orientation
- [`docs/APP_ARCHITECTURE.md`](./docs/APP_ARCHITECTURE.md): frontend structure and runtime flow
- [`docs/SERVER_ARCHITECTURE.md`](./docs/SERVER_ARCHITECTURE.md): backend structure and API notes
- [`docs/CHANGE_MAP.md`](./docs/CHANGE_MAP.md): where to edit common behaviors

## Workspace layout

```text
.
├── package.json
├── shared
│   ├── points.ts
│   └── worker.ts
├── packages
│   ├── app
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src
│   │       ├── api
│   │       ├── app
│   │       ├── components
│   │       ├── map
│   │       ├── stores
│   │       └── workers
│   └── server
│       ├── package.json
│       └── src
│           ├── generators
│           ├── http
│           └── index.ts
└── tsconfig.base.json
```

## Run

Requirements:

- Node.js 24.x
- npm 11.x

Install dependencies:

```bash
npm install
```

Run the server:

```bash
npm run dev:server
```

Run the app in another terminal:

```bash
npm run dev:app
```

Open `http://localhost:5173`.

Production build:

```bash
npm run build
```

## Server API

### `GET /api/health`

Returns a simple liveness payload.

### `GET /api/meta`

Returns server metadata and default dataset query.

### `GET /api/points?count=100000&seed=42&mode=mixed`

Returns deterministic synthetic points:

- dense urban clusters around several cities
- sparse geographic regions
- corridor-like linear distributions
- random noise

### `GET /api/points?count=100000&seed=42&mode=industrial`

Returns a concentrated industrial dataset around a large petrochemical complex:

- dense process-unit clusters
- service corridors and pipe-rack lines
- storage, logistics, maintenance, safety and laboratory points
- long engineering-style observable names generated with `faker`

Each point contains:

- `id`
- `lon`
- `lat`
- `name`
- `category`
- `weight`

The server builds the response in memory and streams JSON in chunks with `Content-Length`, so the client can display real progress for a single request.
For `GET /api/points`, the server also honors `Accept-Encoding` and prefers `br`, then `gzip`, then identity.
When compression is used, the server also sends `X-Uncompressed-Content-Length` so the browser client can show progress against the decoded JSON size instead of the compressed transfer size.
Responses include `Vary: Accept-Encoding`, and unsupported-only encoding requests return `406 Not Acceptable`.

## App architecture

### Shared contracts

- [`shared/points.ts`](./shared/points.ts): API and dataset types
- [`shared/worker.ts`](./shared/worker.ts): worker request/response protocol

### MobX stores

- [`packages/app/src/stores/DatasetStore.ts`](./packages/app/src/stores/DatasetStore.ts): loading phases, progress, parse timing, error handling
- [`packages/app/src/stores/ClusterStore.ts`](./packages/app/src/stores/ClusterStore.ts): worker RPC, cluster queries, map statistics and applied cluster settings
- [`packages/app/src/stores/RootStore.ts`](./packages/app/src/stores/RootStore.ts): composition root for stores and React context

### Worker flow

1. `DatasetStore` downloads `/api/points` and updates progress.
2. The downloaded JSON buffer is transferred to [`packages/app/src/workers/supercluster.worker.ts`](./packages/app/src/workers/supercluster.worker.ts).
3. The worker decodes, parses, and indexes the payload while `DatasetStore` moves from `parsing` to `indexing`.
4. The worker answers `build-index`, `rebuild-index`, `query-clusters` and `get-expansion-zoom`.
5. `ClusterStore` updates visible items and timings in MobX and can rebuild the index when cluster settings change.

### Rendering strategy

- Base map: OSM tile layer in EPSG:3857
- Clusters: WebGL circles
- Single points: category-based SVG icons
- Text labels: separate `VectorLayer` for visible leaf points, rendered to the right of the icon
- Cluster refresh: only on `moveend`
- Cluster click: `getClusterExpansionZoom()` in the worker, then view animation

This keeps the main thread focused on UI and OpenLayers rendering while the index stays off-thread.

### Startup controls

- The app starts in `idle`.
- User chooses observable count and dataset type in the connection form.
- Supported dataset types are `mixed` and `industrial`.

## Debug panel

The UI exposes these stats:

- count loaded
- download progress
- download duration
- parse duration
- index build duration
- last cluster query duration
- visible clusters
- visible leaf points
- rendered labels
- current zoom

## Notes for experiments

- Change dataset size defaults in [`packages/app/src/constants.ts`](./packages/app/src/constants.ts).
- Tweak cluster behavior live in the `Параметры отображения` panel, or change defaults in [`packages/app/src/constants.ts`](./packages/app/src/constants.ts).
- Adjust label generation in [`packages/app/src/map/featureFactories.ts`](./packages/app/src/map/featureFactories.ts).
- Extend synthetic generation modes in [`packages/server/src/generators/syntheticDataset.ts`](./packages/server/src/generators/syntheticDataset.ts).
