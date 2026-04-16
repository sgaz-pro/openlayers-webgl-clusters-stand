import { createContext, useContext } from 'react';
import { ClusterStore } from './ClusterStore';
import { DatasetStore } from './DatasetStore';
import { HealthStore } from './HealthStore';
import { ObservableAnimationStore } from './ObservableAnimationStore';
import { ObservableStreamStore } from './ObservableStreamStore';

export class RootStore {
  readonly healthStore: HealthStore;
  readonly datasetStore: DatasetStore;
  readonly clusterStore: ClusterStore;
  readonly observableAnimationStore: ObservableAnimationStore;
  readonly observableStreamStore: ObservableStreamStore;

  constructor() {
    this.healthStore = new HealthStore();
    this.observableAnimationStore = new ObservableAnimationStore(this);
    this.clusterStore = new ClusterStore(this);
    this.datasetStore = new DatasetStore(this);
    this.observableStreamStore = new ObservableStreamStore(this);
  }

  dispose(): void {
    this.healthStore.abort();
    this.datasetStore.abort();
    this.observableStreamStore.dispose();
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
