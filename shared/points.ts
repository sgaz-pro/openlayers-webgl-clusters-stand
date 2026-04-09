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

export interface PointRecord {
  id: string;
  lon: number;
  lat: number;
  name: string;
  category: PointCategory;
  weight: number;
}

export interface DatasetQuery {
  count: number;
  seed: number;
  mode: DatasetMode;
}

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
