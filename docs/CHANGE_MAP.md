# Change Map

This file is optimized for "where should I edit?" questions.

## UI and startup

Manual connect form:

- `packages/app/src/components/ConnectionPanel.tsx`

Top page copy/layout:

- `packages/app/src/app/App.tsx`
- `packages/app/src/app/App.css`
- `packages/app/src/components/SelectedObservablePanel.tsx`

Debug stats panel:

- `packages/app/src/components/MetricsPanel.tsx`

SSE controls and live stream UX:

- `packages/app/src/components/ConnectionPanel.tsx`
- `packages/app/src/stores/ObservableStreamStore.ts`
- `packages/app/src/stores/ObservableAnimationStore.ts`

## Loading and progress

Phase state machine:

- `packages/app/src/stores/DatasetStore.ts`

Byte progress implementation:

- `packages/app/src/api/downloadJsonBuffer.ts`

Worker-side parse/index handoff:

- `packages/app/src/workers/workerClient.ts`
- `packages/app/src/workers/supercluster.worker.ts`
- `shared/worker.ts`

Live mutation batching and batched index flush:

- `packages/app/src/stores/ObservableStreamStore.ts`
- `packages/app/src/stores/ClusterStore.ts`
- `packages/app/src/workers/workerClient.ts`
- `packages/app/src/workers/supercluster.worker.ts`
- `shared/worker.ts`

Shared request defaults:

- `packages/app/src/constants.ts`
- `packages/server/src/config.ts`

## Map and clustering

Map lifecycle and interactions:

- `packages/app/src/components/MapView.tsx`
- `packages/app/src/stores/ClusterStore.ts`
- `packages/app/src/models/ObservableModel.ts`

Visible leaf animation and latest-wins retargeting:

- `packages/app/src/stores/ObservableAnimationStore.ts`
- `packages/app/src/stores/ClusterStore.ts`
- `packages/app/src/models/ObservableModel.ts`

Worker RPC:

- `packages/app/src/workers/workerClient.ts`
- `packages/app/src/workers/supercluster.worker.ts`
- `shared/worker.ts`

Cluster query state:

- `packages/app/src/stores/ClusterStore.ts`

Feature creation:

- `packages/app/src/map/featureFactories.ts`
- `packages/app/src/models/ObservableModel.ts`

Layer styling:

- `packages/app/src/map/layers.ts`

Selected observable panel:

- `packages/app/src/components/SelectedObservablePanel.tsx`
- `packages/app/src/stores/ClusterStore.ts`

## Server and data

Route handling:

- `packages/server/src/index.ts`

SSE stream generation:

- `packages/server/src/index.ts`
- `packages/server/src/config.ts`
- `packages/server/src/sse/observableStream.ts`

Synthetic data realism:

- `packages/server/src/generators/syntheticDataset.ts`
- `packages/server/src/generators/prng.ts`

Shared point contracts:

- `shared/points.ts`

Shared worker/live contracts:

- `shared/worker.ts`

## If you want to reduce future context cost

The most useful additions are not long docs, but stable facts:

- business intent and future roadmap
- non-obvious constraints
- naming conventions
- accepted tradeoffs
- "do not break" behaviors
- preferred files/patterns for new features

Short, curated notes beat large prose documents.
