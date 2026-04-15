/// <reference lib="WebWorker" />

import type { Feature, Point } from 'geojson';
import Supercluster from 'supercluster';
import type { ObservableData, PointsApiResponse } from '@shared/points';
import type {
  ClusterIndexOptions,
  IndexBuildSuccessPayload,
  VisibleItem,
  WorkerRequest,
  WorkerResponse,
} from '@shared/worker';

type IndexedPointProperties = ObservableData & {
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
type IndexBuildRequestType = 'build-index' | 'rebuild-index' | 'flush-index';

const workerScope = self as DedicatedWorkerGlobalScope;
const jsonDecoder = new TextDecoder();

let clusterIndex: Supercluster<IndexedPointProperties, ClusterAggregation> | null = null;
let observableById = new Map<string, ObservableData>();
let featureById = new Map<string, IndexedFeature>();
let idsByCoordinate = new Map<string, Set<string>>();
let hasDirtyIndexChanges = false;

function postMessage(message: WorkerResponse): void {
  workerScope.postMessage(message);
}

function isClusterProperties(
  properties: IndexedPointProperties | ClusterProperties,
): properties is ClusterProperties {
  return 'cluster' in properties && properties.cluster === true;
}

function toCoordinateKey(lon: number, lat: number): string {
  return `${lon},${lat}`;
}

function cloneObservableData(observable: ObservableData): ObservableData {
  return { ...observable };
}

function createIndexedFeature(observable: ObservableData, stackSize: number): IndexedFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [observable.lon, observable.lat],
    },
    properties: {
      ...observable,
      stackSize,
    },
  };
}

function addIdToCoordinateKey(key: string, id: string): void {
  const ids = idsByCoordinate.get(key);

  if (ids) {
    ids.add(id);
    return;
  }

  idsByCoordinate.set(key, new Set([id]));
}

function removeIdFromCoordinateKey(key: string, id: string): void {
  const ids = idsByCoordinate.get(key);

  if (!ids) {
    return;
  }

  ids.delete(id);

  if (ids.size === 0) {
    idsByCoordinate.delete(key);
  }
}

function updateStackSizesForCoordinateKey(key: string): void {
  const ids = idsByCoordinate.get(key);
  const nextStackSize = ids?.size ?? 0;

  if (!ids || nextStackSize === 0) {
    return;
  }

  for (const id of ids) {
    const feature = featureById.get(id);

    if (!feature) {
      continue;
    }

    feature.properties.stackSize = nextStackSize;
  }
}

function replaceObservableState(points: ObservableData[]): void {
  observableById = new Map();
  featureById = new Map();
  idsByCoordinate = new Map();

  for (const observable of points) {
    const clone = cloneObservableData(observable);
    const key = toCoordinateKey(clone.lon, clone.lat);
    observableById.set(clone.id, clone);
    addIdToCoordinateKey(key, clone.id);
  }

  for (const observable of observableById.values()) {
    const key = toCoordinateKey(observable.lon, observable.lat);
    featureById.set(observable.id, createIndexedFeature(observable, idsByCoordinate.get(key)?.size ?? 1));
  }
}

function createClusterAggregation(properties: IndexedPointProperties): ClusterAggregation {
  const isStacked = properties.stackSize > 1;

  return {
    hasStackedPoints: isStacked,
    stackedPointCount: isStacked ? 1 : 0,
    maxStackSize: properties.stackSize,
  };
}

function postIndexBuildProgress(
  requestId: string,
  requestType: IndexBuildRequestType,
  count: number,
  parseDurationMs: number,
): void {
  const responseType =
    requestType === 'build-index'
      ? 'build-index:progress'
      : requestType === 'rebuild-index'
        ? 'rebuild-index:progress'
        : null;

  if (!responseType) {
    return;
  }

  postMessage({
    requestId,
    type: responseType,
    payload: {
      phase: 'indexing',
      count,
      parseDurationMs,
    },
  });
}

function ensureIndex(): Supercluster<IndexedPointProperties, ClusterAggregation> {
  if (!clusterIndex) {
    throw new Error('Cluster index has not been built yet');
  }

  return clusterIndex;
}

function buildClusterIndex(
  requestId: string,
  requestType: IndexBuildRequestType,
  options: ClusterIndexOptions,
  parseDurationMs: number,
): IndexBuildSuccessPayload {
  const features = Array.from(featureById.values());
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
  hasDirtyIndexChanges = false;

  return {
    count: features.length,
    parseDurationMs,
    indexBuildDurationMs: performance.now() - indexBuildStartedAt,
  };
}

function parsePointsPayload(jsonBuffer: ArrayBuffer): PointsApiResponse {
  const json = jsonDecoder.decode(new Uint8Array(jsonBuffer));
  const payload = JSON.parse(json) as PointsApiResponse;

  if (!payload || !Array.isArray(payload.points)) {
    throw new Error('Worker received an invalid points payload');
  }

  return payload;
}

function toVisibleItem(feature: QueriedFeature): VisibleItem | null {
  const properties = feature.properties;

  if (isClusterProperties(properties)) {
    const [lon, lat] = feature.geometry.coordinates as [number, number];
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

  const latestObservable = observableById.get(properties.id);
  const latestFeature = featureById.get(properties.id);

  if (!latestObservable || !latestFeature) {
    return null;
  }

  const [lon, lat] = latestFeature.geometry.coordinates as [number, number];

  return {
    kind: 'point',
    id: latestObservable.id,
    lon,
    lat,
    name: latestObservable.name,
    category: latestObservable.category,
    weight: latestObservable.weight,
    stackSize: latestFeature.properties.stackSize,
  };
}

function applyObservableMutationSet(message: Extract<WorkerRequest, { type: 'apply-observable-mutations' }>['payload']['message']): {
  observableCount: number;
  dirtyIds: number;
} {
  const affectedCoordinateKeys = new Set<string>();
  const dirtyIds = new Set<string>();

  for (const deleted of message.delete) {
    const existing = observableById.get(deleted.id);

    if (!existing) {
      continue;
    }

    const key = toCoordinateKey(existing.lon, existing.lat);
    removeIdFromCoordinateKey(key, deleted.id);
    observableById.delete(deleted.id);
    featureById.delete(deleted.id);
    affectedCoordinateKeys.add(key);
    dirtyIds.add(deleted.id);
  }

  for (const nextObservable of [...message.insert, ...message.update]) {
    const normalizedObservable = cloneObservableData(nextObservable);
    const existing = observableById.get(normalizedObservable.id);
    const nextKey = toCoordinateKey(normalizedObservable.lon, normalizedObservable.lat);

    observableById.set(normalizedObservable.id, normalizedObservable);

    if (!existing) {
      addIdToCoordinateKey(nextKey, normalizedObservable.id);
      featureById.set(normalizedObservable.id, createIndexedFeature(normalizedObservable, 1));
      affectedCoordinateKeys.add(nextKey);
      dirtyIds.add(normalizedObservable.id);
      continue;
    }

    const previousKey = toCoordinateKey(existing.lon, existing.lat);

    if (previousKey !== nextKey) {
      removeIdFromCoordinateKey(previousKey, normalizedObservable.id);
      addIdToCoordinateKey(nextKey, normalizedObservable.id);
      affectedCoordinateKeys.add(previousKey);
      affectedCoordinateKeys.add(nextKey);
    } else {
      affectedCoordinateKeys.add(nextKey);
    }

    const feature = featureById.get(normalizedObservable.id) ?? createIndexedFeature(normalizedObservable, 1);
    feature.geometry.coordinates = [normalizedObservable.lon, normalizedObservable.lat];
    feature.properties.id = normalizedObservable.id;
    feature.properties.lon = normalizedObservable.lon;
    feature.properties.lat = normalizedObservable.lat;
    feature.properties.name = normalizedObservable.name;
    feature.properties.category = normalizedObservable.category;
    feature.properties.weight = normalizedObservable.weight;
    featureById.set(normalizedObservable.id, feature);
    dirtyIds.add(normalizedObservable.id);
  }

  for (const key of affectedCoordinateKeys) {
    updateStackSizesForCoordinateKey(key);
  }

  if (dirtyIds.size > 0) {
    hasDirtyIndexChanges = true;
  }

  return {
    observableCount: observableById.size,
    dirtyIds: dirtyIds.size,
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
        replaceObservableState(payload.points);

        postMessage({
          requestId: message.requestId,
          type: 'build-index:success',
          payload: buildClusterIndex(message.requestId, message.type, message.payload.options, parseDurationMs),
        });
        break;
      }
      case 'rebuild-index': {
        postMessage({
          requestId: message.requestId,
          type: 'rebuild-index:success',
          payload: buildClusterIndex(message.requestId, message.type, message.payload.options, 0),
        });
        break;
      }
      case 'apply-observable-mutations': {
        postMessage({
          requestId: message.requestId,
          type: 'apply-observable-mutations:success',
          payload: applyObservableMutationSet(message.payload.message),
        });
        break;
      }
      case 'flush-index': {
        if (!hasDirtyIndexChanges) {
          postMessage({
            requestId: message.requestId,
            type: 'flush-index:success',
            payload: {
              count: featureById.size,
              indexBuildDurationMs: 0,
              didRebuild: false,
            },
          });
          break;
        }

        const payload = buildClusterIndex(message.requestId, message.type, message.payload.options, 0);
        postMessage({
          requestId: message.requestId,
          type: 'flush-index:success',
          payload: {
            count: payload.count,
            indexBuildDurationMs: payload.indexBuildDurationMs,
            didRebuild: true,
          },
        });
        break;
      }
      case 'query-clusters': {
        const startedAt = performance.now();
        const items = ensureIndex()
          .getClusters(message.payload.bbox, message.payload.zoom)
          .map((feature) => toVisibleItem(feature as QueriedFeature))
          .filter((item): item is VisibleItem => item !== null);

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
