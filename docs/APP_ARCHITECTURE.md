# App Architecture

## Goal

`packages/app` is a React + Vite client that visualizes large point datasets on an OpenLayers map with controlled startup and off-thread clustering.

## File map

- `src/app/App.tsx`: fullscreen map shell and overlay control panel
- `src/components/ConnectionPanel.tsx`: server/connection section and manual connect form with native controls
- `src/components/DisplayPanel.tsx`: cluster settings form and apply action
- `src/components/MetricsPanel.tsx`: runtime metrics section
- `src/components/SelectedObservablePanel.tsx`: selected marker info and clear-selection action
- `src/components/MapView.tsx`: map creation, `moveend` refresh, cluster click behavior and marker selection
- `src/models/ObservableModel.ts`: leaf marker model that combines icon data, label text and selection state
- `src/stores/RootStore.ts`: store composition and React context
- `src/stores/DatasetStore.ts`: dataset loading state machine
- `src/stores/HealthStore.ts`: health check status for `/api/health`
- `src/stores/ClusterStore.ts`: worker-backed cluster state and selected observable state
- `src/api/downloadJsonBuffer.ts`: streamed fetch with progress tracking and buffer handoff
- `src/api/fetchHealth.ts`: health endpoint request helper
- `src/workers/workerClient.ts`: request/response wrapper for the worker
- `src/workers/supercluster.worker.ts`: `supercluster` index build and query logic
- `src/map/layers.ts`: cluster layer and combined observable vector layer
- `src/map/icons.ts`: SVG data-url catalog for point categories
- `src/map/featureFactories.ts`: feature conversion for clusters and observables

## Current UI flow

1. App opens on a fullscreen map with an overlay control panel.
2. `HealthStore` requests `/api/health` on mount and can refresh it manually.
3. The first panel section shows the currently selected observable and lets the user clear selection.
4. User enters observable count in `ConnectionPanel`.
5. User chooses `mixed`, `industrial` or `coincident`.
6. User clicks `Подключиться`.
7. `DatasetStore.loadDataset()` requests `/api/points`.
8. Download progress updates while bytes stream in.
9. The downloaded `ArrayBuffer` is transferred into the worker.
10. The worker decodes JSON, parses it, and then builds the `supercluster` index.
11. `ClusterStore` becomes ready and the current map extent is queried.
12. User can adjust cluster settings in `DisplayPanel` and apply them without re-fetching the dataset.
13. Map updates cluster circles and combined observable markers.
14. Clicking an observable icon or label selects the first hit feature at that pixel, bolds its label, and mutes other visible labels until selection is cleared.

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
- queries clusters for current bbox/zoom
- compresses cluster query zoom near the maximum view zoom so dense areas reveal mostly on the last two zoom levels
- derives `ObservableModel[]` for visible leaf points
- keeps the currently selected observable in sync with visible results
- exposes visible item counts and timings
- resolves `getClusterExpansionZoom()`

## Rendering strategy

- base map: OSM tile layer
- projection: EPSG:3857 on the map, lon/lat in data contracts
- clusters: WebGL layer
- leaf points: one `VectorLayer` per visible observable, combining category-specific SVG icon and text label in the same feature style
- selection: selected label becomes bold, other visible labels become semi-transparent, empty-map click restores default label styles
- same-coordinate leaves currently have no local expansion or cycle-selection logic; they simply overlap, and selection uses the first hit feature returned by OpenLayers
- at maximum zoom, the cluster query bbox is padded so near-edge labels stay visible a little longer
- cluster tuning controls expose `radius`, `minZoom`, `maxZoom`, `minPoints`, `extent`, `nodeSize` and `denseRevealViewZoom`

## Important invariants

- no automatic dataset loading on app mount
- lightweight automatic health check on app mount is allowed
- no cluster re-query on every animation frame
- no labels for the entire dataset at once; labels should stay scoped to visible leaf points
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
