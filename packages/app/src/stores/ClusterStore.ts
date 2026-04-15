import { makeAutoObservable, runInAction } from 'mobx';
import type { LonLatBbox } from '@shared/points';
import type { BuildIndexResponse, IndexBuildProgressPayload, VisibleItem } from '@shared/worker';
import { createObservableModels, type ObservableModel } from '../models/ObservableModel';
import {
  DEFAULT_CLUSTER_DISPLAY_SETTINGS,
  INITIAL_VIEW,
  toClusterIndexOptions,
  type ClusterDisplaySettings,
} from '../constants';
import { SuperclusterWorkerClient } from '../workers/workerClient';
import type { RootStore } from './RootStore';

function normalizeDenseRevealViewZoom(settings: ClusterDisplaySettings): number {
  const minViewZoom = Math.max(INITIAL_VIEW.minZoom, settings.minZoom);
  return Math.max(minViewZoom, Math.min(INITIAL_VIEW.maxZoom - 1, Math.round(settings.denseClusterRevealViewZoom)));
}

function toClusterQueryZoom(viewZoom: number, settings: ClusterDisplaySettings): number {
  const roundedZoom = Math.max(settings.minZoom, Math.round(viewZoom));
  const maxClusterZoom = settings.maxZoom;
  const coarseZoom = Math.max(settings.minZoom, maxClusterZoom - 2);
  const penultimateZoom = Math.max(settings.minZoom, maxClusterZoom - 1);
  const denseRevealViewZoom = normalizeDenseRevealViewZoom(settings);

  if (roundedZoom < denseRevealViewZoom) {
    return Math.min(roundedZoom, coarseZoom);
  }

  if (roundedZoom === denseRevealViewZoom) {
    return penultimateZoom;
  }

  return Math.min(roundedZoom, maxClusterZoom + 1);
}

function toViewZoomForExpansion(clusterZoom: number, settings: ClusterDisplaySettings): number {
  const roundedZoom = Math.round(clusterZoom);
  const maxClusterZoom = settings.maxZoom;
  const coarseZoom = Math.max(settings.minZoom, maxClusterZoom - 2);
  const penultimateZoom = Math.max(settings.minZoom, maxClusterZoom - 1);

  if (roundedZoom <= coarseZoom) {
    return roundedZoom;
  }

  if (roundedZoom === penultimateZoom) {
    return normalizeDenseRevealViewZoom(settings);
  }

  return INITIAL_VIEW.maxZoom;
}

export class ClusterStore {
  visibleItems: VisibleItem[] = [];
  visibleObservables: ObservableModel[] = [];
  indexBuildDurationMs = 0;
  lastClusterQueryDurationMs = 0;
  visibleClusters = 0;
  visibleLeafPoints = 0;
  visibleStackedClusters = 0;
  visibleMaxStackSize = 1;
  currentZoom = INITIAL_VIEW.zoom;
  isIndexReady = false;
  isApplyingSettings = false;
  indexRevision = 0;
  selectedObservableId: string | null = null;
  observableSelectionRevision = 0;
  settingsError: string | null = null;
  settings: ClusterDisplaySettings = DEFAULT_CLUSTER_DISPLAY_SETTINGS;

  private readonly workerClient = new SuperclusterWorkerClient();
  private querySerial = 0;
  private buildSerial = 0;

  constructor(_rootStore: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get selectedObservable(): ObservableModel | null {
    return this.visibleObservables.find((observable) => observable.id === this.selectedObservableId) ?? null;
  }

  get renderedLabels(): number {
    return this.visibleObservables.filter((observable) => observable.isLabelVisible).length;
  }

  dispose(): void {
    this.workerClient.terminate();
  }

  reset(): void {
    this.buildSerial += 1;
    this.querySerial += 1;
    this.visibleItems = [];
    this.visibleObservables = [];
    this.indexBuildDurationMs = 0;
    this.lastClusterQueryDurationMs = 0;
    this.visibleClusters = 0;
    this.visibleLeafPoints = 0;
    this.visibleStackedClusters = 0;
    this.visibleMaxStackSize = 1;
    this.isIndexReady = false;
    this.isApplyingSettings = false;
    this.selectedObservableId = null;
    this.observableSelectionRevision += 1;
    this.settingsError = null;
  }

  async buildIndex(
    jsonBuffer: ArrayBuffer,
    onProgress?: (payload: IndexBuildProgressPayload) => void,
  ): Promise<BuildIndexResponse['payload']> {
    const buildSerial = this.buildSerial + 1;
    this.buildSerial = buildSerial;
    this.querySerial += 1;
    const result = await this.workerClient.buildIndex(jsonBuffer, toClusterIndexOptions(this.settings), onProgress);

    if (buildSerial !== this.buildSerial) {
      return result;
    }

    runInAction(() => {
      this.indexBuildDurationMs = result.indexBuildDurationMs;
      this.isIndexReady = true;
      this.isApplyingSettings = false;
      this.settingsError = null;
      this.indexRevision += 1;
    });

    return result;
  }

  async applySettings(
    settings: ClusterDisplaySettings,
    onProgress?: (payload: IndexBuildProgressPayload) => void,
  ): Promise<void> {
    if (!this.isIndexReady) {
      runInAction(() => {
        this.settings = settings;
        this.settingsError = null;
      });
      return;
    }

    const buildSerial = this.buildSerial + 1;
    this.buildSerial = buildSerial;
    this.querySerial += 1;

    runInAction(() => {
      this.isApplyingSettings = true;
      this.settingsError = null;
    });

    try {
      const result = await this.workerClient.rebuildIndex(toClusterIndexOptions(settings), onProgress);

      if (buildSerial !== this.buildSerial) {
        return;
      }

      runInAction(() => {
        this.settings = settings;
        this.indexBuildDurationMs = result.indexBuildDurationMs;
        this.isApplyingSettings = false;
        this.settingsError = null;
        this.indexRevision += 1;
      });
    } catch (error) {
      if (buildSerial !== this.buildSerial) {
        return;
      }

      runInAction(() => {
        this.isApplyingSettings = false;
        this.settingsError = error instanceof Error ? error.message : 'Не удалось применить настройки кластеров';
      });
    }
  }

  async queryClusters(bbox: LonLatBbox, zoom: number): Promise<void> {
    if (!this.isIndexReady) {
      return;
    }

    const serial = this.querySerial + 1;
    this.querySerial = serial;
    const normalizedZoom = toClusterQueryZoom(zoom, this.settings);
    const result = await this.workerClient.queryClusters(bbox, normalizedZoom);

    if (serial !== this.querySerial) {
      return;
    }

    const visibleClusters = result.items.filter((item) => item.kind === 'cluster').length;
    const visibleLeafPoints = result.items.length - visibleClusters;
    const visibleObservables = createObservableModels(result.items);
    const visibleStackedClusters = result.items.filter(
      (item): item is Extract<VisibleItem, { kind: 'cluster' }> => item.kind === 'cluster' && item.hasStackedPoints,
    ).length;
    const visibleMaxStackSize = result.items.reduce((maxStackSize, item) => {
      if (item.kind === 'cluster') {
        return Math.max(maxStackSize, item.maxStackSize);
      }

      return Math.max(maxStackSize, item.stackSize);
    }, 1);
    const nextSelectedObservableId =
      this.selectedObservableId && visibleObservables.some((observable) => observable.id === this.selectedObservableId)
        ? this.selectedObservableId
        : null;

    runInAction(() => {
      this.visibleItems = result.items;
      this.visibleObservables = visibleObservables;
      this.lastClusterQueryDurationMs = result.durationMs;
      this.visibleClusters = visibleClusters;
      this.visibleLeafPoints = visibleLeafPoints;
      this.visibleStackedClusters = visibleStackedClusters;
      this.visibleMaxStackSize = visibleMaxStackSize;
      this.selectedObservableId = nextSelectedObservableId;
      this.applyObservableLabelStyles();
      this.observableSelectionRevision += 1;
    });
  }

  async getExpansionZoom(clusterId: number): Promise<number> {
    const result = await this.workerClient.getExpansionZoom(clusterId);
    return toViewZoomForExpansion(result.zoom, this.settings);
  }

  selectObservable(id: string): void {
    if (!this.visibleObservables.some((observable) => observable.id === id)) {
      return;
    }

    if (this.selectedObservableId === id) {
      return;
    }

    this.selectedObservableId = id;
    this.applyObservableLabelStyles();
    this.observableSelectionRevision += 1;
  }

  clearObservableSelection(): void {
    if (this.selectedObservableId === null) {
      return;
    }

    this.selectedObservableId = null;
    this.applyObservableLabelStyles();
    this.observableSelectionRevision += 1;
  }

  setCurrentZoom(zoom: number): void {
    this.currentZoom = zoom;
  }

  private applyObservableLabelStyles(): void {
    const selectedObservable = this.selectedObservable;

    if (!selectedObservable) {
      for (const observable of this.visibleObservables) {
        observable.useDefaultLabelStyle();
      }

      return;
    }

    for (const observable of this.visibleObservables) {
      if (observable.id === selectedObservable.id) {
        observable.useSelectedLabelStyle();
        continue;
      }

      observable.useMutedLabelStyle();
    }
  }
}
