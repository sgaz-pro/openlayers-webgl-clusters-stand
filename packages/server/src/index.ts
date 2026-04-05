import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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
import { sendJson, sendJsonWithCompression } from './http/respond.js';

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

function parseDatasetQuery(url: URL): DatasetQuery {
  const count = Math.max(
    1,
    Math.min(MAX_COUNT, parseInteger(url.searchParams.get('count'), DEFAULT_QUERY.count)),
  );
  const seed = parseInteger(url.searchParams.get('seed'), DEFAULT_QUERY.seed);
  const mode = parseMode(url.searchParams.get('mode'));

  return {
    count,
    seed,
    mode,
  };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);

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
    const query = parseDatasetQuery(url);
    const dataset = generatePointsDataset(query);
    await sendJsonWithCompression(response, 200, dataset, {
      acceptEncoding: request.headers['accept-encoding'],
      chunkSize: STREAM_CHUNK_SIZE,
    });
    return;
  }

  sendJson(response, 404, {
    error: 'Not found',
    path: url.pathname,
  });
}

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const host = process.env.HOST ?? '0.0.0.0';

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    sendJson(response, 500, { error: message });
  });
});

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
