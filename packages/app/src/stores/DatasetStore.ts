import { makeAutoObservable, runInAction } from 'mobx';
import { DEFAULT_DATASET_QUERY } from '../constants';
import type { DatasetQuery } from '@shared/points';
import { downloadJsonBuffer } from '../api/downloadJsonBuffer';
import type { RootStore } from './RootStore';

export type LoadingPhase = 'idle' | 'downloading' | 'parsing' | 'indexing' | 'ready' | 'error';

export class DatasetStore {
  phase: LoadingPhase = 'idle';
  query: DatasetQuery = DEFAULT_DATASET_QUERY;
  countLoaded = 0;
  downloadedBytes = 0;
  totalBytes: number | null = null;
  downloadDurationMs = 0;
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

    return Math.max(0, Math.min(1, this.downloadedBytes / this.totalBytes));
  }

  get isBusy(): boolean {
    return this.phase === 'downloading' || this.phase === 'parsing' || this.phase === 'indexing';
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async loadDataset(query: DatasetQuery = this.query): Promise<void> {
    await this.rootStore.observableStreamStore.resetForDatasetReload();
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
      this.downloadDurationMs = 0;
      this.parseDurationMs = 0;
      this.errorMessage = null;
    });

    try {
      const url = `/api/points?count=${query.count}&seed=${query.seed}&mode=${query.mode}`;
      const downloadStartedAt = performance.now();
      const download = await downloadJsonBuffer(url, abortController.signal, (progress) => {
        if (this.abortController !== abortController) {
          return;
        }

        runInAction(() => {
          this.downloadedBytes = progress.loadedBytes;
          this.totalBytes = progress.totalBytes;
          this.downloadDurationMs = performance.now() - downloadStartedAt;
        });
      });

      if (this.abortController !== abortController) {
        return;
      }

      runInAction(() => {
        this.phase = 'parsing';
        this.downloadedBytes = download.loadedBytes;
        this.totalBytes = download.totalBytes;
        this.downloadDurationMs = download.durationMs;
      });

      const buildResult = await this.rootStore.clusterStore.buildIndex(download.buffer, (progress) => {
        if (this.abortController !== abortController) {
          return;
        }

        runInAction(() => {
          this.phase = progress.phase;
          this.countLoaded = progress.count;
          this.parseDurationMs = progress.parseDurationMs;
        });
      });

      if (this.abortController !== abortController) {
        return;
      }

      runInAction(() => {
        this.phase = 'ready';
        this.countLoaded = buildResult.count;
        this.parseDurationMs = buildResult.parseDurationMs;
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
