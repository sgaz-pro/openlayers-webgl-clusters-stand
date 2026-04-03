/// <reference lib="WebWorker" />

import type { Feature, Point } from 'geojson';
import Supercluster from 'supercluster';
import type { PointRecord } from '@shared/points';
import type { VisibleItem, WorkerRequest, WorkerResponse } from '@shared/worker';

type ClusterProperties = {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: number;
};

type IndexedFeature = Feature<Point, PointRecord>;
type ClusteredFeature = Feature<Point, ClusterProperties>;

const workerScope = self as DedicatedWorkerGlobalScope;
let clusterIndex: Supercluster<PointRecord, ClusterProperties> | null = null;

function postMessage(message: WorkerResponse): void {
  workerScope.postMessage(message);
}

function toVisibleItem(feature: IndexedFeature | ClusteredFeature): VisibleItem {
  const [lon, lat] = feature.geometry.coordinates as [number, number];
  const properties = feature.properties;

  if ('cluster' in properties && properties.cluster) {
    return {
      kind: 'cluster',
      clusterId: properties.cluster_id,
      lon,
      lat,
      pointCount: properties.point_count,
      abbreviatedCount: properties.point_count_abbreviated,
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
  };
}

function ensureIndex(): Supercluster<PointRecord, ClusterProperties> {
  if (!clusterIndex) {
    throw new Error('Cluster index has not been built yet');
  }

  return clusterIndex;
}

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'build-index': {
        const startedAt = performance.now();
        const index = new Supercluster<PointRecord, ClusterProperties>({
          radius: message.payload.options.radius,
          maxZoom: message.payload.options.maxZoom,
          minZoom: message.payload.options.minZoom,
        });

        const features: IndexedFeature[] = message.payload.points.map((point) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.lon, point.lat],
          },
          properties: point,
        }));

        clusterIndex = index.load(features);

        postMessage({
          requestId: message.requestId,
          type: 'build-index:success',
          payload: {
            count: message.payload.points.length,
            durationMs: performance.now() - startedAt,
          },
        });
        break;
      }
      case 'query-clusters': {
        const startedAt = performance.now();
        const items = ensureIndex()
          .getClusters(message.payload.bbox, message.payload.zoom)
          .map((feature) => toVisibleItem(feature as IndexedFeature | ClusteredFeature));

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
      default:
        throw new Error(`Unsupported worker message type: ${String(message.type)}`);
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
