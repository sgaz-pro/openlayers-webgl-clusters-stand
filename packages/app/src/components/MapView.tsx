import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import type Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import { transformExtent } from 'ol/proj.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import type { LonLatBbox } from '@shared/points';
import type { VisibleItem } from '@shared/worker';
import { FREE_LABEL_ZOOM_THRESHOLD, INITIAL_VIEW, LABEL_QUERY_PADDING_RATIO } from '../constants';
import { createVisibleFeature, createLabelFeatures } from '../map/featureFactories';
import { createClusterLayer, createLabelLayer, createPointIconLayer } from '../map/layers';
import { useRootStore } from '../stores/RootStore';

function toLonLatBbox(extent: number[]): LonLatBbox {
  const [west, south, east, north] = extent as [number, number, number, number];
  return [west, south, east, north];
}

function padBbox([west, south, east, north]: LonLatBbox, ratio: number): LonLatBbox {
  const lonPadding = (east - west) * ratio;
  const latPadding = (north - south) * ratio;

  return [west - lonPadding, south - latPadding, east + lonPadding, north + latPadding];
}

function getQueryBbox(extent: number[], zoom: number): LonLatBbox {
  const bbox = toLonLatBbox(transformExtent(extent, 'EPSG:3857', 'EPSG:4326'));

  if (zoom >= FREE_LABEL_ZOOM_THRESHOLD) {
    return padBbox(bbox, LABEL_QUERY_PADDING_RATIO);
  }

  return bbox;
}

function isClusterItem(item: VisibleItem): item is Extract<VisibleItem, { kind: 'cluster' }> {
  return item.kind === 'cluster';
}

function isPointItem(item: VisibleItem): item is Extract<VisibleItem, { kind: 'point' }> {
  return item.kind === 'point';
}

export const MapView = observer(function MapView() {
  const { clusterStore, datasetStore } = useRootStore();
  const visibleItems = clusterStore.visibleItems;
  const indexRevision = clusterStore.indexRevision;
  const visibleStackedClusters = clusterStore.visibleStackedClusters;
  const visibleMaxStackSize = clusterStore.visibleMaxStackSize;
  const phase = datasetStore.phase;
  const errorMessage = datasetStore.errorMessage;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const clusterSourceRef = useRef<VectorSource<Feature<Point>> | null>(null);
  const pointSourceRef = useRef<VectorSource<Feature<Point>> | null>(null);
  const labelsSourceRef = useRef<VectorSource<Feature<Point>> | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const clusterSource = new VectorSource<Feature<Point>>();
    const pointSource = new VectorSource<Feature<Point>>();
    const labelsSource = new VectorSource<Feature<Point>>();
    clusterSourceRef.current = clusterSource;
    pointSourceRef.current = pointSource;
    labelsSourceRef.current = labelsSource;

    const map = new Map({
      target: containerRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
          zIndex: 0,
        }),
        createClusterLayer(clusterSource),
        createPointIconLayer(pointSource),
        createLabelLayer(labelsSource),
      ],
      view: new View({
        center: fromLonLat(INITIAL_VIEW.center),
        zoom: INITIAL_VIEW.zoom,
        minZoom: INITIAL_VIEW.minZoom,
        maxZoom: INITIAL_VIEW.maxZoom,
      }),
    });

    mapRef.current = map;
    clusterStore.setCurrentZoom(map.getView().getZoom() ?? INITIAL_VIEW.zoom);

    const runClusterQuery = async (): Promise<void> => {
      const size = map.getSize();

      if (!size) {
        return;
      }

      const view = map.getView();
      const zoom = view.getZoom() ?? INITIAL_VIEW.zoom;
      clusterStore.setCurrentZoom(zoom);

      if (!clusterStore.isIndexReady) {
        return;
      }

      const bbox = getQueryBbox(view.calculateExtent(size), zoom);
      await clusterStore.queryClusters(bbox, zoom);
    };

    const handleMoveEnd = (): void => {
      void runClusterQuery();
    };

    const handleSingleClick = (event: { pixel: number[] }): void => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (hitFeature) => hitFeature as Feature<Point> | undefined);

      if (!feature || feature.get('kind') !== 'cluster') {
        return;
      }

      const geometry = feature.getGeometry();
      const clusterId = feature.get('clusterId') as number | undefined;

      if (!geometry || typeof clusterId !== 'number') {
        return;
      }

      void clusterStore.getExpansionZoom(clusterId).then((zoom) => {
        map.getView().animate({
          center: geometry.getCoordinates(),
          zoom,
          duration: 320,
        });
      });
    };

    map.on('moveend', handleMoveEnd);
    map.on('singleclick', handleSingleClick);

    return () => {
      map.un('moveend', handleMoveEnd);
      map.un('singleclick', handleSingleClick);
      map.setTarget(undefined);
      mapRef.current = null;
      clusterSourceRef.current = null;
      pointSourceRef.current = null;
      labelsSourceRef.current = null;
    };
  }, [clusterStore]);

  useEffect(() => {
    const clusterSource = clusterSourceRef.current;
    const pointSource = pointSourceRef.current;
    const labelsSource = labelsSourceRef.current;

    if (!clusterSource || !pointSource || !labelsSource) {
      return;
    }

    clusterSource.clear(true);
    pointSource.clear(true);
    labelsSource.clear(true);

    if (visibleItems.length > 0) {
      clusterSource.addFeatures(visibleItems.filter(isClusterItem).map(createVisibleFeature));
      pointSource.addFeatures(visibleItems.filter(isPointItem).map(createVisibleFeature));
    }

    const labelFeatures = createLabelFeatures(visibleItems);

    if (labelFeatures.length > 0) {
      labelsSource.addFeatures(labelFeatures);
    }

    clusterStore.setRenderedLabels(labelFeatures.length);
  }, [clusterStore, visibleItems]);

  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }

    const map = mapRef.current;

    if (!map) {
      return;
    }

    const size = map.getSize();

    if (!size) {
      return;
    }

    const view = map.getView();
    const zoom = view.getZoom() ?? INITIAL_VIEW.zoom;
    clusterStore.setCurrentZoom(zoom);

    const bbox = getQueryBbox(view.calculateExtent(size), zoom);
    void clusterStore.queryClusters(bbox, zoom);
  }, [clusterStore, indexRevision, phase]);

  return (
    <section className="map-card">
      <div ref={containerRef} className="map-root" />
      <div className="map-overlay">
        <div className="overlay-chip">EPSG:3857 / OSM / SVG point icons</div>
        {phase === 'ready' && visibleStackedClusters > 0 ? (
          <div className="overlay-chip">
            Оранжевые кластеры содержат точки с одинаковыми координатами, max stack x{visibleMaxStackSize}
          </div>
        ) : null}
        {phase === 'ready' && visibleStackedClusters === 0 && visibleMaxStackSize > 1 ? (
          <div className="overlay-chip">
            В текущем окне уже видны совпадающие координаты, max stack x{visibleMaxStackSize}
          </div>
        ) : null}
        {phase !== 'ready' ? <div className="overlay-status">phase: {phase}</div> : null}
        {phase === 'idle' ? <div className="overlay-status">Нажмите «Подключиться», чтобы запустить загрузку</div> : null}
        {errorMessage ? <div className="overlay-error">{errorMessage}</div> : null}
      </div>
    </section>
  );
});
