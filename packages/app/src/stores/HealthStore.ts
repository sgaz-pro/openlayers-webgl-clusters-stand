import { makeAutoObservable, runInAction } from 'mobx';
import { fetchHealth } from '../api/fetchHealth';

export type HealthStatus = 'idle' | 'checking' | 'ok' | 'error';

export class HealthStore {
  status: HealthStatus = 'idle';
  uptimeSeconds = 0;
  serverNow: string | null = null;
  latencyMs = 0;
  lastCheckedAt: string | null = null;
  errorMessage: string | null = null;

  private abortController: AbortController | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isChecking(): boolean {
    return this.status === 'checking';
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async checkHealth(): Promise<void> {
    this.abort();

    const abortController = new AbortController();
    const startedAt = performance.now();
    this.abortController = abortController;

    runInAction(() => {
      this.status = 'checking';
      this.errorMessage = null;
    });

    try {
      const payload = await fetchHealth(abortController.signal);

      if (this.abortController !== abortController) {
        return;
      }

      runInAction(() => {
        this.status = 'ok';
        this.uptimeSeconds = payload.uptimeSeconds;
        this.serverNow = payload.now;
        this.latencyMs = performance.now() - startedAt;
        this.lastCheckedAt = new Date().toISOString();
        this.errorMessage = null;
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      runInAction(() => {
        this.status = 'error';
        this.uptimeSeconds = 0;
        this.serverNow = null;
        this.latencyMs = performance.now() - startedAt;
        this.lastCheckedAt = new Date().toISOString();
        this.errorMessage = error instanceof Error ? error.message : 'Unknown health check error';
      });
    } finally {
      if (this.abortController === abortController) {
        this.abortController = null;
      }
    }
  }
}
