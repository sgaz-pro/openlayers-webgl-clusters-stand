import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import type { VisibleItem } from '@shared/worker';
import { LABEL_ZOOM_THRESHOLD, MAX_LABELS } from '../constants';

export function createVisibleFeature(item: VisibleItem): Feature<Point> {
  const feature = new Feature({
    geometry: new Point(fromLonLat([item.lon, item.lat])),
    kind: item.kind,
  });

  if (item.kind === 'cluster') {
    feature.setProperties({
      clusterId: item.clusterId,
      pointCount: item.pointCount,
    });
  } else {
    feature.setId(item.id);
    feature.setProperties({
      name: item.name,
      category: item.category,
      weight: item.weight,
    });
  }

  return feature;
}

export function createLabelFeatures(items: readonly VisibleItem[], zoom: number): Feature<Point>[] {
  if (zoom < LABEL_ZOOM_THRESHOLD) {
    return [];
  }

  return items
    .filter((item): item is Extract<VisibleItem, { kind: 'point' }> => item.kind === 'point')
    .sort((left, right) => right.weight - left.weight)
    .slice(0, MAX_LABELS)
    .map((item) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([item.lon, item.lat])),
        labelText: item.name,
      });

      feature.setId(`label-${item.id}`);
      feature.set('weight', item.weight);
      return feature;
    });
}

