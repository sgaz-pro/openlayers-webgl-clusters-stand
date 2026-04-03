import type { ServerResponse } from 'node:http';

function baseHeaders(contentType: string, contentLength?: number): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  };

  if (typeof contentLength === 'number') {
    headers['Content-Length'] = String(contentLength);
  }

  return headers;
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, baseHeaders('application/json; charset=utf-8', Buffer.byteLength(body)));
  response.end(body);
}

export async function streamJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  chunkSize: number,
): Promise<void> {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, baseHeaders('application/json; charset=utf-8', Buffer.byteLength(body)));

  for (let index = 0; index < body.length; index += chunkSize) {
    const chunk = body.slice(index, index + chunkSize);
    const canContinue = response.write(chunk);

    if (!canContinue) {
      await new Promise<void>((resolve) => response.once('drain', resolve));
    } else {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  response.end();
}

