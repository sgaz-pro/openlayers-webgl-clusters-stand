import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import type { VisibleItem } from '@shared/worker';

export function createVisibleFeature(item: VisibleItem): Feature<Point> {
  const feature = new Feature({
    geometry: new Point(fromLonLat([item.lon, item.lat])),
    kind: item.kind,
  });

  if (item.kind === 'cluster') {
    feature.setProperties({
      clusterId: item.clusterId,
      pointCount: item.pointCount,
      hasStackedPoints: item.hasStackedPoints,
      stackedPointCount: item.stackedPointCount,
      maxStackSize: item.maxStackSize,
    });
  } else {
    feature.setId(item.id);
    feature.setProperties({
      name: item.name,
      category: item.category,
      weight: item.weight,
      stackSize: item.stackSize,
    });
  }

  return feature;
}

export function createLabelFeatures(items: readonly VisibleItem[]): Feature<Point>[] {
  const seenCoordinates = new Set<string>();

  return items
    .filter((item): item is Extract<VisibleItem, { kind: 'point' }> => item.kind === 'point')
    .filter((item) => {
      const coordinateKey = `${item.lon},${item.lat}`;

      if (item.stackSize <= 1 || !seenCoordinates.has(coordinateKey)) {
        seenCoordinates.add(coordinateKey);
        return true;
      }

      return false;
    })
    .map((item) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([item.lon, item.lat])),
        labelText: item.stackSize > 1 ? `${item.name} x${item.stackSize}` : item.name,
      });

      feature.setId(`label-${item.id}`);
      feature.set('weight', item.weight);
      return feature;
    });
}
