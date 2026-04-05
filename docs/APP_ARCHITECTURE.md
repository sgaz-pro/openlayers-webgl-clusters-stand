# App Architecture

## Goal

`packages/app` is a React + Vite client that visualizes large point datasets on an OpenLayers map with controlled startup and off-thread clustering.

## File map

- `src/app/App.tsx`: page layout and top-level composition
- `src/components/ConnectionPanel.tsx`: parameter panel and manual connect form
- `src/components/MapView.tsx`: map creation, `moveend` refresh, cluster click behavior
- `src/components/DebugPanel.tsx`: runtime metrics panel
- `src/stores/RootStore.ts`: store composition and React context
- `src/stores/DatasetStore.ts`: dataset loading state machine
- `src/stores/ClusterStore.ts`: worker-backed cluster state
- `src/api/downloadJsonText.ts`: streamed fetch with progress tracking
- `src/workers/workerClient.ts`: request/response wrapper for the worker
- `src/workers/supercluster.worker.ts`: `supercluster` index build and query logic
- `src/map/layers.ts`: WebGL points layer and label vector layer
- `src/map/featureFactories.ts`: feature conversion and label subset creation

## Current UI flow

1. App opens in `idle`.
2. User enters observable count in `ConnectionPanel`.
3. User clicks `Подключиться`.
4. `DatasetStore.loadDataset()` requests `/api/points`.
5. Download progress updates while bytes stream in.
6. JSON parsing happens on the main thread.
7. Parsed points go to the worker for indexing.
8. `ClusterStore` becomes ready and the current map extent is queried.
9. Map updates cluster/point WebGL rendering and optional labels.

## Store responsibilities

### `DatasetStore`

- owns loading phase
- owns request query
- tracks byte progress
- tracks parse duration
- resets cluster state before a new load

### `ClusterStore`

- owns worker instance
- builds the index
- queries clusters for current bbox/zoom
- exposes visible item counts and timings
- resolves `getClusterExpansionZoom()`

## Rendering strategy

- base map: OSM tile layer
- projection: EPSG:3857 on the map, lon/lat in data contracts
- clusters and leaf points: WebGL layer
- labels: separate `VectorLayer`
- labels only appear for leaf points at high zoom and are capped

## Important invariants

- no automatic dataset loading on app mount
- no cluster re-query on every animation frame
- no labels for every point
- map interaction should remain responsive during indexing

## Where to edit common behaviors

To change startup UX:

- `src/components/ConnectionPanel.tsx`
- `src/app/App.tsx`

To change loading phases or progress semantics:

- `src/stores/DatasetStore.ts`

To change map click behavior:

- `src/components/MapView.tsx`
- `src/stores/ClusterStore.ts`

To change cluster visuals:

- `src/map/layers.ts`

To change label thresholds or limits:

- `src/constants.ts`
- `src/map/featureFactories.ts`

