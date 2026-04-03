export interface DownloadProgressSnapshot {
  loadedBytes: number;
  totalBytes: number | null;
  ratio: number | null;
}

export interface DownloadTextResult {
  text: string;
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

export async function downloadJsonText(
  url: string,
  signal: AbortSignal,
  onProgress: (snapshot: DownloadProgressSnapshot) => void,
): Promise<DownloadTextResult> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Dataset request failed with status ${response.status}`);
  }

  const totalBytesHeader = response.headers.get('content-length');
  const totalBytes = totalBytesHeader ? Number.parseInt(totalBytesHeader, 10) : null;

  if (!response.body) {
    const text = await response.text();
    const loadedBytes = new TextEncoder().encode(text).byteLength;
    onProgress({
      loadedBytes,
      totalBytes,
      ratio: totalBytes ? loadedBytes / totalBytes : null,
    });
    return { text, loadedBytes, totalBytes };
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
  const text = new TextDecoder().decode(merged);

  return {
    text,
    loadedBytes,
    totalBytes,
  };
}

