export type DatasetMode = 'mixed' | 'industrial' | 'coincident';

export type GeneralPointCategory =
  | 'restaurant'
  | 'transit'
  | 'office'
  | 'school'
  | 'park'
  | 'retail'
  | 'healthcare'
  | 'warehouse';

export type IndustrialPointCategory =
  | 'process_unit'
  | 'utilities'
  | 'storage'
  | 'maintenance'
  | 'logistics'
  | 'safety'
  | 'laboratory'
  | 'administration';

export type PointCategory = GeneralPointCategory | IndustrialPointCategory;

export interface ObservableData {
  id: string;
  lon: number;
  lat: number;
  name: string;
  category: PointCategory;
  weight: number;
}

export type PointRecord = ObservableData;

export interface ObservableIdentity {
  id: string;
}

export interface ObservableMutationMessage {
  insert: ObservableData[];
  update: ObservableData[];
  delete: ObservableIdentity[];
}

export interface DatasetQuery {
  count: number;
  seed: number;
  mode: DatasetMode;
}

export interface ObservableStreamSettings {
  sampleMaxCount: number;
  sampleLongTimeMs: number;
  sampleBetweenDelayMs: number;
}

export interface ObservableStreamQuery extends DatasetQuery, ObservableStreamSettings {}

export interface PointsApiMeta {
  count: number;
  seed: number;
  mode: DatasetMode;
  generatedAt: string;
}

export interface PointsApiResponse {
  meta: PointsApiMeta;
  points: PointRecord[];
}

export interface MetaApiResponse {
  name: string;
  version: string;
  defaultQuery: DatasetQuery;
  supportedModes: DatasetMode[];
}

export interface HealthApiResponse {
  ok: true;
  uptimeSeconds: number;
  now: string;
}

export type LonLatBbox = [west: number, south: number, east: number, north: number];

export const OBSERVABLE_SSE_EVENT = 'observable';
