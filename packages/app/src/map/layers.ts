import type Feature from 'ol/Feature.js';
import type { FeatureLike } from 'ol/Feature.js';
import type Point from 'ol/geom/Point.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorLayer from 'ol/layer/Vector.js';
import type VectorSource from 'ol/source/Vector.js';
import Fill from 'ol/style/Fill.js';
import Icon from 'ol/style/Icon.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import Text from 'ol/style/Text.js';
import type { PointCategory } from '@shared/points';
import { LABEL_RENDER_BUFFER_PX } from '../constants';
import type { ObservableLabelStyle, ObservableModel } from '../models/ObservableModel';
import { POINT_ICON_COLORS, POINT_ICON_URLS } from './icons';

const CLUSTER_STYLE = {
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['get', 'pointCount'],
    2,
    10,
    20,
    14,
    100,
    20,
    1000,
    28,
    10000,
    38,
  ],
  'circle-fill-color': ['case', ['>', ['get', 'stackedPointCount'], 0], '#f59e0b', '#2563eb'],
  'circle-opacity': 0.88,
  'circle-stroke-color': ['case', ['>', ['get', 'stackedPointCount'], 0], '#7c2d12', '#ffffff'],
  'circle-stroke-width': ['case', ['>', ['get', 'stackedPointCount'], 0], 3, 2],
};

const clusterCountStyleCache = new Map<string, Style>();
const pointIconStyleCache = new Map<PointCategory, Style>();
const observableLabelStyleCache = new Map<string, Style>();
const observableStyleCache = new Map<string, Style[]>();

const LABEL_STYLES: Record<
  ObservableLabelStyle,
  {
    font: string;
    fillColor: string;
    backgroundFillColor: string;
    backgroundStrokeColor: string;
  }
> = {
  default: {
    font: '500 11px sans-serif',
    fillColor: 'rgba(15, 23, 42, 1)',
    backgroundFillColor: 'rgba(255, 255, 255, 0.8)',
    backgroundStrokeColor: 'rgba(15, 23, 42, 0.16)',
  },
  muted: {
    font: '500 11px sans-serif',
    fillColor: 'rgba(15, 23, 42, 0.48)',
    backgroundFillColor: 'rgba(255, 255, 255, 0.4)',
    backgroundStrokeColor: 'rgba(15, 23, 42, 0.08)',
  },
  selected: {
    font: '700 11px sans-serif',
    fillColor: 'rgba(15, 23, 42, 1)',
    backgroundFillColor: 'rgba(255, 255, 255, 0.96)',
    backgroundStrokeColor: 'rgba(15, 23, 42, 0.28)',
  },
};

function getPointIconStyle(category: PointCategory): Style {
  const cached = pointIconStyleCache.get(category);

  if (cached) {
    return cached;
  }

  const style = new Style({
    image: new Icon({
      src: POINT_ICON_URLS[category],
      color: POINT_ICON_COLORS[category],
      scale: 1,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    }),
  });

  pointIconStyleCache.set(category, style);
  return style;
}

function getLabelStyle(labelText: string, labelStyle: ObservableLabelStyle): Style {
  const cacheKey = `${labelStyle}:${labelText}`;
  const cached = observableLabelStyleCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const labelPalette = LABEL_STYLES[labelStyle];
  const style = new Style({
    text: new Text({
      text: labelText,
      font: labelPalette.font,
      textAlign: 'left',
      textBaseline: 'middle',
      padding: [2, 4, 2, 4],
      overflow: true,
      fill: new Fill({ color: labelPalette.fillColor }),
      backgroundFill: new Fill({ color: labelPalette.backgroundFillColor }),
      backgroundStroke: new Stroke({ color: labelPalette.backgroundStrokeColor, width: 1 }),
      offsetX: 15,
    }),
  });

  observableLabelStyleCache.set(cacheKey, style);
  return style;
}

function getObservableStyles(observable: ObservableModel): Style[] {
  const cacheKey = `${observable.category}:${observable.labelStyle}:${observable.labelText}`;
  const cached = observableStyleCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const styles = [getPointIconStyle(observable.category), getLabelStyle(observable.labelText, observable.labelStyle)];

  observableStyleCache.set(cacheKey, styles);
  return styles;
}

export function createClusterLayer(source: VectorSource<Feature<Point>>) {
  return new WebGLPointsLayer<VectorSource<FeatureLike>>({
    source: source as unknown as VectorSource<FeatureLike>,
    style: CLUSTER_STYLE,
    zIndex: 20,
  });
}

export function createClusterCountLayer(source: VectorSource<Feature<Point>>) {
  return new VectorLayer({
    source,
    declutter: false,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 22,
    style(feature) {
      const pointCount = feature.get('pointCount') as number | undefined;

      if (!pointCount) {
        return undefined;
      }

      const labelText = String(pointCount);
      const cached = clusterCountStyleCache.get(labelText);

      if (cached) {
        return cached;
      }

      const style = new Style({
        text: new Text({
          text: labelText,
          font: '700 12px sans-serif',
          textAlign: 'center',
          textBaseline: 'middle',
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.55)', width: 3 }),
          overflow: true,
        }),
      });

      clusterCountStyleCache.set(labelText, style);
      return style;
    },
  });
}

export function createObservableLayer(source: VectorSource<Feature<Point>>) {
  return new VectorLayer({
    source,
    declutter: false,
    renderBuffer: LABEL_RENDER_BUFFER_PX,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 24,
    style(feature) {
      const observable = feature.get('observable') as ObservableModel | undefined;

      if (!observable) {
        return undefined;
      }

      return getObservableStyles(observable);
    },
  });
}
