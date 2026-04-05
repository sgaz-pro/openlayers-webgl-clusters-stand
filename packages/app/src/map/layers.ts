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
  'circle-fill-color': '#2563eb',
  'circle-opacity': 0.88,
  'circle-stroke-color': '#ffffff',
  'circle-stroke-width': 2,
};

const labelStyleCache = new Map<string, Style>();
const pointIconStyleCache = new Map<PointCategory, Style>();

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

export function createClusterLayer(source: VectorSource<Feature<Point>>) {
  return new WebGLPointsLayer<VectorSource<FeatureLike>>({
    source: source as unknown as VectorSource<FeatureLike>,
    style: CLUSTER_STYLE,
    zIndex: 20,
  });
}

export function createPointIconLayer(source: VectorSource<Feature<Point>>) {
  return new VectorLayer({
    source,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 24,
    style(feature) {
      const category = feature.get('category') as PointCategory | undefined;

      if (!category) {
        return undefined;
      }

      return getPointIconStyle(category);
    },
  });
}

export function createLabelLayer(source: VectorSource<Feature<Point>>) {
  return new VectorLayer({
    source,
    declutter: false,
    renderBuffer: LABEL_RENDER_BUFFER_PX,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 26,
    style(feature) {
      const labelText = feature.get('labelText') as string | undefined;

      if (!labelText) {
        return undefined;
      }

      const cached = labelStyleCache.get(labelText);

      if (cached) {
        return cached;
      }

      const style = new Style({
        text: new Text({
          text: labelText,
          font: '500 11px sans-serif',
          textAlign: 'left',
          textBaseline: 'middle',
          padding: [2, 4, 2, 4],
          overflow: true,
          fill: new Fill({ color: '#0f172a' }),
          backgroundFill: new Fill({ color: 'rgba(255, 255, 255, 0.8)' }),
          backgroundStroke: new Stroke({ color: 'rgba(15, 23, 42, 0.16)', width: 1 }),
          offsetX: 15,
        }),
      });

      labelStyleCache.set(labelText, style);
      return style;
    },
  });
}
