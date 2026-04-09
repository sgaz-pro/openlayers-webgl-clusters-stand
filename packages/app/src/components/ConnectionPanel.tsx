import { observer } from 'mobx-react-lite';
import { useState, type FormEvent } from 'react';
import type { DatasetMode } from '@shared/points';
import {
  DATASET_MODE_OPTIONS,
  DEFAULT_DATASET_QUERY,
} from '../constants';
import { formatDuration, formatProgress } from '../app/formatters';
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Ещё не было';
  }

  return new Date(value).toLocaleString('ru-RU');
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 c';
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)} c`;
  }

  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)} мин`;
  }

  return `${(seconds / 3600).toFixed(1)} ч`;
}

function getHealthStatusLabel(status: 'idle' | 'checking' | 'ok' | 'error', errorMessage: string | null): string {
  if (status === 'checking') {
    return 'Проверка...';
  }

  if (status === 'ok') {
    return 'OK';
  }

  if (status === 'error') {
    return errorMessage ?? 'Ошибка';
  }

  return 'Не проверялся';
}

interface ConnectionPanelProps {
  onConnect?: () => void;
}

export const ConnectionPanel = observer(function ConnectionPanel({ onConnect }: ConnectionPanelProps) {
  const { datasetStore, healthStore } = useRootStore();
  const [observableCountInput, setObservableCountInput] = useState(String(DEFAULT_DATASET_QUERY.count));
  const [datasetModeInput, setDatasetModeInput] = useState<DatasetMode>(DEFAULT_DATASET_QUERY.mode);
  const selectedModeDescription = DATASET_MODE_OPTIONS.find(
    (option) => option.value === datasetModeInput,
  )?.description ?? '';

  const count = clampObservableCount(observableCountInput);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    setObservableCountInput(String(count));
    void healthStore.checkHealth();

    void datasetStore.loadDataset({
      ...DEFAULT_DATASET_QUERY,
      count,
      mode: datasetModeInput,
    });

    onConnect?.();
  };

  return (
    <div className="section-stack">
      <section className="status-card">
        <div className="info-grid">
          <div>
            <dt>Health</dt>
            <dd className={`status-text status-text--${healthStore.status}`}>
              {getHealthStatusLabel(healthStore.status, healthStore.errorMessage)}
            </dd>
          </div>
          <div>
            <dt>Ответ</dt>
            <dd>{formatDuration(healthStore.latencyMs)}</dd>
          </div>
          <div>
            <dt>Server time</dt>
            <dd>{formatDateTime(healthStore.serverNow)}</dd>
          </div>
          <div>
            <dt>Uptime</dt>
            <dd>{formatUptime(healthStore.uptimeSeconds)}</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd>{DEFAULT_DATASET_QUERY.seed}</dd>
          </div>
          <div>
            <dt>Последний count</dt>
            <dd>{datasetStore.query.count.toLocaleString()}</dd>
          </div>
        </div>

        <div className="connection-actions">
          <button
            type="button"
            disabled={healthStore.isChecking}
            className="secondary-button"
            onClick={() => {
              void healthStore.checkHealth();
            }}
          >
            Проверить сервер
          </button>
        </div>
      </section>

      <form className="connection-form section-stack" onSubmit={handleSubmit}>
        <label className="form-field" htmlFor="observable-count">
          <span>Количество observable</span>
          <input
            id="observable-count"
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

        <label className="form-field" htmlFor="dataset-mode">
          <span>Режим датасета</span>
          <select
            id="dataset-mode"
            value={datasetModeInput}
            disabled={datasetStore.isBusy}
            onChange={(event) => {
              setDatasetModeInput(event.target.value as DatasetMode);
            }}
          >
            {DATASET_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="placeholder-copy">{selectedModeDescription}</p>
        </label>

        {datasetStore.phase !== 'idle' ? (
          <div className="progress-block">
            <label className="form-field" htmlFor="dataset-progress">
              <span>Загрузка датасета</span>
              <progress
                id="dataset-progress"
                max={100}
                value={
                  datasetStore.phase === 'ready'
                    ? 100
                    : datasetStore.downloadProgressRatio !== null
                      ? Math.max(0, Math.min(100, datasetStore.downloadProgressRatio * 100))
                      : 0
                }
              />
            </label>
            <div className="progress-copy">
              {formatProgress(
                datasetStore.downloadedBytes,
                datasetStore.totalBytes,
                datasetStore.downloadProgressRatio,
                datasetStore.downloadDurationMs,
              )}
            </div>
          </div>
        ) : null}

        <div className="connection-actions">
          <button type="submit" disabled={datasetStore.isBusy}>
            {datasetStore.isBusy ? 'Подключение…' : 'Подключиться'}
          </button>
        </div>
      </form>
    </div>
  );
});
