import { observer } from 'mobx-react-lite';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DEFAULT_CLUSTER_DISPLAY_SETTINGS,
  INITIAL_VIEW,
  type ClusterDisplaySettings,
} from '../constants';
import { useRootStore } from '../stores/RootStore';

interface ClusterSettingsFormState {
  radius: string;
  minZoom: string;
  maxZoom: string;
  minPoints: string;
  extent: string;
  nodeSize: string;
  denseClusterRevealViewZoom: string;
}

function toFormState(settings: ClusterDisplaySettings): ClusterSettingsFormState {
  return {
    radius: String(settings.radius),
    minZoom: String(settings.minZoom),
    maxZoom: String(settings.maxZoom),
    minPoints: String(settings.minPoints),
    extent: String(settings.extent),
    nodeSize: String(settings.nodeSize),
    denseClusterRevealViewZoom: String(settings.denseClusterRevealViewZoom),
  };
}

function clampInteger(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function sanitizeSettings(formState: ClusterSettingsFormState): ClusterDisplaySettings {
  const minZoom = clampInteger(
    formState.minZoom,
    DEFAULT_CLUSTER_DISPLAY_SETTINGS.minZoom,
    0,
    INITIAL_VIEW.maxZoom,
  );
  const maxZoom = clampInteger(
    formState.maxZoom,
    DEFAULT_CLUSTER_DISPLAY_SETTINGS.maxZoom,
    minZoom,
    INITIAL_VIEW.maxZoom,
  );

  return {
    radius: clampInteger(formState.radius, DEFAULT_CLUSTER_DISPLAY_SETTINGS.radius, 1, 512),
    minZoom,
    maxZoom,
    minPoints: clampInteger(formState.minPoints, DEFAULT_CLUSTER_DISPLAY_SETTINGS.minPoints, 1, 64),
    extent: clampInteger(formState.extent, DEFAULT_CLUSTER_DISPLAY_SETTINGS.extent, 128, 4096),
    nodeSize: clampInteger(formState.nodeSize, DEFAULT_CLUSTER_DISPLAY_SETTINGS.nodeSize, 1, 256),
    denseClusterRevealViewZoom: clampInteger(
      formState.denseClusterRevealViewZoom,
      DEFAULT_CLUSTER_DISPLAY_SETTINGS.denseClusterRevealViewZoom,
      Math.max(INITIAL_VIEW.minZoom, minZoom),
      INITIAL_VIEW.maxZoom - 1,
    ),
  };
}

export const DisplayPanel = observer(function DisplayPanel() {
  const { clusterStore, datasetStore } = useRootStore();
  const [formState, setFormState] = useState<ClusterSettingsFormState>(() => toFormState(clusterStore.settings));

  useEffect(() => {
    setFormState(toFormState(clusterStore.settings));
  }, [clusterStore.settings]);

  const isDisabled = datasetStore.isBusy || clusterStore.isApplyingSettings;

  const handleChange =
    (field: keyof ClusterSettingsFormState) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setFormState((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const nextSettings = sanitizeSettings(formState);
    setFormState(toFormState(nextSettings));
    void clusterStore.applySettings(nextSettings);
  };

  return (
    <form className="section-stack" onSubmit={handleSubmit}>
      <div className="display-form-grid">
        <label className="form-field" htmlFor="cluster-radius">
          <span>radius</span>
          <input
            id="cluster-radius"
            type="number"
            min={1}
            max={512}
            step={1}
            inputMode="numeric"
            value={formState.radius}
            disabled={isDisabled}
            onChange={handleChange('radius')}
          />
        </label>

        <label className="form-field" htmlFor="cluster-min-zoom">
          <span>minZoom</span>
          <input
            id="cluster-min-zoom"
            type="number"
            min={0}
            max={INITIAL_VIEW.maxZoom}
            step={1}
            inputMode="numeric"
            value={formState.minZoom}
            disabled={isDisabled}
            onChange={handleChange('minZoom')}
          />
        </label>

        <label className="form-field" htmlFor="cluster-max-zoom">
          <span>maxZoom</span>
          <input
            id="cluster-max-zoom"
            type="number"
            min={0}
            max={INITIAL_VIEW.maxZoom}
            step={1}
            inputMode="numeric"
            value={formState.maxZoom}
            disabled={isDisabled}
            onChange={handleChange('maxZoom')}
          />
        </label>

        <label className="form-field" htmlFor="cluster-min-points">
          <span>minPoints</span>
          <input
            id="cluster-min-points"
            type="number"
            min={1}
            max={64}
            step={1}
            inputMode="numeric"
            value={formState.minPoints}
            disabled={isDisabled}
            onChange={handleChange('minPoints')}
          />
        </label>

        <label className="form-field" htmlFor="cluster-extent">
          <span>extent</span>
          <input
            id="cluster-extent"
            type="number"
            min={128}
            max={4096}
            step={1}
            inputMode="numeric"
            value={formState.extent}
            disabled={isDisabled}
            onChange={handleChange('extent')}
          />
        </label>

        <label className="form-field" htmlFor="cluster-node-size">
          <span>nodeSize</span>
          <input
            id="cluster-node-size"
            type="number"
            min={1}
            max={256}
            step={1}
            inputMode="numeric"
            value={formState.nodeSize}
            disabled={isDisabled}
            onChange={handleChange('nodeSize')}
          />
        </label>

        <label className="form-field" htmlFor="cluster-dense-reveal-zoom">
          <span>denseRevealViewZoom</span>
          <input
            id="cluster-dense-reveal-zoom"
            type="number"
            min={INITIAL_VIEW.minZoom}
            max={INITIAL_VIEW.maxZoom - 1}
            step={1}
            inputMode="numeric"
            value={formState.denseClusterRevealViewZoom}
            disabled={isDisabled}
            onChange={handleChange('denseClusterRevealViewZoom')}
          />
        </label>
      </div>

      <div className="connection-actions">
        <button type="submit" disabled={isDisabled}>
          {clusterStore.isApplyingSettings ? 'Применение…' : 'Применить'}
        </button>
      </div>

      {clusterStore.settingsError ? <div className="panel-error">{clusterStore.settingsError}</div> : null}
    </form>
  );
});
