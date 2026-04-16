import type { DatasetMode, DatasetQuery, MetaApiResponse, ObservableStreamSettings } from '../../../shared/points.js';

export const SERVER_NAME = 'openlayers-largecluster-demo-server';
export const SERVER_VERSION = '0.1.0';
export const DEFAULT_PORT = 3001;
export const DEFAULT_QUERY: DatasetQuery = {
  count: 100_000,
  seed: 42,
  mode: 'mixed',
};

export const SUPPORTED_MODES: DatasetMode[] = ['mixed', 'industrial', 'coincident'];
export const MAX_COUNT = 250_000;
export const STREAM_CHUNK_SIZE = 64 * 1024;
export const DEFAULT_OBSERVABLE_STREAM_SETTINGS: ObservableStreamSettings = {
  sampleMaxCount: 2_000,
  sampleLongTimeMs: 1_000,
  sampleBetweenDelayMs: 5_000,
};
export const MAX_SAMPLE_MAX_COUNT = 10_000;
export const MAX_SAMPLE_LONG_TIME_MS = 60_000;
export const MAX_SAMPLE_BETWEEN_DELAY_MS = 60_000;

export const META_RESPONSE: MetaApiResponse = {
  name: SERVER_NAME,
  version: SERVER_VERSION,
  defaultQuery: DEFAULT_QUERY,
  supportedModes: SUPPORTED_MODES,
};
