import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { makeAutoObservable } from 'mobx';
import type { PointCategory } from '@shared/points';
import type { VisibleItem } from '@shared/worker';

export type VisiblePointItem = Extract<VisibleItem, { kind: 'point' }>;
export type ObservableLabelStyle = 'default' | 'muted' | 'selected';

function isVisiblePointItem(item: VisibleItem): item is VisiblePointItem {
  return item.kind === 'point';
}

export class ObservableModel {
  readonly id: string;
  readonly name: string;
  readonly category: PointCategory;
  readonly weight: number;
  readonly stackSize: number;
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
}

export function createObservableModels(items: readonly VisibleItem[]): ObservableModel[] {
  return items.filter(isVisiblePointItem).map((item) => new ObservableModel(item));
}
