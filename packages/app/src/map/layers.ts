import type Feature from 'ol/Feature.js';
import type Point from 'ol/geom/Point.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorLayer from 'ol/layer/Vector.js';
import type VectorSource from 'ol/source/Vector.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import Text from 'ol/style/Text.js';

const CATEGORY_FILL_MATCH = [
  'match',
  ['get', 'category'],
  'restaurant',
  '#f97316',
  'transit',
  '#2563eb',
  'office',
  '#1d4ed8',
  'school',
  '#eab308',
  'park',
  '#22c55e',
  'retail',
  '#ec4899',
  'healthcare',
  '#ef4444',
  'warehouse',
  '#64748b',
  '#0f766e',
] as const;

const WEBGL_STYLE = {
  'circle-radius': [
    'case',
    ['==', ['get', 'kind'], 'cluster'],
    [
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
    ['interpolate', ['linear'], ['get', 'weight'], 1, 4, 20, 6, 60, 9, 120, 12],
  ],
  'circle-fill-color': [
    'case',
    ['==', ['get', 'kind'], 'cluster'],
    '#0ea5e9',
    CATEGORY_FILL_MATCH,
  ],
  'circle-opacity': [
    'case',
    ['==', ['get', 'kind'], 'cluster'],
    0.92,
    0.7,
  ],
  'circle-stroke-color': [
    'case',
    ['==', ['get', 'kind'], 'cluster'],
    '#f8fafc',
    '#0f172a',
  ],
  'circle-stroke-width': [
    'case',
    ['==', ['get', 'kind'], 'cluster'],
    2,
    1,
  ],
};

const labelStyleCache = new Map<string, Style>();

export function createClusterPointsLayer(source: VectorSource<Feature<Point>>) {
  return new WebGLPointsLayer({
    source,
    style: WEBGL_STYLE,
    zIndex: 20,
  });
}

export function createLabelLayer(source: VectorSource<Feature<Point>>) {
  return new VectorLayer({
    source,
    declutter: true,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 30,
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
          font: '600 12px "IBM Plex Sans", "Segoe UI", sans-serif',
          padding: [3, 5, 3, 5],
          overflow: false,
          fill: new Fill({ color: '#f8fafc' }),
          backgroundFill: new Fill({ color: 'rgba(15, 23, 42, 0.78)' }),
          backgroundStroke: new Stroke({ color: 'rgba(248, 250, 252, 0.18)', width: 1 }),
          offsetY: -16,
        }),
      });

      labelStyleCache.set(labelText, style);
      return style;
    },
  });
}
