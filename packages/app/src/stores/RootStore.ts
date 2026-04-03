import { createContext, useContext } from 'react';
import { ClusterStore } from './ClusterStore';
import { DatasetStore } from './DatasetStore';

export class RootStore {
  readonly datasetStore: DatasetStore;
  readonly clusterStore: ClusterStore;

  constructor() {
    this.clusterStore = new ClusterStore(this);
    this.datasetStore = new DatasetStore(this);
  }

  dispose(): void {
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

