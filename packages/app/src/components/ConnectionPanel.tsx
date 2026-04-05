import { observer } from 'mobx-react-lite';
import { useMemo, useState, type FormEvent } from 'react';
import { DEFAULT_DATASET_QUERY } from '../constants';
import { useRootStore } from '../stores/RootStore';

const MIN_OBSERVABLE_COUNT = 1;
const MAX_OBSERVABLE_COUNT = 250_000;

function clampObservableCount(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DATASET_QUERY.count;
  }

  return Math.max(MIN_OBSERVABLE_COUNT, Math.min(MAX_OBSERVABLE_COUNT, parsed));
}

export const ConnectionPanel = observer(function ConnectionPanel() {
  const { datasetStore } = useRootStore();
  const [observableCountInput, setObservableCountInput] = useState(String(DEFAULT_DATASET_QUERY.count));

  const requestPreview = useMemo(() => {
    const count = clampObservableCount(observableCountInput);
    return `/api/points?count=${count}&seed=${DEFAULT_DATASET_QUERY.seed}&mode=${DEFAULT_DATASET_QUERY.mode}`;
  }, [observableCountInput]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const count = clampObservableCount(observableCountInput);
    setObservableCountInput(String(count));

    void datasetStore.loadDataset({
      ...DEFAULT_DATASET_QUERY,
      count,
    });
  };

  return (
    <div className="hero-actions">
      <section className="parameter-panel">
        <div className="parameter-panel-header">
          <h2>Параметры</h2>
          <span className={`phase phase-${datasetStore.phase}`}>{datasetStore.phase}</span>
        </div>

        <dl className="parameter-list">
          <div>
            <dt>mode</dt>
            <dd>{DEFAULT_DATASET_QUERY.mode}</dd>
          </div>
          <div>
            <dt>seed</dt>
            <dd>{DEFAULT_DATASET_QUERY.seed}</dd>
          </div>
          <div>
            <dt>последний count</dt>
            <dd>{datasetStore.query.count.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <form className="connection-form" onSubmit={handleSubmit}>
        <label className="connection-field">
          <span>Количество observable</span>
          <input
            type="number"
            min={MIN_OBSERVABLE_COUNT}
            max={MAX_OBSERVABLE_COUNT}
            step={1}
            inputMode="numeric"
            value={observableCountInput}
            disabled={datasetStore.isBusy}
            onChange={(event) => {
              setObservableCountInput(event.target.value);
            }}
          />
        </label>

        <button type="submit" className="connect-button" disabled={datasetStore.isBusy}>
          {datasetStore.isBusy ? 'Подключение…' : 'Подключиться'}
        </button>

        <p className="request-hint">{requestPreview}</p>
      </form>
    </div>
  );
});
