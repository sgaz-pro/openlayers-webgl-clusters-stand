# Server Architecture

## Goal

`packages/server` is a lightweight Node.js HTTP service that returns deterministic synthetic geodata for frontend experiments and can also emit a synthetic SSE stream of observable mutations.

## File map

- `src/index.ts`: server startup, route handling, host/port binding
- `src/config.ts`: defaults such as port, query defaults, count limits
- `src/http/respond.ts`: JSON and streamed JSON helpers
- `src/generators/prng.ts`: deterministic pseudo-random source
- `src/generators/syntheticDataset.ts`: synthetic point generation
- `src/sse/observableStream.ts`: synthetic live observable mutation stream

## Endpoints

### `GET /api/health`

Returns:

- `ok`
- `uptimeSeconds`
- `now`

### `GET /api/meta`

Returns:

- service name and version
- default query
- supported dataset modes

### `GET /api/points`

Query params:

- `count`
- `seed`
- `mode`

Returns:

- `meta`
- `points`

Each point has:

- `id`
- `lon`
- `lat`
- `name`
- `category`
- `weight`

### `GET /api/observable/stream`

Query params:

- `count`
- `seed`
- `mode`
- `sampleMaxCount`
- `sampleLongTimeMs`
- `sampleBetweenDelayMs`

Returns:

- SSE stream with a single event type: `observable`

Each event body has:

- `insert: ObservableData[]`
- `update: ObservableData[]`
- `delete: { id: string }[]`

## Synthetic distribution model

The `mixed` mode currently combines:

- dense urban centers
- sparse geographic regions
- corridor-like linear distributions
- random noise

This creates a dataset that clusters in visually interesting ways while still spreading globally.

## Response behavior

- The server builds the response in memory.
- It streams JSON in chunks with `Content-Length`.
- This allows the client to show byte progress for a single GET request.
- The SSE endpoint seeds a deterministic in-memory observable map from the same dataset query and then emits synthetic mutation batches over time.

## Important invariants

- keep the server dependency-light
- keep dataset generation deterministic for the same `seed`
- keep response shape aligned with `shared/points.ts`
- keep SSE payload shape aligned with `shared/points.ts`
- avoid hidden backend complexity or persistent storage

## Where to edit common behaviors

To add a new generation mode:

- `src/generators/syntheticDataset.ts`
- `src/config.ts`
- `shared/points.ts`

To change count limits or defaults:

- `src/config.ts`

To change SSE stream cadence or sampling defaults:

- `src/config.ts`
- `src/sse/observableStream.ts`
- `shared/points.ts`

To change output structure:

- `shared/points.ts`
- client parsing and worker flow in `packages/app`
