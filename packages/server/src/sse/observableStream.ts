import type { ServerResponse } from 'node:http';
import type {
  ObservableData,
  ObservableIdentity,
  ObservableMutationMessage,
  ObservableStreamQuery,
} from '../../../../shared/points.js';
import { generatePointsDataset } from '../generators/syntheticDataset.js';
import { createRandomSource } from '../generators/prng.js';

const KEEP_ALIVE_INTERVAL_MS = 15_000;
const MAX_EVENT_SPLIT = 12;
const OBSERVABLE_SSE_EVENT = 'observable';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createSseHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream; charset=utf-8',
  };
}

function writeEvent(response: ServerResponse, eventName: string, payload: unknown): void {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeComment(response: ServerResponse, value: string): void {
  response.write(`: ${value}\n\n`);
}

function pickUniqueItems<T>(items: readonly T[], count: number, random: () => number): T[] {
  const actualCount = Math.max(0, Math.min(count, items.length));

  if (actualCount === 0) {
    return [];
  }

  const selectedIndexes = new Set<number>();

  while (selectedIndexes.size < actualCount) {
    selectedIndexes.add(Math.floor(random() * items.length));
  }

  return Array.from(selectedIndexes, (index) => items[index]).filter((item): item is T => item !== undefined);
}

function createUpdatedObservable(source: ObservableData, nextLabelRevision: number, random: () => number): ObservableData {
  const lon = clamp(source.lon + (random() - 0.5) * 0.16, -180, 180);
  const lat = clamp(source.lat + (random() - 0.5) * 0.12, -85, 85);
  const nextWeight = clamp(Math.round(source.weight + (random() - 0.5) * 4), 1, 99);
  const shouldRelabel = random() < 0.18;

  return {
    ...source,
    lon,
    lat,
    weight: nextWeight,
    name: shouldRelabel ? `${source.name} #${nextLabelRevision}` : source.name,
  };
}

function createInsertedObservable(source: ObservableData, nextId: number, random: () => number): ObservableData {
  const lon = clamp(source.lon + (random() - 0.5) * 0.4, -180, 180);
  const lat = clamp(source.lat + (random() - 0.5) * 0.3, -85, 85);

  return {
    ...source,
    id: `sse-${nextId}`,
    lon,
    lat,
    name: `${source.name} live ${nextId}`,
    weight: clamp(Math.round(source.weight + (random() - 0.5) * 8), 1, 99),
  };
}

function createObservableMutationMessage(
  observableById: Map<string, ObservableData>,
  nextIdRef: { current: number },
  nextLabelRevisionRef: { current: number },
  sampleMaxCount: number,
  random: () => number,
): ObservableMutationMessage {
  const existingObservables = Array.from(observableById.values());
  const existingIds = existingObservables.map((observable) => observable.id);
  const maxChanges = Math.max(1, Math.min(sampleMaxCount, Math.max(existingObservables.length, 1)));
  const totalChanges = Math.max(1, Math.ceil(random() * maxChanges));

  const plannedInsertCount = existingObservables.length === 0 ? totalChanges : Math.floor(totalChanges * 0.12 * random());
  const plannedDeleteCount = existingObservables.length <= 1 ? 0 : Math.floor(totalChanges * 0.08 * random());
  const updateCount = Math.max(0, totalChanges - plannedInsertCount - plannedDeleteCount);

  const updateTargets = pickUniqueItems(existingObservables, updateCount, random);
  const blockedIds = new Set(updateTargets.map((observable) => observable.id));
  const deleteCandidates = existingIds.filter((id) => !blockedIds.has(id));
  const deleteIds = pickUniqueItems(deleteCandidates, plannedDeleteCount, random);
  const insertSources = pickUniqueItems(existingObservables, plannedInsertCount, random);

  const update = updateTargets.map((observable) => {
    nextLabelRevisionRef.current += 1;
    const nextObservable = createUpdatedObservable(observable, nextLabelRevisionRef.current, random);
    observableById.set(nextObservable.id, nextObservable);
    return nextObservable;
  });

  const insert = insertSources.map((observable) => {
    nextIdRef.current += 1;
    const nextObservable = createInsertedObservable(observable, nextIdRef.current, random);
    observableById.set(nextObservable.id, nextObservable);
    return nextObservable;
  });

  const deleted: ObservableIdentity[] = [];

  for (const id of deleteIds) {
    if (!observableById.has(id)) {
      continue;
    }

    observableById.delete(id);
    deleted.push({ id });
  }

  return {
    insert,
    update,
    delete: deleted,
  };
}

export function openObservableStream(response: ServerResponse, query: ObservableStreamQuery): () => void {
  const observableById = new Map(
    generatePointsDataset(query).points.map((observable) => [observable.id, { ...observable }] as const),
  );
  const rng = createRandomSource(query.seed + query.count * 17);
  const nextIdRef = { current: query.count };
  const nextLabelRevisionRef = { current: 0 };
  const eventCountPerSample = clamp(Math.round(query.sampleLongTimeMs / 125), 1, MAX_EVENT_SPLIT);
  const sampleEventDelayMs = Math.max(0, Math.floor(query.sampleLongTimeMs / eventCountPerSample));

  let isClosed = false;
  let sampleTimer: ReturnType<typeof setTimeout> | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const clearTimers = (): void => {
    if (sampleTimer) {
      clearTimeout(sampleTimer);
      sampleTimer = null;
    }

    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  };

  const cleanup = (): void => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    clearTimers();
    response.end();
  };

  const scheduleNextSample = (delayMs: number): void => {
    if (isClosed) {
      return;
    }

    sampleTimer = setTimeout(() => {
      sampleTimer = null;
      runSample();
    }, delayMs);
  };

  const runSample = (): void => {
    if (isClosed) {
      return;
    }

    const emitEvent = (index: number): void => {
      if (isClosed) {
        return;
      }

      const message = createObservableMutationMessage(
        observableById,
        nextIdRef,
        nextLabelRevisionRef,
        Math.max(1, Math.floor(query.sampleMaxCount / eventCountPerSample)),
        () => rng.next(),
      );

      if (message.insert.length > 0 || message.update.length > 0 || message.delete.length > 0) {
        writeEvent(response, OBSERVABLE_SSE_EVENT, message);
      }

      if (index >= eventCountPerSample - 1) {
        scheduleNextSample(query.sampleBetweenDelayMs);
        return;
      }

      scheduleNextEvent(index + 1);
    };

    const scheduleNextEvent = (index: number): void => {
      if (isClosed) {
        return;
      }

      sampleTimer = setTimeout(() => {
        sampleTimer = null;
        emitEvent(index);
      }, sampleEventDelayMs);
    };

    emitEvent(0);
  };

  response.writeHead(200, createSseHeaders());
  response.flushHeaders();
  writeComment(response, 'observable stream opened');

  keepAliveTimer = setInterval(() => {
    if (!isClosed) {
      writeComment(response, 'keep-alive');
    }
  }, KEEP_ALIVE_INTERVAL_MS);

  scheduleNextSample(150);
  return cleanup;
}
