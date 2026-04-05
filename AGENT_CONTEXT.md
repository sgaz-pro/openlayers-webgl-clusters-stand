# Agent Context

This file is a compact orientation map for future work on the repo.
It is intentionally shorter and more task-focused than `README.md`.

## Purpose

The project is a TypeScript monorepo demo for exploring large point datasets on an OpenLayers map.

Core idea:

- server generates deterministic synthetic geodata
- app downloads one large JSON payload with progress
- app transfers the downloaded JSON buffer into a Web Worker
- worker parses JSON and builds the `supercluster` index off-thread
- map re-queries clusters only on `moveend`

## Top-level map

- `shared/points.ts`: API and dataset contracts
- `shared/worker.ts`: worker RPC contracts
- `packages/server`: HTTP API and synthetic dataset generator
- `packages/app`: React UI, MobX stores, OpenLayers map, worker client

## Most important entry points

- `packages/server/src/index.ts`: server boot, host/port, route handling
- `packages/server/src/generators/syntheticDataset.ts`: synthetic point generation
- `packages/app/src/app/App.tsx`: main UI shell
- `packages/app/src/components/ConnectionPanel.tsx`: controlled startup form
- `packages/app/src/components/MapView.tsx`: OpenLayers map lifecycle and click-to-zoom
- `packages/app/src/stores/DatasetStore.ts`: load phases and progress
- `packages/app/src/stores/ClusterStore.ts`: worker RPC and visible cluster state
- `packages/app/src/workers/supercluster.worker.ts`: off-thread cluster index

## Current runtime behavior

- App startup is manual, not automatic.
- User enters `Количество observable`, chooses dataset type, and clicks `Подключиться`.
- Loading phases are: `idle`, `downloading`, `parsing`, `indexing`, `ready`, `error`.
- The app targets `0.0.0.0` for dev host binding.
- Supported dataset modes are `mixed` and `industrial`.

## Common change map

If you need to change dataset request parameters:

- `packages/app/src/components/ConnectionPanel.tsx`
- `packages/app/src/constants.ts`
- `packages/server/src/config.ts`

If you need to change loading/progress behavior:

- `packages/app/src/stores/DatasetStore.ts`
- `packages/app/src/api/downloadJsonBuffer.ts`
- `packages/app/src/workers/workerClient.ts`
- `shared/worker.ts`

If you need to change clustering behavior:

- `packages/app/src/constants.ts`
- `packages/app/src/stores/ClusterStore.ts`
- `packages/app/src/workers/supercluster.worker.ts`

If you need to change map rendering:

- `packages/app/src/components/MapView.tsx`
- `packages/app/src/map/layers.ts`
- `packages/app/src/map/featureFactories.ts`

If you need to change server-side data realism:

- `packages/server/src/generators/syntheticDataset.ts`
- `packages/server/src/generators/industrialNames.ts`
- `packages/server/src/generators/prng.ts`

## Constraints worth preserving

- do not use `deck.gl`
- do not patch OpenLayers internals unless truly necessary
- do not render labels for all points at once
- keep `supercluster` indexing in a Web Worker
- keep cluster refresh on `moveend`, not per frame

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
