import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { ConnectionPanel } from '../components/ConnectionPanel';
import { DebugPanel } from '../components/DebugPanel';
import { MapView } from '../components/MapView';
import { useRootStore } from '../stores/RootStore';

export const App = observer(function App() {
  const rootStore = useRootStore();

  useEffect(() => {
    return () => {
      rootStore.dispose();
    };
  }, [rootStore]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Monorepo demo</p>
          <h1>OpenLayers + Supercluster with controlled startup</h1>
          <p className="hero-text">
            Можно выбирать между глобальным смешанным датасетом и плотным промышленным кластером.
            В обоих режимах данные приходят одним GET-запросом, JSON разбирается на main thread,
            а <code>supercluster</code> строит индекс в Web Worker.
          </p>
        </div>

        <ConnectionPanel />
      </section>

      <section className="workspace-grid">
        <MapView />
        <DebugPanel />
      </section>
    </main>
  );
});
