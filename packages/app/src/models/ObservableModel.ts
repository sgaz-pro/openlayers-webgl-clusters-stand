import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { makeAutoObservable } from 'mobx';
import type { ObservableData, PointCategory } from '@shared/points';
import type { VisibleItem } from '@shared/worker';

export type VisiblePointItem = Extract<VisibleItem, { kind: 'point' }>;
export type ObservableLabelStyle = 'default' | 'muted' | 'selected';

function isVisiblePointItem(item: VisibleItem): item is VisiblePointItem {
  return item.kind === 'point';
}

export class ObservableModel {
  readonly id: string;
  name: string;
  category: PointCategory;
  weight: number;
  stackSize: number;
  readonly feature: Feature<Point>;
  lon: number;
  lat: number;
  labelStyle: ObservableLabelStyle;

  constructor(item: VisiblePointItem) {
    this.id = item.id;
    this.name = item.name;
    this.category = item.category;
    this.weight = item.weight;
    this.stackSize = item.stackSize;
    this.lon = item.lon;
    this.lat = item.lat;
    this.labelStyle = 'default';
    this.feature = new Feature({
      geometry: new Point(fromLonLat([this.lon, this.lat])),
      kind: 'point',
      observableId: this.id,
      observable: this,
    });

    this.feature.setId(this.id);
    this.feature.set('weight', this.weight);

    makeAutoObservable(this, { feature: false }, { autoBind: true });
  }

  get labelText(): string {
    return this.name;
  }

  get isLabelVisible(): boolean {
    return true;
  }

  useDefaultLabelStyle(): void {
    this.updateLabelStyle('default');
  }

  useMutedLabelStyle(): void {
    this.updateLabelStyle('muted');
  }

  useSelectedLabelStyle(): void {
    this.updateLabelStyle('selected');
  }

  syncFromVisibleItem(
    item: VisiblePointItem,
    options: {
      preserveCoordinate?: boolean;
    } = {},
  ): void {
    this.syncFromObservableData(item, options);
    this.updateStackSize(item.stackSize);
  }

  syncFromObservableData(
    observable: ObservableData,
    options: {
      preserveCoordinate?: boolean;
    } = {},
  ): void {
    let shouldRefreshFeature = false;

    if (this.name !== observable.name) {
      this.name = observable.name;
      shouldRefreshFeature = true;
    }

    if (this.category !== observable.category) {
      this.category = observable.category;
      shouldRefreshFeature = true;
    }

    if (this.weight !== observable.weight) {
      this.weight = observable.weight;
      this.feature.set('weight', observable.weight);
      shouldRefreshFeature = true;
    }

    if (!options.preserveCoordinate) {
      this.moveToLonLat([observable.lon, observable.lat]);
    }

    if (shouldRefreshFeature) {
      this.feature.changed();
    }
  }

  moveToLonLat([lon, lat]: [number, number]): void {
    if (this.lon === lon && this.lat === lat) {
      return;
    }

    this.lon = lon;
    this.lat = lat;
    this.feature.getGeometry()?.setCoordinates(fromLonLat([lon, lat]));
    this.feature.changed();
  }

  private updateLabelStyle(nextStyle: ObservableLabelStyle): void {
    if (this.labelStyle === nextStyle) {
      return;
    }

    this.labelStyle = nextStyle;
    this.feature.changed();
  }

  private updateStackSize(nextStackSize: number): void {
    if (this.stackSize === nextStackSize) {
      return;
    }

    this.stackSize = nextStackSize;
    this.feature.changed();
  }
}

export function createObservableModels(items: readonly VisibleItem[]): ObservableModel[] {
  return items.filter(isVisiblePointItem).map((item) => new ObservableModel(item));
}
