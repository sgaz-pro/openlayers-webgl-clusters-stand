import type { ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';

type CompressionEncoding = 'br' | 'gzip' | 'identity';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

interface HeaderBag {
  [key: string]: string;
}

interface JsonResponseOptions {
  acceptEncoding?: string | string[];
  chunkSize?: number;
}

const COMPRESSION_PREFERENCE: CompressionEncoding[] = ['br', 'gzip', 'identity'];

function normalizeHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(',');
  }

  return value ?? '';
}

function parseAcceptEncoding(headerValue: string): Map<string, number> {
  const result = new Map<string, number>();

  for (const part of headerValue.split(',')) {
    const [rawToken, ...parameterParts] = part.trim().toLowerCase().split(';');

    if (!rawToken) {
      continue;
    }

    let quality = 1;

    for (const parameterPart of parameterParts) {
      const [rawName, rawValue] = parameterPart.trim().split('=');

      if (rawName !== 'q' || !rawValue) {
        continue;
      }

      const parsedQuality = Number.parseFloat(rawValue);

      if (Number.isFinite(parsedQuality)) {
        quality = Math.max(0, Math.min(1, parsedQuality));
      }
    }

    const existingQuality = result.get(rawToken);
    result.set(rawToken, existingQuality === undefined ? quality : Math.max(existingQuality, quality));
  }

  return result;
}

function getEncodingQuality(encoding: CompressionEncoding, qualities: Map<string, number>): number {
  const wildcardQuality = qualities.get('*');

  if (encoding === 'identity') {
    return qualities.get('identity') ?? wildcardQuality ?? 1;
  }

  return qualities.get(encoding) ?? wildcardQuality ?? 0;
}

function selectCompressionEncoding(acceptEncoding: string | string[] | undefined): CompressionEncoding | null {
  const normalized = normalizeHeaderValue(acceptEncoding);

  if (!normalized.trim()) {
    return 'identity';
  }

  const qualities = parseAcceptEncoding(normalized);
  const rankedEncodings = COMPRESSION_PREFERENCE
    .map((encoding) => ({
      encoding,
      quality: getEncodingQuality(encoding, qualities),
    }))
    .sort((left, right) => {
      if (left.quality !== right.quality) {
        return right.quality - left.quality;
      }

      return COMPRESSION_PREFERENCE.indexOf(left.encoding) - COMPRESSION_PREFERENCE.indexOf(right.encoding);
    });

  const [bestMatch] = rankedEncodings;
  return bestMatch && bestMatch.quality > 0 ? bestMatch.encoding : null;
}

function baseHeaders(contentType: string, contentLength?: number, extraHeaders: HeaderBag = {}): HeaderBag {
  const headers: HeaderBag = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    ...extraHeaders,
  };

  if (typeof contentLength === 'number') {
    headers['Content-Length'] = String(contentLength);
  }

  return headers;
}

function toJsonBuffer(payload: unknown, pretty = false): Buffer {
  return Buffer.from(JSON.stringify(payload, pretty ? null : undefined, pretty ? 2 : undefined));
}

async function writeBufferInChunks(
  response: ServerResponse,
  body: Buffer,
  chunkSize: number,
): Promise<void> {
  for (let index = 0; index < body.byteLength; index += chunkSize) {
    const chunk = body.subarray(index, index + chunkSize);
    const canContinue = response.write(chunk);

    if (!canContinue) {
      await new Promise<void>((resolve) => response.once('drain', resolve));
    } else {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  response.end();
}

async function encodeBuffer(body: Buffer, encoding: Exclude<CompressionEncoding, 'identity'>): Promise<Buffer> {
  if (encoding === 'br') {
    return brotliCompressAsync(body, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
  }

  return gzipAsync(body, {
    level: 5,
  });
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = toJsonBuffer(payload, true);
  response.writeHead(statusCode, baseHeaders('application/json; charset=utf-8', body.byteLength));
  response.end(body);
}

export async function sendJsonWithCompression(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  options: JsonResponseOptions = {},
): Promise<void> {
  const encoding = selectCompressionEncoding(options.acceptEncoding);

  if (encoding === null) {
    sendJson(response, 406, {
      error: 'No acceptable content encoding available',
      supportedEncodings: ['br', 'gzip', 'identity'],
    });
    return;
  }

  const chunkSize = options.chunkSize ?? 64 * 1024;
  const body = toJsonBuffer(payload);
  const encodedBody = encoding === 'identity' ? body : await encodeBuffer(body, encoding);

  const extraHeaders: HeaderBag = {
    Vary: 'Accept-Encoding',
    'X-Uncompressed-Content-Length': String(body.byteLength),
  };

  if (encoding !== 'identity') {
    extraHeaders['Content-Encoding'] = encoding;
  }

  response.writeHead(
    statusCode,
    baseHeaders('application/json; charset=utf-8', encodedBody.byteLength, extraHeaders),
  );
  await writeBufferInChunks(response, encodedBody, chunkSize);
}
