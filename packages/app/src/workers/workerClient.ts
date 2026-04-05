import type {
  BuildIndexResponse,
  BuildIndexProgressResponse,
  ClusterIndexOptions,
  GetExpansionZoomResponse,
  QueryClustersResponse,
  WorkerRequest,
  WorkerResponse,
} from '@shared/worker';
import type { LonLatBbox } from '@shared/points';

interface PendingRequest {
  resolve: (payload: any) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (message: WorkerResponse) => void;
}

export class SuperclusterWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<string, PendingRequest>();
  private requestSequence = 0;

  constructor() {
    this.worker = new Worker(new URL('./supercluster.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const pendingRequest = this.pending.get(message.requestId);

      if (!pendingRequest) {
        return;
      }

      if (message.type === 'build-index:progress') {
        pendingRequest.onProgress?.(message);
        return;
      }

      this.pending.delete(message.requestId);

      if (message.type === 'error') {
        pendingRequest.reject(new Error(message.payload.message));
        return;
      }

      pendingRequest.resolve(message.payload);
    };

    this.worker.onerror = (event) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message);

      for (const pendingRequest of this.pending.values()) {
        pendingRequest.reject(error);
      }

      this.pending.clear();
    };
  }

  private postRequest<TPayload>(
    message: Omit<WorkerRequest, 'requestId'>,
    options?: {
      onProgress?: (message: WorkerResponse) => void;
      transfer?: Transferable[];
    },
  ): Promise<TPayload> {
    const requestId = `req-${this.requestSequence}`;
    this.requestSequence += 1;
    const request = {
      ...message,
      requestId,
    } as WorkerRequest;

    return new Promise<TPayload>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress: options?.onProgress });
      this.worker.postMessage(request, options?.transfer ?? []);
    });
  }

  buildIndex(
    jsonBuffer: ArrayBuffer,
    options: ClusterIndexOptions,
    onProgress?: (payload: BuildIndexProgressResponse['payload']) => void,
  ): Promise<BuildIndexResponse['payload']> {
    return this.postRequest(
      {
        type: 'build-index',
        payload: { jsonBuffer, options },
      },
      {
        onProgress: (message) => {
          if (message.type === 'build-index:progress') {
            onProgress?.(message.payload);
          }
        },
        transfer: [jsonBuffer],
      },
    );
  }

  queryClusters(bbox: LonLatBbox, zoom: number): Promise<QueryClustersResponse['payload']> {
    return this.postRequest({
      type: 'query-clusters',
      payload: { bbox, zoom },
    });
  }

  getExpansionZoom(clusterId: number): Promise<GetExpansionZoomResponse['payload']> {
    return this.postRequest({
      type: 'get-expansion-zoom',
      payload: { clusterId },
    });
  }

  terminate(): void {
    this.worker.terminate();

    for (const pendingRequest of this.pending.values()) {
      pendingRequest.reject(new Error('Worker terminated'));
    }

    this.pending.clear();
  }
}
