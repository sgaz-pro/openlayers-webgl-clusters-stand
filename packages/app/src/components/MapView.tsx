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
import { INITIAL_VIEW } from '../constants';
import { createVisibleFeature, createLabelFeatures } from '../map/featureFactories';
import { createClusterPointsLayer, createLabelLayer } from '../map/layers';
import { useRootStore } from '../stores/RootStore';

function toLonLatBbox(extent: number[]): LonLatBbox {
  const [west, south, east, north] = extent as [number, number, number, number];
  return [west, south, east, north];
}

export const MapView = observer(function MapView() {
  const { clusterStore, datasetStore } = useRootStore();
  const visibleItems = clusterStore.visibleItems;
  const currentZoom = clusterStore.currentZoom;
  const indexRevision = clusterStore.indexRevision;
  const phase = datasetStore.phase;
  const errorMessage = datasetStore.errorMessage;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const pointsSourceRef = useRef<VectorSource<Feature<Point>> | null>(null);
  const labelsSourceRef = useRef<VectorSource<Feature<Point>> | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const pointsSource = new VectorSource<Feature<Point>>();
    const labelsSource = new VectorSource<Feature<Point>>();
    pointsSourceRef.current = pointsSource;
    labelsSourceRef.current = labelsSource;

    const map = new Map({
      target: containerRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
          zIndex: 0,
        }),
        createClusterPointsLayer(pointsSource),
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

      const bbox = toLonLatBbox(transformExtent(view.calculateExtent(size), 'EPSG:3857', 'EPSG:4326'));
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
      pointsSourceRef.current = null;
      labelsSourceRef.current = null;
    };
  }, [clusterStore]);

  useEffect(() => {
    const pointsSource = pointsSourceRef.current;
    const labelsSource = labelsSourceRef.current;

    if (!pointsSource || !labelsSource) {
      return;
    }

    pointsSource.clear(true);
    labelsSource.clear(true);

    if (visibleItems.length > 0) {
      pointsSource.addFeatures(visibleItems.map(createVisibleFeature));
    }

    const labelFeatures = createLabelFeatures(visibleItems, currentZoom);

    if (labelFeatures.length > 0) {
      labelsSource.addFeatures(labelFeatures);
    }

    clusterStore.setRenderedLabels(labelFeatures.length);
  }, [clusterStore, currentZoom, visibleItems]);

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

    const bbox = toLonLatBbox(transformExtent(view.calculateExtent(size), 'EPSG:3857', 'EPSG:4326'));
    void clusterStore.queryClusters(bbox, zoom);
  }, [clusterStore, indexRevision, phase]);

  return (
    <section className="map-card">
      <div ref={containerRef} className="map-root" />
      <div className="map-overlay">
        <div className="overlay-chip">EPSG:3857 / OSM / WebGL points</div>
        {phase !== 'ready' ? <div className="overlay-status">phase: {phase}</div> : null}
        {phase === 'idle' ? <div className="overlay-status">Нажмите «Подключиться», чтобы запустить загрузку</div> : null}
        {errorMessage ? <div className="overlay-error">{errorMessage}</div> : null}
      </div>
    </section>
  );
});
