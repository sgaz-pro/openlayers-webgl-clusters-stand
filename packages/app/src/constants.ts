import type { DatasetQuery } from '@shared/points';
import type { ClusterIndexOptions } from '@shared/worker';

export const DEFAULT_DATASET_QUERY: DatasetQuery = {
  count: 100_000,
  seed: 42,
  mode: 'mixed',
};

export const WORKER_INDEX_OPTIONS: ClusterIndexOptions = {
  radius: 60,
  maxZoom: 16,
  minZoom: 0,
};

export const INITIAL_VIEW = {
  center: [13.405, 52.52] as [number, number],
  zoom: 2.4,
  minZoom: 2,
  maxZoom: 18,
};

export const LABEL_ZOOM_THRESHOLD = 13;
export const MAX_LABELS = 220;

