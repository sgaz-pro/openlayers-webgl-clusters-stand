import type { DatasetMode, DatasetQuery } from '@shared/points';
import type { ClusterIndexOptions } from '@shared/worker';

export const DEFAULT_DATASET_QUERY: DatasetQuery = {
  count: 100_000,
  seed: 42,
  mode: 'mixed',
};

export const DATASET_MODE_OPTIONS: Array<{
  value: DatasetMode;
  label: string;
  description: string;
}> = [
  {
    value: 'mixed',
    label: '1. Mixed world',
    description: 'Глобальный смешанный датасет: города, коридоры, разрежённые зоны и шум.',
  },
  {
    value: 'industrial',
    label: '2. Concentrated industrial',
    description: 'Сконцентрированный датасет внутри большого промышленного комплекса.',
  },
];

export const DATASET_MODE_LABELS: Record<DatasetMode, string> = {
  mixed: 'Mixed world',
  industrial: 'Concentrated industrial',
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

export const FREE_LABEL_ZOOM_THRESHOLD = INITIAL_VIEW.maxZoom - 0.5;
export const LABEL_QUERY_PADDING_RATIO = 0.25;
export const LABEL_RENDER_BUFFER_PX = 256;
