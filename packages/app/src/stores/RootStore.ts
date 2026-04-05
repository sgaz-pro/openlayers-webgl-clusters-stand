import { createContext, useContext } from 'react';
import { ClusterStore } from './ClusterStore';
import { DatasetStore } from './DatasetStore';
import { HealthStore } from './HealthStore';

export class RootStore {
  readonly healthStore: HealthStore;
  readonly datasetStore: DatasetStore;
  readonly clusterStore: ClusterStore;

  constructor() {
    this.healthStore = new HealthStore();
    this.clusterStore = new ClusterStore(this);
    this.datasetStore = new DatasetStore(this);
  }

  dispose(): void {
    this.healthStore.abort();
    this.datasetStore.abort();
    this.clusterStore.dispose();
  }
}

export const StoreContext = createContext<RootStore | null>(null);

export function useRootStore(): RootStore {
  const store = useContext(StoreContext);

  if (!store) {
    throw new Error('RootStore is not available in React context');
  }

  return store;
}
