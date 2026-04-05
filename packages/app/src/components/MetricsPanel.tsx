import { observer } from 'mobx-react-lite';
import { formatBytes, formatDuration, formatProgress } from '../app/formatters';
import { useRootStore } from '../stores/RootStore';

export const MetricsPanel = observer(function MetricsPanel() {
  const { datasetStore, clusterStore } = useRootStore();

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
      label: 'Подписей на карте',
      value: clusterStore.renderedLabels.toLocaleString(),
    },
    {
      label: 'Текущий zoom',
      value: clusterStore.currentZoom.toFixed(2),
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
    </div>
  );
});
