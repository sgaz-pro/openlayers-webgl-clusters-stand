import { makeAutoObservable, runInAction } from 'mobx';
import {
  type ObservableIdentity,
  type ObservableMutationMessage,
  type ObservableStreamSettings,
} from '@shared/points';
import { DEFAULT_OBSERVABLE_STREAM_SETTINGS, LIVE_INDEX_FLUSH_DELAY_MS } from '../constants';
import type { RootStore } from './RootStore';

type ObservableStreamStatus = 'idle' | 'connecting' | 'open' | 'error';
const OBSERVABLE_SSE_EVENT = 'observable';

function countMutations(message: ObservableMutationMessage): number {
  return message.insert.length + message.update.length + message.delete.length;
}

function normalizeObservableDeletes(values: readonly ObservableIdentity[]): ObservableIdentity[] {
  const deleteIds = new Set<string>();

  for (const value of values) {
    if (value.id) {
      deleteIds.add(value.id);
    }
  }

  return Array.from(deleteIds, (id) => ({ id }));
}

function normalizeObservableMutationMessage(message: Partial<ObservableMutationMessage>): ObservableMutationMessage {
  const insert = Array.isArray(message.insert) ? message.insert : [];
  const update = Array.isArray(message.update) ? message.update : [];
  const deleted = normalizeObservableDeletes(Array.isArray(message.delete) ? message.delete : []);
  const deletedIds = new Set(deleted.map((entry) => entry.id));
  const updateById = new Map<string, ObservableMutationMessage['update'][number]>();

  for (const entry of update) {
    if (!deletedIds.has(entry.id)) {
      updateById.set(entry.id, entry);
    }
  }

  const insertById = new Map<string, ObservableMutationMessage['insert'][number]>();

  for (const entry of insert) {
    if (!deletedIds.has(entry.id) && !updateById.has(entry.id)) {
      insertById.set(entry.id, entry);
    }
  }

  return {
    insert: Array.from(insertById.values()),
    update: Array.from(updateById.values()),
    delete: deleted,
  };
}

export class ObservableStreamStore {
  status: ObservableStreamStatus = 'idle';
  isStreaming = false;
  settings: ObservableStreamSettings = DEFAULT_OBSERVABLE_STREAM_SETTINGS;
  errorMessage: string | null = null;
  receivedEventCount = 0;
  receivedMutationCount = 0;
  appliedDirtyIdCount = 0;
  flushCount = 0;
  lastFlushDurationMs = 0;

  private readonly rootStore: RootStore;
  private eventSource: EventSource | null = null;
  private streamSeq = 0;
  private flushTimer: number | null = null;
  private applyQueue: Promise<void> = Promise.resolve();
  private isFlushingIndex = false;
  private flushRequestedWhileBusy = false;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(
      this,
      {
        rootStore: false,
        eventSource: false,
        flushTimer: false,
        applyQueue: false,
        isFlushingIndex: false,
        flushRequestedWhileBusy: false,
      } as any,
      { autoBind: true },
    );
  }

  get isConnected(): boolean {
    return this.status === 'connecting' || this.status === 'open';
  }

  updateSettings(nextSettings: ObservableStreamSettings): void {
    this.settings = nextSettings;
  }

  start(): void {
    if (this.rootStore.datasetStore.phase !== 'ready') {
      return;
    }

    this.closeEventSource();
    this.clearFlushTimer();
    this.rootStore.observableAnimationStore.clearAll({ snapToTarget: true });
    this.streamSeq = 0;

    runInAction(() => {
      this.status = 'connecting';
      this.isStreaming = true;
      this.errorMessage = null;
      this.receivedEventCount = 0;
      this.receivedMutationCount = 0;
      this.appliedDirtyIdCount = 0;
      this.flushCount = 0;
      this.lastFlushDurationMs = 0;
    });

    const query = this.rootStore.datasetStore.query;
    const params = new URLSearchParams({
      count: String(query.count),
      seed: String(query.seed),
      mode: query.mode,
      sampleMaxCount: String(this.settings.sampleMaxCount),
      sampleLongTimeMs: String(this.settings.sampleLongTimeMs),
      sampleBetweenDelayMs: String(this.settings.sampleBetweenDelayMs),
    });
    const eventSource = new EventSource(`/api/observable/stream?${params.toString()}`);
    this.eventSource = eventSource;

    eventSource.onopen = () => {
      if (this.eventSource !== eventSource) {
        return;
      }

      runInAction(() => {
        this.status = 'open';
        this.errorMessage = null;
      });
    };

    eventSource.onerror = () => {
      if (this.eventSource !== eventSource) {
        return;
      }

      runInAction(() => {
        this.status = 'error';
        this.errorMessage = 'Поток SSE временно недоступен';
      });
    };

    eventSource.addEventListener(OBSERVABLE_SSE_EVENT, (event) => {
      if (this.eventSource !== eventSource) {
        return;
      }

      const messageEvent = event as MessageEvent<string>;
      this.handleObservableEvent(messageEvent.data);
    });
  }

  async stop(
    options: {
      resetMetrics?: boolean;
    } = {},
  ): Promise<void> {
    this.closeEventSource();
    this.clearFlushTimer();
    this.rootStore.observableAnimationStore.clearAll({ snapToTarget: true });

    try {
      await this.applyQueue;
      await this.flushIndexNow();
      this.rootStore.observableAnimationStore.clearAll({ snapToTarget: true });
    } finally {
      runInAction(() => {
        this.status = 'idle';
        this.isStreaming = false;
        this.errorMessage = null;

        if (options.resetMetrics) {
          this.receivedEventCount = 0;
          this.receivedMutationCount = 0;
          this.appliedDirtyIdCount = 0;
          this.flushCount = 0;
          this.lastFlushDurationMs = 0;
        }
      });
    }
  }

  async resetForDatasetReload(): Promise<void> {
    await this.stop({ resetMetrics: true });
  }

  dispose(): void {
    this.closeEventSource();
    this.clearFlushTimer();
    this.rootStore.observableAnimationStore.clearAll({ snapToTarget: false });

    runInAction(() => {
      this.status = 'idle';
      this.isStreaming = false;
      this.errorMessage = null;
    });
  }

  private handleObservableEvent(data: string): void {
    let parsed: ObservableMutationMessage;

    try {
      parsed = JSON.parse(data) as ObservableMutationMessage;
    } catch {
      runInAction(() => {
        this.status = 'error';
        this.errorMessage = 'Не удалось распарсить observable SSE сообщение';
      });
      return;
    }

    const normalizedMessage = normalizeObservableMutationMessage(parsed);

    if (countMutations(normalizedMessage) === 0) {
      return;
    }

    const nextSeq = this.streamSeq + 1;
    this.streamSeq = nextSeq;

    this.applyQueue = this.applyQueue
      .then(async () => {
        const applyResult = await this.rootStore.clusterStore.applyObservableStreamMessage(
          normalizedMessage,
          nextSeq,
          this.settings.sampleLongTimeMs,
        );

        runInAction(() => {
          this.receivedEventCount += 1;
          this.receivedMutationCount += countMutations(normalizedMessage);
          this.appliedDirtyIdCount += applyResult.dirtyIds;
          this.status = 'open';
          this.errorMessage = null;
        });

        this.scheduleIndexFlush();
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.status = 'error';
          this.errorMessage =
            error instanceof Error ? error.message : 'Не удалось применить observable SSE сообщение';
        });
      });
  }

  private scheduleIndexFlush(): void {
    if (this.flushTimer !== null) {
      return;
    }

    const delayMs = this.rootStore.observableAnimationStore.hasActiveAnimations ? LIVE_INDEX_FLUSH_DELAY_MS : 0;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flushIndexNow();
    }, delayMs);
  }

  private async flushIndexNow(): Promise<void> {
    if (this.isFlushingIndex) {
      this.flushRequestedWhileBusy = true;
      return;
    }

    this.isFlushingIndex = true;

    try {
      await this.applyQueue;
      const result = await this.rootStore.clusterStore.flushLiveIndex();

      runInAction(() => {
        if (result.didRebuild) {
          this.flushCount += 1;
          this.lastFlushDurationMs = result.indexBuildDurationMs;
        }
      });
    } finally {
      this.isFlushingIndex = false;

      if (this.flushRequestedWhileBusy) {
        this.flushRequestedWhileBusy = false;
        this.scheduleIndexFlush();
      }
    }
  }

  private clearFlushTimer(): void {
    if (this.flushTimer === null) {
      return;
    }

    window.clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private closeEventSource(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}
