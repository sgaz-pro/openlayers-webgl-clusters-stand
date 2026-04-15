import { makeAutoObservable, runInAction } from 'mobx';
import type { ObservableData } from '@shared/points';
import type { RootStore } from './RootStore';
import type { ObservableModel } from '../models/ObservableModel';

interface ObservableMotion {
  id: string;
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
  startedAtMs: number;
  endsAtMs: number;
  streamSeq: number;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

export class ObservableAnimationStore {
  activeAnimationCount = 0;

  private readonly motionById = new Map<string, ObservableMotion>();
  private readonly visibleModelById = new Map<string, ObservableModel>();
  private frameHandle: number | null = null;

  constructor(_rootStore: RootStore) {
    makeAutoObservable(
      this,
      {
        motionById: false,
        visibleModelById: false,
        frameHandle: false,
      } as any,
      { autoBind: true },
    );
  }

  get hasActiveAnimations(): boolean {
    return this.activeAnimationCount > 0;
  }

  isAnimating(id: string): boolean {
    return this.motionById.has(id);
  }

  bindVisibleObservables(observables: readonly ObservableModel[]): void {
    const nextIds = new Set(observables.map((observable) => observable.id));

    for (const id of this.visibleModelById.keys()) {
      if (!nextIds.has(id)) {
        this.visibleModelById.delete(id);
      }
    }

    const now = performance.now();

    for (const observable of observables) {
      this.visibleModelById.set(observable.id, observable);
      const motion = this.motionById.get(observable.id);

      if (!motion) {
        continue;
      }

      observable.moveToLonLat(this.getMotionPosition(motion, now));
    }
  }

  startOrRetargetObservable(
    id: string,
    fallbackCurrentLonLat: [number, number],
    target: ObservableData,
    durationMs: number,
    streamSeq: number,
  ): void {
    const now = performance.now();
    const existingMotion = this.motionById.get(id);

    if (existingMotion && existingMotion.streamSeq > streamSeq) {
      return;
    }

    const [fromLon, fromLat] = existingMotion
      ? this.getMotionPosition(existingMotion, now)
      : fallbackCurrentLonLat;

    if (durationMs <= 0 || (fromLon === target.lon && fromLat === target.lat)) {
      const visibleModel = this.visibleModelById.get(id);

      if (visibleModel) {
        visibleModel.moveToLonLat([target.lon, target.lat]);
      }

      this.motionById.delete(id);
      this.syncActiveAnimationCount();
      this.maybeStopFrameLoop();
      return;
    }

    this.motionById.set(id, {
      id,
      fromLon,
      fromLat,
      toLon: target.lon,
      toLat: target.lat,
      startedAtMs: now,
      endsAtMs: now + durationMs,
      streamSeq,
    });
    this.syncActiveAnimationCount();

    const visibleModel = this.visibleModelById.get(id);

    if (visibleModel) {
      visibleModel.moveToLonLat([fromLon, fromLat]);
    }

    this.ensureFrameLoop();
  }

  removeObservable(
    id: string,
    options: {
      snapToTarget?: boolean;
    } = {},
  ): void {
    const motion = this.motionById.get(id);

    if (motion && options.snapToTarget !== false) {
      const visibleModel = this.visibleModelById.get(id);

      if (visibleModel) {
        visibleModel.moveToLonLat([motion.toLon, motion.toLat]);
      }
    }

    this.motionById.delete(id);
    this.visibleModelById.delete(id);
    this.syncActiveAnimationCount();
    this.maybeStopFrameLoop();
  }

  clearAll(
    options: {
      snapToTarget?: boolean;
    } = {},
  ): void {
    if (options.snapToTarget !== false) {
      for (const [id, motion] of this.motionById.entries()) {
        const visibleModel = this.visibleModelById.get(id);

        if (!visibleModel) {
          continue;
        }

        visibleModel.moveToLonLat([motion.toLon, motion.toLat]);
      }
    }

    this.motionById.clear();
    this.visibleModelById.clear();
    this.syncActiveAnimationCount();
    this.maybeStopFrameLoop();
  }

  private ensureFrameLoop(): void {
    if (this.frameHandle !== null) {
      return;
    }

    this.frameHandle = window.requestAnimationFrame(this.handleFrame);
  }

  private maybeStopFrameLoop(): void {
    if (this.motionById.size > 0 || this.frameHandle === null) {
      return;
    }

    window.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private handleFrame(now: number): void {
    this.frameHandle = null;

    if (this.motionById.size === 0) {
      this.syncActiveAnimationCount();
      return;
    }

    for (const [id, motion] of this.motionById.entries()) {
      const visibleModel = this.visibleModelById.get(id);

      if (now >= motion.endsAtMs) {
        if (visibleModel) {
          visibleModel.moveToLonLat([motion.toLon, motion.toLat]);
        }

        this.motionById.delete(id);
        continue;
      }

      if (visibleModel) {
        visibleModel.moveToLonLat(this.getMotionPosition(motion, now));
      }
    }

    this.syncActiveAnimationCount();

    if (this.motionById.size > 0) {
      this.frameHandle = window.requestAnimationFrame(this.handleFrame);
    }
  }

  private getMotionPosition(motion: ObservableMotion, now: number): [number, number] {
    const durationMs = Math.max(1, motion.endsAtMs - motion.startedAtMs);
    const progress = Math.max(0, Math.min(1, (now - motion.startedAtMs) / durationMs));

    return [
      interpolate(motion.fromLon, motion.toLon, progress),
      interpolate(motion.fromLat, motion.toLat, progress),
    ];
  }

  private syncActiveAnimationCount(): void {
    runInAction(() => {
      this.activeAnimationCount = this.motionById.size;
    });
  }
}
