import type { LonLatBbox, ObservableData, ObservableMutationMessage, PointCategory } from './points';

export interface ClusterIndexOptions {
  radius: number;
  maxZoom: number;
  minZoom: number;
  minPoints: number;
  extent: number;
  nodeSize: number;
}

export interface WorkerMessageBase<TType extends string, TPayload> {
  requestId: string;
  type: TType;
  payload: TPayload;
}

export type BuildIndexRequest = WorkerMessageBase<
  'build-index',
  {
    jsonBuffer: ArrayBuffer;
    options: ClusterIndexOptions;
  }
>;

export type RebuildIndexRequest = WorkerMessageBase<
  'rebuild-index',
  {
    options: ClusterIndexOptions;
  }
>;

export type ApplyObservableMutationsRequest = WorkerMessageBase<
  'apply-observable-mutations',
  {
    message: ObservableMutationMessage;
  }
>;

export type FlushIndexRequest = WorkerMessageBase<
  'flush-index',
  {
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

export type WorkerRequest =
  | BuildIndexRequest
  | RebuildIndexRequest
  | ApplyObservableMutationsRequest
  | FlushIndexRequest
  | QueryClustersRequest
  | GetExpansionZoomRequest;

export interface ClusterItem {
  kind: 'cluster';
  clusterId: number;
  lon: number;
  lat: number;
  pointCount: number;
  abbreviatedCount: number;
  hasStackedPoints: boolean;
  stackedPointCount: number;
  maxStackSize: number;
}

export interface LeafPointItem {
  kind: 'point';
  id: ObservableData['id'];
  lon: ObservableData['lon'];
  lat: ObservableData['lat'];
  name: ObservableData['name'];
  category: PointCategory;
  weight: ObservableData['weight'];
  stackSize: number;
}

export type VisibleItem = ClusterItem | LeafPointItem;

export interface IndexBuildProgressPayload {
  phase: 'indexing';
  count: number;
  parseDurationMs: number;
}

export interface IndexBuildSuccessPayload {
  count: number;
  parseDurationMs: number;
  indexBuildDurationMs: number;
}

export type BuildIndexProgressResponse = WorkerMessageBase<'build-index:progress', IndexBuildProgressPayload>;

export type BuildIndexResponse = WorkerMessageBase<'build-index:success', IndexBuildSuccessPayload>;

export type RebuildIndexProgressResponse = WorkerMessageBase<'rebuild-index:progress', IndexBuildProgressPayload>;

export type RebuildIndexResponse = WorkerMessageBase<'rebuild-index:success', IndexBuildSuccessPayload>;

export type ApplyObservableMutationsResponse = WorkerMessageBase<
  'apply-observable-mutations:success',
  {
    observableCount: number;
    dirtyIds: number;
  }
>;

export type FlushIndexResponse = WorkerMessageBase<
  'flush-index:success',
  {
    count: number;
    indexBuildDurationMs: number;
    didRebuild: boolean;
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
  | BuildIndexProgressResponse
  | BuildIndexResponse
  | RebuildIndexProgressResponse
  | RebuildIndexResponse
  | ApplyObservableMutationsResponse
  | FlushIndexResponse
  | QueryClustersResponse
  | GetExpansionZoomResponse
  | WorkerErrorResponse;
