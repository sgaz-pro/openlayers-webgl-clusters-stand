import { observer } from 'mobx-react-lite';
import { formatBytes, formatDuration, formatProgress } from '../app/formatters';
import { useRootStore } from '../stores/RootStore';

export const DebugPanel = observer(function DebugPanel() {
  const { datasetStore, clusterStore } = useRootStore();

  return (
    <aside className="debug-panel">
      <div className="panel-header">
        <h2>Debug Panel</h2>
        <span className={`phase phase-${datasetStore.phase}`}>{datasetStore.phase}</span>
      </div>

      <dl className="stats-grid">
        <div>
          <dt>count loaded</dt>
          <dd>{datasetStore.countLoaded.toLocaleString()}</dd>
        </div>

        <div>
          <dt>download progress</dt>
          <dd>
            {datasetStore.phase === 'idle'
              ? 'waiting for manual connect'
              : formatProgress(
                  datasetStore.downloadedBytes,
                  datasetStore.totalBytes,
                  datasetStore.downloadProgressRatio,
                )}
          </dd>
        </div>

        <div>
          <dt>parse duration</dt>
          <dd>{formatDuration(datasetStore.parseDurationMs)}</dd>
        </div>

        <div>
          <dt>index build duration</dt>
          <dd>{formatDuration(clusterStore.indexBuildDurationMs)}</dd>
        </div>

        <div>
          <dt>last cluster query duration</dt>
          <dd>{formatDuration(clusterStore.lastClusterQueryDurationMs)}</dd>
        </div>

        <div>
          <dt>visible clusters</dt>
          <dd>{clusterStore.visibleClusters.toLocaleString()}</dd>
        </div>

        <div>
          <dt>visible leaf points</dt>
          <dd>{clusterStore.visibleLeafPoints.toLocaleString()}</dd>
        </div>

        <div>
          <dt>rendered labels</dt>
          <dd>{clusterStore.renderedLabels.toLocaleString()}</dd>
        </div>

        <div>
          <dt>current zoom</dt>
          <dd>{clusterStore.currentZoom.toFixed(2)}</dd>
        </div>

        <div>
          <dt>downloaded bytes</dt>
          <dd>
            {formatBytes(datasetStore.downloadedBytes)}
            {datasetStore.totalBytes !== null ? ` / ${formatBytes(datasetStore.totalBytes)}` : ''}
          </dd>
        </div>
      </dl>

      {datasetStore.errorMessage ? <p className="error-copy">{datasetStore.errorMessage}</p> : null}
    </aside>
  );
});
