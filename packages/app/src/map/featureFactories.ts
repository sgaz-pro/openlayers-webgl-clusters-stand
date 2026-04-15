import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import type { VisibleItem } from '@shared/worker';
import type { ObservableModel } from '../models/ObservableModel';

export function createClusterFeature(item: Extract<VisibleItem, { kind: 'cluster' }>): Feature<Point> {
  const feature = new Feature({
    geometry: new Point(fromLonLat([item.lon, item.lat])),
    kind: item.kind,
  });

  feature.setProperties({
    clusterId: item.clusterId,
    pointCount: item.pointCount,
    hasStackedPoints: item.hasStackedPoints,
    stackedPointCount: item.stackedPointCount,
    maxStackSize: item.maxStackSize,
  });

  return feature;
}

export function createObservableFeature(observable: ObservableModel): Feature<Point> {
  const feature = new Feature({
    geometry: new Point(fromLonLat([observable.lon, observable.lat])),
    kind: 'point',
    observableId: observable.id,
    observable,
  });

  feature.setId(observable.id);
  feature.set('weight', observable.weight);
  return feature;
}
