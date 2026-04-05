export function formatBytes(value: number | null): string {
  if (value === null) {
    return 'unknown';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const unit = units[unitIndex] ?? 'GB';
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 ms';
  }

  if (value < 1000) {
    return `${value.toFixed(1)} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

export function formatProgress(
  loadedBytes: number,
  totalBytes: number | null,
  ratio: number | null,
  durationMs?: number,
): string {
  const durationSuffix =
    typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
      ? `, ${formatDuration(durationMs)}`
      : '';

  if (ratio !== null) {
    return `${(ratio * 100).toFixed(1)}% (${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}${durationSuffix})`;
  }

  return `${formatBytes(loadedBytes)} скачано${durationSuffix}`;
}
