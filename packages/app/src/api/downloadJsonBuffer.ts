export interface DownloadProgressSnapshot {
  loadedBytes: number;
  totalBytes: number | null;
  ratio: number | null;
}

export interface DownloadBufferResult {
  buffer: ArrayBuffer;
  loadedBytes: number;
  totalBytes: number | null;
}

function mergeChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

function parseHeaderInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function downloadJsonBuffer(
  url: string,
  signal: AbortSignal,
  onProgress: (snapshot: DownloadProgressSnapshot) => void,
): Promise<DownloadBufferResult> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Dataset request failed with status ${response.status}`);
  }

  const totalBytes =
    parseHeaderInteger(response.headers.get('x-uncompressed-content-length')) ??
    parseHeaderInteger(response.headers.get('content-length'));

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    const loadedBytes = buffer.byteLength;
    onProgress({
      loadedBytes,
      totalBytes,
      ratio: totalBytes ? loadedBytes / totalBytes : null,
    });
    return { buffer, loadedBytes, totalBytes };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  onProgress({
    loadedBytes,
    totalBytes,
    ratio: totalBytes ? 0 : null,
  });

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    chunks.push(value);
    loadedBytes += value.byteLength;

    onProgress({
      loadedBytes,
      totalBytes,
      ratio: totalBytes ? loadedBytes / totalBytes : null,
    });
  }

  const merged = mergeChunks(chunks, loadedBytes);

  return {
    buffer: merged.buffer as ArrayBuffer,
    loadedBytes,
    totalBytes,
  };
}
