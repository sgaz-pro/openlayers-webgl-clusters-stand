import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { ConnectionPanel } from '../components/ConnectionPanel';
import { DisplayPanel } from '../components/DisplayPanel';
import { MapView } from '../components/MapView';
import { MetricsPanel } from '../components/MetricsPanel';
import { useRootStore } from '../stores/RootStore';

export const App = observer(function App() {
  const rootStore = useRootStore();
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  useEffect(() => {
    void rootStore.healthStore.checkHealth();

    return () => {
      rootStore.dispose();
    };
  }, [rootStore]);

  return (
    <main className="app-shell">
      <MapView />
      {!isMobilePanelOpen ? (
        <button
          type="button"
          className="mobile-panel-toggle"
          aria-label="Открыть панель управления"
          onClick={() => {
            setIsMobilePanelOpen(true);
          }}
        >
          ☰
        </button>
      ) : null}

      <button
        type="button"
        className={`panel-backdrop${isMobilePanelOpen ? ' is-visible' : ''}`}
        aria-label="Закрыть панель"
        onClick={() => {
          setIsMobilePanelOpen(false);
        }}
      />

      <aside className={`control-panel${isMobilePanelOpen ? ' is-open' : ''}`}>
        <div className="control-panel__surface">
          <div className="control-panel__actions">
            <button
              type="button"
              className="control-panel__close"
              aria-label="Закрыть панель управления"
              onClick={() => {
                setIsMobilePanelOpen(false);
              }}
            >
              ×
            </button>
          </div>

          <div className="control-panel__scroll">
            <details className="panel-section" open>
              <summary>Параметры сервера и подключения</summary>
              <div className="panel-section__body">
                <ConnectionPanel
                  onConnect={() => {
                    setIsMobilePanelOpen(false);
                  }}
                />
              </div>
            </details>

            <details className="panel-section" open>
              <summary>Параметры отображения</summary>
              <div className="panel-section__body">
                <DisplayPanel />
              </div>
            </details>

            <details className="panel-section" open>
              <summary>Метрики</summary>
              <div className="panel-section__body">
                <MetricsPanel />
              </div>
            </details>
          </div>
        </div>
      </aside>
    </main>
  );
});
