import type { LonLatBbox, PointCategory, PointRecord } from './points';

export interface ClusterIndexOptions {
  radius: number;
  maxZoom: number;
  minZoom: number;
}

export interface WorkerMessageBase<TType extends string, TPayload> {
  requestId: string;
  type: TType;
  payload: TPayload;
}

export type BuildIndexRequest = WorkerMessageBase<
  'build-index',
  {
    points: PointRecord[];
    options: ClusterIndexOptions;
  }
>;

export type QueryClustersRequest = WorkerMessageBase<
  'query-clusters',
  {
    bbox: LonLatBbox;
    zoom: number;
  }
>;

export type GetExpansionZoomRequest = WorkerMessageBase<
  'get-expansion-zoom',
  {
    clusterId: number;
  }
>;

export type WorkerRequest = BuildIndexRequest | QueryClustersRequest | GetExpansionZoomRequest;

export interface ClusterItem {
  kind: 'cluster';
  clusterId: number;
  lon: number;
  lat: number;
  pointCount: number;
  abbreviatedCount: number;
}

export interface LeafPointItem {
  kind: 'point';
  id: string;
  lon: number;
  lat: number;
  name: string;
  category: PointCategory;
  weight: number;
}

export type VisibleItem = ClusterItem | LeafPointItem;

export type BuildIndexResponse = WorkerMessageBase<
  'build-index:success',
  {
    count: number;
    durationMs: number;
  }
>;

export type QueryClustersResponse = WorkerMessageBase<
  'query-clusters:success',
  {
    durationMs: number;
    items: VisibleItem[];
  }
>;

export type GetExpansionZoomResponse = WorkerMessageBase<
  'get-expansion-zoom:success',
  {
    durationMs: number;
    zoom: number;
  }
>;

export type WorkerErrorResponse = WorkerMessageBase<
  'error',
  {
    message: string;
  }
>;

export type WorkerResponse =
  | BuildIndexResponse
  | QueryClustersResponse
  | GetExpansionZoomResponse
  | WorkerErrorResponse;
