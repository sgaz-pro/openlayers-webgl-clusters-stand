import { observer } from 'mobx-react-lite';
import { useState, type FormEvent } from 'react';
import type { DatasetMode } from '@shared/points';
import {
  DATASET_MODE_OPTIONS,
  DEFAULT_DATASET_QUERY,
  DEFAULT_OBSERVABLE_STREAM_SETTINGS,
} from '../constants';
import { formatDuration, formatProgress } from '../app/formatters';
import { useRootStore } from '../stores/RootStore';

const MIN_OBSERVABLE_COUNT = 1;
const MAX_OBSERVABLE_COUNT = 250_000;
const MIN_SAMPLE_MAX_COUNT = 1;
const MAX_SAMPLE_MAX_COUNT = 10_000;
const MIN_SAMPLE_LONG_TIME_MS = 100;
const MAX_SAMPLE_LONG_TIME_MS = 60_000;
const MIN_SAMPLE_BETWEEN_DELAY_MS = 0;
const MAX_SAMPLE_BETWEEN_DELAY_MS = 60_000;

function clampIntegerInput(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function clampObservableCount(value: string): number {
  return clampIntegerInput(value, DEFAULT_DATASET_QUERY.count, MIN_OBSERVABLE_COUNT, MAX_OBSERVABLE_COUNT);
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
  const { datasetStore, healthStore, observableStreamStore } = useRootStore();
  const [observableCountInput, setObservableCountInput] = useState(String(DEFAULT_DATASET_QUERY.count));
  const [datasetModeInput, setDatasetModeInput] = useState<DatasetMode>(DEFAULT_DATASET_QUERY.mode);
  const [sampleMaxCountInput, setSampleMaxCountInput] = useState(String(DEFAULT_OBSERVABLE_STREAM_SETTINGS.sampleMaxCount));
  const [sampleLongTimeInput, setSampleLongTimeInput] = useState(String(DEFAULT_OBSERVABLE_STREAM_SETTINGS.sampleLongTimeMs));
  const [sampleBetweenDelayInput, setSampleBetweenDelayInput] = useState(
    String(DEFAULT_OBSERVABLE_STREAM_SETTINGS.sampleBetweenDelayMs),
  );
  const selectedModeDescription = DATASET_MODE_OPTIONS.find(
    (option) => option.value === datasetModeInput,
  )?.description ?? '';

  const count = clampObservableCount(observableCountInput);
  const sampleMaxCount = clampIntegerInput(
    sampleMaxCountInput,
    DEFAULT_OBSERVABLE_STREAM_SETTINGS.sampleMaxCount,
    MIN_SAMPLE_MAX_COUNT,
    MAX_SAMPLE_MAX_COUNT,
  );
  const sampleLongTimeMs = clampIntegerInput(
    sampleLongTimeInput,
    DEFAULT_OBSERVABLE_STREAM_SETTINGS.sampleLongTimeMs,
    MIN_SAMPLE_LONG_TIME_MS,
    MAX_SAMPLE_LONG_TIME_MS,
  );
  const sampleBetweenDelayMs = clampIntegerInput(
    sampleBetweenDelayInput,
    DEFAULT_OBSERVABLE_STREAM_SETTINGS.sampleBetweenDelayMs,
    MIN_SAMPLE_BETWEEN_DELAY_MS,
    MAX_SAMPLE_BETWEEN_DELAY_MS,
  );
  const isSseControlsDisabled = datasetStore.isBusy || observableStreamStore.isStreaming;
  const isSseButtonDisabled = (!observableStreamStore.isStreaming && datasetStore.phase !== 'ready') || datasetStore.isBusy;

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

  const handleSseToggle = (): void => {
    const nextSettings = {
      sampleMaxCount,
      sampleLongTimeMs,
      sampleBetweenDelayMs,
    };

    setSampleMaxCountInput(String(sampleMaxCount));
    setSampleLongTimeInput(String(sampleLongTimeMs));
    setSampleBetweenDelayInput(String(sampleBetweenDelayMs));
    observableStreamStore.updateSettings(nextSettings);

    if (observableStreamStore.isStreaming) {
      void observableStreamStore.stop();
      return;
    }

    observableStreamStore.start();
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
            {datasetStore.isBusy ? 'Инициализация…' : 'Инициализировать Observable'}
          </button>
        </div>

        <hr className="section-divider" />

        <label className="form-field" htmlFor="sample-max-count">
          <span>Максимум observable в sample</span>
          <input
            id="sample-max-count"
            type="number"
            min={MIN_SAMPLE_MAX_COUNT}
            max={MAX_SAMPLE_MAX_COUNT}
            step={1}
            inputMode="numeric"
            value={sampleMaxCountInput}
            disabled={isSseControlsDisabled}
            onChange={(event) => {
              setSampleMaxCountInput(event.target.value);
            }}
          />
        </label>

        <label className="form-field" htmlFor="sample-long-time">
          <span>SAMPLE_LONG_TIME, мс</span>
          <input
            id="sample-long-time"
            type="number"
            min={MIN_SAMPLE_LONG_TIME_MS}
            max={MAX_SAMPLE_LONG_TIME_MS}
            step={100}
            inputMode="numeric"
            value={sampleLongTimeInput}
            disabled={isSseControlsDisabled}
            onChange={(event) => {
              setSampleLongTimeInput(event.target.value);
            }}
          />
        </label>

        <label className="form-field" htmlFor="sample-between-delay">
          <span>SAMPLE_BETWEEN_DELAY, мс</span>
          <input
            id="sample-between-delay"
            type="number"
            min={MIN_SAMPLE_BETWEEN_DELAY_MS}
            max={MAX_SAMPLE_BETWEEN_DELAY_MS}
            step={100}
            inputMode="numeric"
            value={sampleBetweenDelayInput}
            disabled={isSseControlsDisabled}
            onChange={(event) => {
              setSampleBetweenDelayInput(event.target.value);
            }}
          />
        </label>

        <div className="connection-actions">
          <button type="button" disabled={isSseButtonDisabled} onClick={handleSseToggle}>
            {observableStreamStore.isStreaming
              ? 'Отключиться от SSE потока обновлений'
              : 'Запустить SSE поток обновлений'}
          </button>
        </div>

        <p className="panel-note">
          SSE status: {observableStreamStore.status}
          {observableStreamStore.errorMessage ? `, ${observableStreamStore.errorMessage}` : ''}
        </p>
      </form>
    </div>
  );
});
