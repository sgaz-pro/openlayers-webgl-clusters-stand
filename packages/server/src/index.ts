import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { parse } from 'node:url';
import type { DatasetMode, DatasetQuery, HealthApiResponse } from '../../../shared/points.js';
import {
  DEFAULT_PORT,
  DEFAULT_QUERY,
  MAX_COUNT,
  META_RESPONSE,
  STREAM_CHUNK_SIZE,
  SUPPORTED_MODES,
} from './config.js';
import { generatePointsDataset } from './generators/syntheticDataset.js';
import { sendJson, streamJson } from './http/respond.js';

function parseInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMode(value: string | null): DatasetMode {
  if (value && SUPPORTED_MODES.includes(value as DatasetMode)) {
    return value as DatasetMode;
  }

  return DEFAULT_QUERY.mode;
}

function parseDatasetQuery(request: IncomingMessage): DatasetQuery {
  const { query } = parse(request.url ?? '', true);
  const count = Math.max(1, Math.min(MAX_COUNT, parseInteger(asString(query.count), DEFAULT_QUERY.count)));
  const seed = parseInteger(asString(query.seed), DEFAULT_QUERY.seed);
  const mode = parseMode(asString(query.mode));

  return { count, seed, mode };
}

function asString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) ? value[0] ?? null : null;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const payload: HealthApiResponse = {
      ok: true,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      now: new Date().toISOString(),
    };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/meta') {
    sendJson(response, 200, META_RESPONSE);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/points') {
    const query = parseDatasetQuery(request);
    const dataset = generatePointsDataset(query);
    await streamJson(response, 200, dataset, STREAM_CHUNK_SIZE);
    return;
  }

  sendJson(response, 404, {
    error: 'Not found',
    path: url.pathname,
  });
}

const port = Number(process.env.PORT ?? DEFAULT_PORT);

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    sendJson(response, 500, { error: message });
  });
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
