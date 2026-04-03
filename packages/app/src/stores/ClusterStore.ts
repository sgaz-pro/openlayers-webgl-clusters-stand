import { makeAutoObservable, runInAction } from 'mobx';
import type { LonLatBbox, PointRecord } from '@shared/points';
import type { VisibleItem } from '@shared/worker';
import { INITIAL_VIEW, WORKER_INDEX_OPTIONS } from '../constants';
import { SuperclusterWorkerClient } from '../workers/workerClient';
import type { RootStore } from './RootStore';

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

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  dispose(): void {
    this.workerClient.terminate();
  }

  reset(): void {
    this.querySerial += 1;
    this.visibleItems = [];
    this.indexBuildDurationMs = 0;
    this.lastClusterQueryDurationMs = 0;
    this.visibleClusters = 0;
    this.visibleLeafPoints = 0;
    this.renderedLabels = 0;
    this.isIndexReady = false;
  }

  async buildIndex(points: PointRecord[]): Promise<void> {
    this.querySerial += 1;
    const result = await this.workerClient.buildIndex(points, WORKER_INDEX_OPTIONS);

    runInAction(() => {
      this.indexBuildDurationMs = result.durationMs;
      this.isIndexReady = true;
      this.indexRevision += 1;
    });
  }

  async queryClusters(bbox: LonLatBbox, zoom: number): Promise<void> {
    if (!this.isIndexReady) {
      return;
    }

    const serial = this.querySerial + 1;
    this.querySerial = serial;
    const normalizedZoom = Math.max(WORKER_INDEX_OPTIONS.minZoom, Math.round(zoom));
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
    return result.zoom;
  }

  setRenderedLabels(count: number): void {
    this.renderedLabels = count;
  }

  setCurrentZoom(zoom: number): void {
    this.currentZoom = zoom;
  }
}
