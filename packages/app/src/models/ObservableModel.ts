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
  readonly lon: number;
  readonly lat: number;
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

    makeAutoObservable(this, {}, { autoBind: true });
  }

  get labelText(): string {
    return this.name;
  }

  get isLabelVisible(): boolean {
    return true;
  }

  useDefaultLabelStyle(): void {
    this.labelStyle = 'default';
  }

  useMutedLabelStyle(): void {
    this.labelStyle = 'muted';
  }

  useSelectedLabelStyle(): void {
    this.labelStyle = 'selected';
  }
}

export function createObservableModels(items: readonly VisibleItem[]): ObservableModel[] {
  return items.filter(isVisiblePointItem).map((item) => new ObservableModel(item));
}
