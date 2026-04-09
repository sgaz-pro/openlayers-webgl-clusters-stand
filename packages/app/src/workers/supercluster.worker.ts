/// <reference lib="WebWorker" />

import type { Feature, Point } from 'geojson';
import Supercluster from 'supercluster';
import type { PointRecord, PointsApiResponse } from '@shared/points';
import type {
  ClusterIndexOptions,
  IndexBuildSuccessPayload,
  VisibleItem,
  WorkerRequest,
  WorkerResponse,
} from '@shared/worker';

type IndexedPointProperties = PointRecord & {
  stackSize: number;
};

type ClusterAggregation = {
  hasStackedPoints: boolean;
  stackedPointCount: number;
  maxStackSize: number;
};

type ClusterProperties = ClusterAggregation & {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: number | string;
};

type IndexedFeature = Feature<Point, IndexedPointProperties>;
type QueriedFeature = Feature<Point, IndexedPointProperties | ClusterProperties>;
type IndexBuildRequestType = 'build-index' | 'rebuild-index';

const workerScope = self as DedicatedWorkerGlobalScope;
let clusterIndex: Supercluster<IndexedPointProperties, ClusterAggregation> | null = null;
let indexedFeatures: IndexedFeature[] = [];
const jsonDecoder = new TextDecoder();

function postMessage(message: WorkerResponse): void {
  workerScope.postMessage(message);
}

function isClusterProperties(
  properties: IndexedPointProperties | ClusterProperties,
): properties is ClusterProperties {
  return 'cluster' in properties && properties.cluster === true;
}

function toVisibleItem(feature: QueriedFeature): VisibleItem {
  const [lon, lat] = feature.geometry.coordinates as [number, number];
  const properties = feature.properties;

  if (isClusterProperties(properties)) {
    const abbreviatedCount =
      typeof properties.point_count_abbreviated === 'number'
        ? properties.point_count_abbreviated
        : Number.parseInt(properties.point_count_abbreviated, 10) || properties.point_count;

    return {
      kind: 'cluster',
      clusterId: properties.cluster_id,
      lon,
      lat,
      pointCount: properties.point_count,
      abbreviatedCount,
      hasStackedPoints: properties.hasStackedPoints,
      stackedPointCount: properties.stackedPointCount,
      maxStackSize: properties.maxStackSize,
    };
  }

  return {
    kind: 'point',
    id: properties.id,
    lon,
    lat,
    name: properties.name,
    category: properties.category,
    weight: properties.weight,
    stackSize: properties.stackSize,
  };
}

function ensureIndex(): Supercluster<IndexedPointProperties, ClusterAggregation> {
  if (!clusterIndex) {
    throw new Error('Cluster index has not been built yet');
  }

  return clusterIndex;
}

function ensureIndexedFeatures(): IndexedFeature[] {
  if (indexedFeatures.length === 0) {
    throw new Error('Cluster index cannot be rebuilt before the initial dataset load');
  }

  return indexedFeatures;
}

function parsePointsPayload(jsonBuffer: ArrayBuffer): PointsApiResponse {
  const json = jsonDecoder.decode(new Uint8Array(jsonBuffer));
  const payload = JSON.parse(json) as PointsApiResponse;

  if (!payload || !Array.isArray(payload.points)) {
    throw new Error('Worker received an invalid points payload');
  }

  return payload;
}

function toCoordinateKey(lon: number, lat: number): string {
  return `${lon},${lat}`;
}

function getStackSizes(points: PointRecord[]): Map<string, number> {
  const stackSizes = new Map<string, number>();

  for (const point of points) {
    const key = toCoordinateKey(point.lon, point.lat);
    stackSizes.set(key, (stackSizes.get(key) ?? 0) + 1);
  }

  return stackSizes;
}

function createClusterAggregation(properties: IndexedPointProperties): ClusterAggregation {
  const isStacked = properties.stackSize > 1;

  return {
    hasStackedPoints: isStacked,
    stackedPointCount: isStacked ? 1 : 0,
    maxStackSize: properties.stackSize,
  };
}

function toIndexedFeatures(points: PointRecord[]): IndexedFeature[] {
  const stackSizes = getStackSizes(points);

  return points.map((point) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [point.lon, point.lat],
    },
    properties: {
      ...point,
      stackSize: stackSizes.get(toCoordinateKey(point.lon, point.lat)) ?? 1,
    },
  }));
}

function postIndexBuildProgress(
  requestId: string,
  requestType: IndexBuildRequestType,
  count: number,
  parseDurationMs: number,
): void {
  postMessage({
    requestId,
    type: requestType === 'build-index' ? 'build-index:progress' : 'rebuild-index:progress',
    payload: {
      phase: 'indexing',
      count,
      parseDurationMs,
    },
  });
}

function buildClusterIndex(
  requestId: string,
  requestType: IndexBuildRequestType,
  options: ClusterIndexOptions,
  features: IndexedFeature[],
  parseDurationMs: number,
): IndexBuildSuccessPayload {
  postIndexBuildProgress(requestId, requestType, features.length, parseDurationMs);

  const indexBuildStartedAt = performance.now();
  const index = new Supercluster<IndexedPointProperties, ClusterAggregation>({
    radius: options.radius,
    maxZoom: options.maxZoom,
    minZoom: options.minZoom,
    minPoints: options.minPoints,
    extent: options.extent,
    nodeSize: options.nodeSize,
    map: createClusterAggregation,
    reduce: (accumulated, properties) => {
      accumulated.hasStackedPoints = accumulated.hasStackedPoints || properties.hasStackedPoints;
      accumulated.stackedPointCount += properties.stackedPointCount;
      accumulated.maxStackSize = Math.max(accumulated.maxStackSize, properties.maxStackSize);
    },
  });

  clusterIndex = index.load(features);

  return {
    count: features.length,
    parseDurationMs,
    indexBuildDurationMs: performance.now() - indexBuildStartedAt,
  };
}

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'build-index': {
        const parseStartedAt = performance.now();
        const payload = parsePointsPayload(message.payload.jsonBuffer);
        const parseDurationMs = performance.now() - parseStartedAt;
        const features = toIndexedFeatures(payload.points);

        indexedFeatures = features;

        postMessage({
          requestId: message.requestId,
          type: 'build-index:success',
          payload: buildClusterIndex(
            message.requestId,
            message.type,
            message.payload.options,
            features,
            parseDurationMs,
          ),
        });
        break;
      }
      case 'rebuild-index': {
        postMessage({
          requestId: message.requestId,
          type: 'rebuild-index:success',
          payload: buildClusterIndex(message.requestId, message.type, message.payload.options, ensureIndexedFeatures(), 0),
        });
        break;
      }
      case 'query-clusters': {
        const startedAt = performance.now();
        const items = ensureIndex()
          .getClusters(message.payload.bbox, message.payload.zoom)
          .map((feature) => toVisibleItem(feature as QueriedFeature));

        postMessage({
          requestId: message.requestId,
          type: 'query-clusters:success',
          payload: {
            durationMs: performance.now() - startedAt,
            items,
          },
        });
        break;
      }
      case 'get-expansion-zoom': {
        const startedAt = performance.now();
        const zoom = ensureIndex().getClusterExpansionZoom(message.payload.clusterId);

        postMessage({
          requestId: message.requestId,
          type: 'get-expansion-zoom:success',
          payload: {
            durationMs: performance.now() - startedAt,
            zoom,
          },
        });
        break;
      }
    }
  } catch (error) {
    postMessage({
      requestId: message.requestId,
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : 'Unknown worker error',
      },
    });
  }
};

export {};
