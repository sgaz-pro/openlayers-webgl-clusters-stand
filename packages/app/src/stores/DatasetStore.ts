import { makeAutoObservable, runInAction } from 'mobx';
import type { DatasetQuery, PointsApiResponse } from '@shared/points';
import { DEFAULT_DATASET_QUERY } from '../constants';
import { downloadJsonText } from '../api/downloadJsonText';
import type { RootStore } from './RootStore';

export type LoadingPhase = 'idle' | 'downloading' | 'parsing' | 'indexing' | 'ready' | 'error';

export class DatasetStore {
  phase: LoadingPhase = 'idle';
  query: DatasetQuery = DEFAULT_DATASET_QUERY;
  countLoaded = 0;
  downloadedBytes = 0;
  totalBytes: number | null = null;
  parseDurationMs = 0;
  errorMessage: string | null = null;

  private readonly rootStore: RootStore;
  private abortController: AbortController | null = null;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get downloadProgressRatio(): number | null {
    if (!this.totalBytes) {
      return null;
    }

    return this.downloadedBytes / this.totalBytes;
  }

  get isBusy(): boolean {
    return this.phase === 'downloading' || this.phase === 'parsing' || this.phase === 'indexing';
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async loadDataset(query: DatasetQuery = this.query): Promise<void> {
    this.abort();
    this.rootStore.clusterStore.reset();

    const abortController = new AbortController();
    this.abortController = abortController;

    runInAction(() => {
      this.phase = 'downloading';
      this.query = query;
      this.countLoaded = 0;
      this.downloadedBytes = 0;
      this.totalBytes = null;
      this.parseDurationMs = 0;
      this.errorMessage = null;
    });

    try {
      const url = `/api/points?count=${query.count}&seed=${query.seed}&mode=${query.mode}`;
      const download = await downloadJsonText(url, abortController.signal, (progress) => {
        if (this.abortController !== abortController) {
          return;
        }

        runInAction(() => {
          this.downloadedBytes = progress.loadedBytes;
          this.totalBytes = progress.totalBytes;
        });
      });

      if (this.abortController !== abortController) {
        return;
      }

      runInAction(() => {
        this.phase = 'parsing';
        this.downloadedBytes = download.loadedBytes;
        this.totalBytes = download.totalBytes;
      });

      const parseStartedAt = performance.now();
      const payload = JSON.parse(download.text) as PointsApiResponse;
      const parseDurationMs = performance.now() - parseStartedAt;

      runInAction(() => {
        this.phase = 'indexing';
        this.countLoaded = payload.points.length;
        this.parseDurationMs = parseDurationMs;
      });

      await this.rootStore.clusterStore.buildIndex(payload.points);

      if (this.abortController !== abortController) {
        return;
      }

      runInAction(() => {
        this.phase = 'ready';
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      runInAction(() => {
        this.phase = 'error';
        this.errorMessage = error instanceof Error ? error.message : 'Unknown dataset loading error';
      });
    } finally {
      if (this.abortController === abortController) {
        this.abortController = null;
      }
    }
  }
}
