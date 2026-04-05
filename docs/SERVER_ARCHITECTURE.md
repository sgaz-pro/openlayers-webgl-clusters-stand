# Server Architecture

## Goal

`packages/server` is a lightweight Node.js HTTP service that returns deterministic synthetic geodata for frontend experiments.

## File map

- `src/index.ts`: server startup, route handling, host/port binding
- `src/config.ts`: defaults such as port, query defaults, count limits
- `src/http/respond.ts`: JSON and streamed JSON helpers
- `src/generators/prng.ts`: deterministic pseudo-random source
- `src/generators/syntheticDataset.ts`: synthetic point generation

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

## Important invariants

- keep the server dependency-light
- keep dataset generation deterministic for the same `seed`
- keep response shape aligned with `shared/points.ts`
- avoid hidden backend complexity or persistent storage

## Where to edit common behaviors

To add a new generation mode:

- `src/generators/syntheticDataset.ts`
- `src/config.ts`
- `shared/points.ts`

To change count limits or defaults:

- `src/config.ts`

To change output structure:

- `shared/points.ts`
- client parsing and worker flow in `packages/app`

