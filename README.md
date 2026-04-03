# OpenLayers Large Cluster Demo

Monorepo demo on TypeScript with two workspace packages:

- `app`: React + Vite + MobX + OpenLayers + `supercluster`
- `server`: Node.js HTTP server with deterministic synthetic geodata generation

The demo loads a large dataset with one `GET` request, shows download progress, parses JSON on the main thread, builds the `supercluster` index in a Web Worker, and re-queries visible clusters only on `moveend`.

## Stack

- React 18 + TypeScript + Vite
- MobX + `mobx-react-lite`
- OpenLayers 10
- `supercluster`
- Node.js HTTP server on TypeScript
- npm workspaces

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

- Node.js 20+
- npm 10+

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

Each point contains:

- `id`
- `lon`
- `lat`
- `name`
- `category`
- `weight`

The server builds the response in memory and streams JSON in chunks with `Content-Length`, so the client can display real progress for a single request.

## App architecture

### Shared contracts

- [`shared/points.ts`](/home/supeternity/src/openlayers-largecluster-demo/shared/points.ts): API and dataset types
- [`shared/worker.ts`](/home/supeternity/src/openlayers-largecluster-demo/shared/worker.ts): worker request/response protocol

### MobX stores

- [`packages/app/src/stores/DatasetStore.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/app/src/stores/DatasetStore.ts): loading phases, progress, parse timing, error handling
- [`packages/app/src/stores/ClusterStore.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/app/src/stores/ClusterStore.ts): worker RPC, cluster queries, map statistics
- [`packages/app/src/stores/RootStore.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/app/src/stores/RootStore.ts): composition root for stores and React context

### Worker flow

1. `DatasetStore` downloads `/api/points` and updates progress.
2. The response text is parsed on the main thread during the `parsing` phase.
3. Parsed points are sent to [`packages/app/src/workers/supercluster.worker.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/app/src/workers/supercluster.worker.ts).
4. The worker builds a `supercluster` index and answers:
   `build-index`, `query-clusters`, `get-expansion-zoom`.
5. `ClusterStore` updates visible items and timings in MobX.

### Rendering strategy

- Base map: OSM tile layer in EPSG:3857
- Cluster and single-point rendering: WebGL points layer
- Text labels: separate `VectorLayer` only for visible leaf points on high zoom
- Cluster refresh: only on `moveend`
- Cluster click: `getClusterExpansionZoom()` in the worker, then view animation

This keeps the main thread focused on UI and OpenLayers rendering while the index stays off-thread.

## Debug panel

The UI exposes these stats:

- count loaded
- download progress
- parse duration
- index build duration
- last cluster query duration
- visible clusters
- visible leaf points
- rendered labels
- current zoom

## Notes for experiments

- Change dataset size with the request query in [`packages/app/src/constants.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/app/src/constants.ts).
- Tweak clustering radius and max zoom in the same constants file.
- Adjust label density in [`packages/app/src/map/featureFactories.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/app/src/map/featureFactories.ts).
- Extend synthetic generation modes in [`packages/server/src/generators/syntheticDataset.ts`](/home/supeternity/src/openlayers-largecluster-demo/packages/server/src/generators/syntheticDataset.ts).
