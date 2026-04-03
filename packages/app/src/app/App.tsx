import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { DebugPanel } from '../components/DebugPanel';
import { MapView } from '../components/MapView';
import { DEFAULT_DATASET_QUERY } from '../constants';
import { useRootStore } from '../stores/RootStore';

export const App = observer(function App() {
  const rootStore = useRootStore();
  const { datasetStore } = rootStore;

  useEffect(() => {
    void datasetStore.loadDataset(DEFAULT_DATASET_QUERY);

    return () => {
      rootStore.dispose();
    };
  }, [datasetStore, rootStore]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Monorepo demo</p>
          <h1>OpenLayers + Supercluster on 100k synthetic points</h1>
          <p className="hero-text">
            One GET request loads the dataset, parsing happens on the main thread, and supercluster
            indexing stays isolated in a Web Worker. The map only re-queries on <code>moveend</code>,
            so panning remains fluid even when the dataset is large.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="reload-button"
            disabled={datasetStore.isBusy}
            onClick={() => {
              void datasetStore.loadDataset(datasetStore.query);
            }}
          >
            {datasetStore.isBusy ? 'Loading dataset…' : 'Reload 100k points'}
          </button>
          <p className="request-hint">GET /api/points?count=100000&amp;seed=42&amp;mode=mixed</p>
        </div>
      </section>

      <section className="workspace-grid">
        <MapView />
        <DebugPanel />
      </section>
    </main>
  );
});

