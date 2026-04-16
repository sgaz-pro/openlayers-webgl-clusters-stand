# App Architecture

## Goal

`packages/app` is a React + Vite client that visualizes large point datasets on an OpenLayers map with controlled startup, off-thread clustering and SSE-driven live observable updates.

## File map

- `src/app/App.tsx`: fullscreen map shell and overlay control panel
- `src/components/ConnectionPanel.tsx`: server/connection section and manual connect form with native controls
- `src/components/DisplayPanel.tsx`: cluster settings form and apply action
- `src/components/MetricsPanel.tsx`: runtime metrics section
- `src/components/SelectedObservablePanel.tsx`: selected marker info and clear-selection action
- `src/components/MapView.tsx`: map creation, `moveend` refresh, cluster click behavior and marker selection
- `src/models/ObservableModel.ts`: leaf marker model that owns its OpenLayers feature, label text and selection state
- `src/stores/RootStore.ts`: store composition and React context
- `src/stores/DatasetStore.ts`: dataset loading state machine
- `src/stores/HealthStore.ts`: health check status for `/api/health`
- `src/stores/ClusterStore.ts`: worker-backed cluster state, visible observable reconciliation and selected observable state
- `src/stores/ObservableStreamStore.ts`: SSE connection lifecycle, local stream ordering and index flush scheduling
- `src/stores/ObservableAnimationStore.ts`: visible-leaf motion registry and latest-wins retargeting
- `src/api/downloadJsonBuffer.ts`: streamed fetch with progress tracking and buffer handoff
- `src/api/fetchHealth.ts`: health endpoint request helper
- `src/workers/workerClient.ts`: request/response wrapper for the worker
- `src/workers/supercluster.worker.ts`: canonical observable map, batched `supercluster` index build and query logic
- `src/map/layers.ts`: cluster layer and combined observable vector layer
- `src/map/icons.ts`: SVG data-url catalog for point categories
- `src/map/featureFactories.ts`: cluster feature conversion and thin observable feature adapter

## Current UI flow

1. App opens on a fullscreen map with an overlay control panel.
2. `HealthStore` requests `/api/health` on mount and can refresh it manually.
3. The first panel section shows the currently selected observable and lets the user clear selection.
4. User enters observable count in `ConnectionPanel`.
5. User chooses `mixed`, `industrial` or `coincident`.
6. User clicks `Инициализировать Observable`.
7. `DatasetStore.loadDataset()` requests `/api/points`.
8. Download progress updates while bytes stream in.
9. The downloaded `ArrayBuffer` is transferred into the worker.
10. The worker decodes JSON, parses it, and then builds the `supercluster` index.
11. `ClusterStore` becomes ready and the current map extent is queried.
12. User can optionally configure SSE sample controls and start the live observable stream.
13. Incoming SSE `observable` events apply `{ insert, update, delete }` mutations with local `latest wins` ordering per `observable.id`.
14. Visible leaf observables animate on the main thread only while they remain visible leaves.
15. Worker-side `supercluster` rebuild is batched and flushed after live mutations instead of rebuilding for every SSE event.
16. User can adjust cluster settings in `DisplayPanel` and apply them without re-fetching the dataset.
17. Map updates cluster circles and combined observable markers.
18. Clicking an observable icon or label selects the first hit feature at that pixel, bolds its label, and mutes other visible labels until selection is cleared.

## Store responsibilities

### `DatasetStore`

- owns loading phase
- owns request query
- tracks byte progress
- tracks download duration for the progress UI
- prefers `X-Uncompressed-Content-Length` for progress totals so browser-side decompression does not inflate the percentage
- tracks parse duration
- hands the raw response buffer to the worker
- resets cluster state before a new load
- stops active SSE streaming before a fresh dataset initialization

### `HealthStore`

- owns `/api/health` polling state
- tracks server clock and uptime
- tracks last measured latency
- exposes manual refresh semantics for the connection panel

### `ClusterStore`

- owns worker instance
- builds the index from a transferred JSON buffer
- stores the currently applied cluster/display settings
- can rebuild the worker index from cached worker-side features when settings change
- applies SSE mutation batches into the worker canonical state
- flushes the worker index after batched live mutations
- queries clusters for current bbox/zoom
- compresses cluster query zoom near the maximum view zoom so dense areas reveal mostly on the last two zoom levels
- derives `ObservableModel[]` for visible leaf points and reuses them by `observable.id`
- keeps the currently selected observable in sync with visible results
- applies selection style updates on existing observable features without rebuilding the observable source
- exposes visible item counts and timings
- resolves `getClusterExpansionZoom()`

### `ObservableStreamStore`

- owns `EventSource` lifecycle for `/api/observable/stream`
- stores SSE control settings from the connection panel
- assigns local stream sequence numbers to keep per-session `latest wins` semantics
- normalizes one incoming `observable` event into `{ insert, update, delete }`
- schedules batched worker index flushes, typically with delay while live animation is active

### `ObservableAnimationStore`

- owns active visible-leaf animations keyed by stable `observable.id`
- retargets an in-flight animation when a newer update for the same `id` arrives
- reattaches motion to a reused `ObservableModel` when `queryClusters` shows the same leaf again after `pan/zoom`
- updates OpenLayers features on `requestAnimationFrame` without triggering full cluster re-query

## Rendering strategy

- base map: OSM tile layer
- projection: EPSG:3857 on the map, lon/lat in data contracts
- clusters: WebGL layer
- leaf points: one `VectorLayer` for visible observables, where each `ObservableModel` owns the `Feature` used by the layer and combines category-specific SVG icon with text label in the same style function
- selection: selected label becomes bold, other visible labels become semi-transparent, empty-map click restores default label styles
- same-coordinate leaves currently have no local expansion or cycle-selection logic; they simply overlap, and selection uses the first hit feature returned by OpenLayers
- selection-style updates call `feature.changed()` on existing leaf features, so the observable source only rebuilds when the visible set itself changes
- live movement is applied only to visible leaves, while the worker retains canonical latest observable data for future queries
- at maximum zoom, the cluster query bbox is padded so near-edge labels stay visible a little longer
- cluster tuning controls expose `radius`, `minZoom`, `maxZoom`, `minPoints`, `extent`, `nodeSize` and `denseRevealViewZoom`

## Important invariants

- no automatic dataset loading on app mount
- lightweight automatic health check on app mount is allowed
- no cluster re-query on every animation frame
- no labels for the entire dataset at once; labels should stay scoped to visible leaf points
- no `supercluster` rebuild on every SSE update; live index refresh must stay batched
- visible-leaf motion must be keyed by stable `observable.id` and follow `latest wins` semantics within one SSE session
- map interaction should remain responsive during indexing
- the control panel should remain an overlay over the map, not a sibling layout column

## Where to edit common behaviors

To change startup UX:

- `src/components/ConnectionPanel.tsx`
- `src/app/App.tsx`
- `src/app/App.css`
- `src/components/SelectedObservablePanel.tsx`

To change health check behavior:

- `src/stores/HealthStore.ts`
- `src/api/fetchHealth.ts`
- `src/components/ConnectionPanel.tsx`

To change loading phases or progress semantics:

- `src/stores/DatasetStore.ts`
- `src/api/downloadJsonBuffer.ts`

To change SSE controls, stream lifecycle or live update semantics:

- `src/components/ConnectionPanel.tsx`
- `src/stores/ObservableStreamStore.ts`
- `src/stores/ObservableAnimationStore.ts`
- `src/stores/ClusterStore.ts`
- `src/workers/workerClient.ts`
- `src/workers/supercluster.worker.ts`
- `../../shared/points.ts`
- `../../shared/worker.ts`

To change map click behavior:

- `src/components/MapView.tsx`
- `src/stores/ClusterStore.ts`
- `src/models/ObservableModel.ts`

To change worker parsing/index build behavior:

- `src/workers/workerClient.ts`
- `src/workers/supercluster.worker.ts`
- `../../shared/worker.ts`

To change cluster settings UI or defaults:

- `src/components/DisplayPanel.tsx`
- `src/constants.ts`
- `src/stores/ClusterStore.ts`

To change cluster visuals:

- `src/map/layers.ts`
- `src/map/icons.ts`

To change point label generation:

- `src/models/ObservableModel.ts`
- `src/map/featureFactories.ts`
- `src/map/layers.ts`
