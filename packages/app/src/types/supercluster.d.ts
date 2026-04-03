declare module 'supercluster' {
  import type { Feature, Point } from 'geojson';

  export interface SuperclusterOptions {
    minZoom?: number;
    maxZoom?: number;
    minPoints?: number;
    radius?: number;
    extent?: number;
    nodeSize?: number;
    log?: boolean;
    generateId?: boolean;
  }

  export interface ClusterFeatureProperties {
    cluster: true;
    cluster_id: number;
    point_count: number;
    point_count_abbreviated: number | string;
  }

  export default class Supercluster<P = Record<string, unknown>, C = Record<string, unknown>> {
    constructor(options?: SuperclusterOptions);
    load(points: Array<Feature<Point, P>>): this;
    getClusters(
      bbox: [number, number, number, number],
      zoom: number,
    ): Array<Feature<Point, P | (C & ClusterFeatureProperties)>>;
    getClusterExpansionZoom(clusterId: number): number;
  }
}
