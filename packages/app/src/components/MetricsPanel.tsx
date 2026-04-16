import { observer } from 'mobx-react-lite';
import { formatBytes, formatDuration, formatProgress } from '../app/formatters';
import { useRootStore } from '../stores/RootStore';

export const MetricsPanel = observer(function MetricsPanel() {
  const { datasetStore, clusterStore, observableAnimationStore, observableStreamStore } = useRootStore();

  const metrics = [
    {
      label: 'Фаза',
      value: datasetStore.phase,
    },
    {
      label: 'Загружено точек',
      value: datasetStore.countLoaded.toLocaleString(),
    },
    {
      label: 'Прогресс загрузки',
      value:
        datasetStore.phase === 'idle'
          ? 'Ожидает ручного подключения'
          : formatProgress(
              datasetStore.downloadedBytes,
              datasetStore.totalBytes,
              datasetStore.downloadProgressRatio,
              datasetStore.downloadDurationMs,
            ),
    },
    {
      label: 'Время загрузки',
      value: formatDuration(datasetStore.downloadDurationMs),
    },
    {
      label: 'Парсинг JSON',
      value: formatDuration(datasetStore.parseDurationMs),
    },
    {
      label: 'Построение индекса',
      value: formatDuration(clusterStore.indexBuildDurationMs),
    },
    {
      label: 'Последний cluster query',
      value: formatDuration(clusterStore.lastClusterQueryDurationMs),
    },
    {
      label: 'Видимых кластеров',
      value: clusterStore.visibleClusters.toLocaleString(),
    },
    {
      label: 'Видимых точек',
      value: clusterStore.visibleLeafPoints.toLocaleString(),
    },
    {
      label: 'Кластеров с наложением',
      value: clusterStore.visibleStackedClusters.toLocaleString(),
    },
    {
      label: 'Макс. размер стека',
      value: clusterStore.visibleMaxStackSize.toLocaleString(),
    },
    {
      label: 'Подписей на карте',
      value: clusterStore.renderedLabels.toLocaleString(),
    },
    {
      label: 'Активных анимаций',
      value: observableAnimationStore.activeAnimationCount.toLocaleString(),
    },
    {
      label: 'Текущий zoom',
      value: clusterStore.currentZoom.toFixed(2),
    },
    {
      label: 'SSE статус',
      value: observableStreamStore.status,
    },
    {
      label: 'SSE событий',
      value: observableStreamStore.receivedEventCount.toLocaleString(),
    },
    {
      label: 'SSE мутаций',
      value: observableStreamStore.receivedMutationCount.toLocaleString(),
    },
    {
      label: 'Dirty id применено',
      value: observableStreamStore.appliedDirtyIdCount.toLocaleString(),
    },
    {
      label: 'Flush индекса',
      value: observableStreamStore.flushCount.toLocaleString(),
    },
    {
      label: 'Последний flush',
      value: formatDuration(observableStreamStore.lastFlushDurationMs),
    },
    {
      label: 'Скачанные байты',
      value: datasetStore.totalBytes
        ? `${formatBytes(datasetStore.downloadedBytes)} / ${formatBytes(datasetStore.totalBytes)}`
        : formatBytes(datasetStore.downloadedBytes),
    },
  ];

  return (
    <div className="section-stack">
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <h3>{metric.label}</h3>
            <p>{metric.value}</p>
          </article>
        ))}
      </div>

      {datasetStore.errorMessage ? <div className="panel-error">{datasetStore.errorMessage}</div> : null}
      {observableStreamStore.errorMessage ? <div className="panel-error">{observableStreamStore.errorMessage}</div> : null}
    </div>
  );
});
