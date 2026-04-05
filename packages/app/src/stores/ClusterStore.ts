import { makeAutoObservable, runInAction } from 'mobx';
import type { LonLatBbox } from '@shared/points';
import type { BuildIndexProgressResponse, BuildIndexResponse, VisibleItem } from '@shared/worker';
import { DENSE_CLUSTER_REVEAL_VIEW_ZOOM, INITIAL_VIEW, WORKER_INDEX_OPTIONS } from '../constants';
import { SuperclusterWorkerClient } from '../workers/workerClient';
import type { RootStore } from './RootStore';

function toClusterQueryZoom(viewZoom: number): number {
  const roundedZoom = Math.max(WORKER_INDEX_OPTIONS.minZoom, Math.round(viewZoom));
  const maxClusterZoom = WORKER_INDEX_OPTIONS.maxZoom;

  if (roundedZoom < DENSE_CLUSTER_REVEAL_VIEW_ZOOM) {
    return Math.min(roundedZoom, maxClusterZoom - 2);
  }

  if (roundedZoom === DENSE_CLUSTER_REVEAL_VIEW_ZOOM) {
    return maxClusterZoom - 1;
  }

  return Math.min(roundedZoom, maxClusterZoom + 1);
}

function toViewZoomForExpansion(clusterZoom: number): number {
  const roundedZoom = Math.round(clusterZoom);
  const maxClusterZoom = WORKER_INDEX_OPTIONS.maxZoom;

  if (roundedZoom <= maxClusterZoom - 2) {
    return roundedZoom;
  }

  if (roundedZoom === maxClusterZoom - 1) {
    return DENSE_CLUSTER_REVEAL_VIEW_ZOOM;
  }

  return INITIAL_VIEW.maxZoom;
}

export class ClusterStore {
  visibleItems: VisibleItem[] = [];
  indexBuildDurationMs = 0;
  lastClusterQueryDurationMs = 0;
  visibleClusters = 0;
  visibleLeafPoints = 0;
  renderedLabels = 0;
  currentZoom = INITIAL_VIEW.zoom;
  isIndexReady = false;
  indexRevision = 0;

  private readonly rootStore: RootStore;
  private readonly workerClient = new SuperclusterWorkerClient();
  private querySerial = 0;
  private buildSerial = 0;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  dispose(): void {
    this.workerClient.terminate();
  }

  reset(): void {
    this.buildSerial += 1;
    this.querySerial += 1;
    this.visibleItems = [];
    this.indexBuildDurationMs = 0;
    this.lastClusterQueryDurationMs = 0;
    this.visibleClusters = 0;
    this.visibleLeafPoints = 0;
    this.renderedLabels = 0;
    this.isIndexReady = false;
  }

  async buildIndex(
    jsonBuffer: ArrayBuffer,
    onProgress?: (payload: BuildIndexProgressResponse['payload']) => void,
  ): Promise<BuildIndexResponse['payload']> {
    const buildSerial = this.buildSerial + 1;
    this.buildSerial = buildSerial;
    this.querySerial += 1;
    const result = await this.workerClient.buildIndex(jsonBuffer, WORKER_INDEX_OPTIONS, onProgress);

    if (buildSerial !== this.buildSerial) {
      return result;
    }

    runInAction(() => {
      this.indexBuildDurationMs = result.indexBuildDurationMs;
      this.isIndexReady = true;
      this.indexRevision += 1;
    });

    return result;
  }

  async queryClusters(bbox: LonLatBbox, zoom: number): Promise<void> {
    if (!this.isIndexReady) {
      return;
    }

    const serial = this.querySerial + 1;
    this.querySerial = serial;
    const normalizedZoom = toClusterQueryZoom(zoom);
    const result = await this.workerClient.queryClusters(bbox, normalizedZoom);

    if (serial !== this.querySerial) {
      return;
    }

    const visibleClusters = result.items.filter((item) => item.kind === 'cluster').length;
    const visibleLeafPoints = result.items.length - visibleClusters;

    runInAction(() => {
      this.visibleItems = result.items;
      this.lastClusterQueryDurationMs = result.durationMs;
      this.visibleClusters = visibleClusters;
      this.visibleLeafPoints = visibleLeafPoints;
    });
  }

  async getExpansionZoom(clusterId: number): Promise<number> {
    const result = await this.workerClient.getExpansionZoom(clusterId);
    return toViewZoomForExpansion(result.zoom);
  }

  setRenderedLabels(count: number): void {
    this.renderedLabels = count;
  }

  setCurrentZoom(zoom: number): void {
    this.currentZoom = zoom;
  }
}
