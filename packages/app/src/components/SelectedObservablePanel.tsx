import { observer } from 'mobx-react-lite';
import { useRootStore } from '../stores/RootStore';

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export const SelectedObservablePanel = observer(function SelectedObservablePanel() {
  const { clusterStore } = useRootStore();
  const selectedObservable = clusterStore.selectedObservable;

  return (
    <div className="section-stack">
      <section className="status-card">
        <div className="info-grid">
          <div>
            <dt>Имя</dt>
            <dd>{selectedObservable?.name ?? 'Ничего не выбрано'}</dd>
          </div>
          <div>
            <dt>Координаты</dt>
            <dd>
              {selectedObservable
                ? `${formatCoordinate(selectedObservable.lon)}, ${formatCoordinate(selectedObservable.lat)}`
                : '—'}
            </dd>
          </div>
        </div>

        {!selectedObservable ? (
          <p className="panel-note">Кликните по иконке или подписи на карте, чтобы выделить observable.</p>
        ) : null}

        <div className="connection-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!selectedObservable}
            onClick={() => {
              clusterStore.clearObservableSelection();
            }}
          >
            Снять выделение
          </button>
        </div>
      </section>
    </div>
  );
});
