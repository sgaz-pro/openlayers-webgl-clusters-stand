import type { DatasetQuery, PointCategory, PointRecord, PointsApiResponse } from '../../../../shared/points.js';
import { createRandomSource, type RandomSource } from './prng.js';

interface NamedCenter {
  name: string;
  lon: number;
  lat: number;
  spreadKm: number;
  weight: number;
}

interface SparseRegion {
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
  weight: number;
}

interface Corridor {
  name: string;
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
  jitterKm: number;
  weight: number;
}

const URBAN_CENTERS: NamedCenter[] = [
  { name: 'Berlin', lon: 13.405, lat: 52.52, spreadKm: 15, weight: 11 },
  { name: 'Paris', lon: 2.3522, lat: 48.8566, spreadKm: 16, weight: 12 },
  { name: 'London', lon: -0.1278, lat: 51.5072, spreadKm: 18, weight: 13 },
  { name: 'New York', lon: -74.006, lat: 40.7128, spreadKm: 20, weight: 14 },
  { name: 'Tokyo', lon: 139.6917, lat: 35.6895, spreadKm: 22, weight: 15 },
  { name: 'Singapore', lon: 103.8198, lat: 1.3521, spreadKm: 10, weight: 8 },
  { name: 'Moscow', lon: 37.6173, lat: 55.7558, spreadKm: 18, weight: 12 },
  { name: 'Dubai', lon: 55.2708, lat: 25.2048, spreadKm: 13, weight: 8 }
];

const SPARSE_REGIONS: SparseRegion[] = [
  { name: 'Great Plains', west: -104, south: 33, east: -92, north: 44, weight: 8 },
  { name: 'Kazakh Steppe', west: 58, south: 45, east: 76, north: 53, weight: 9 },
  { name: 'Iberian Interior', west: -7.5, south: 38, east: -1.5, north: 42.5, weight: 6 },
  { name: 'Patagonia Fringe', west: -72, south: -48, east: -63, north: -40, weight: 4 },
  { name: 'Western Australia', west: 114, south: -33, east: 123, north: -25, weight: 4 },
  { name: 'Scandinavian North', west: 15, south: 63, east: 28, north: 69, weight: 5 }
];

const CORRIDORS: Corridor[] = [
  { name: 'Northeast Corridor', fromLon: -77.0369, fromLat: 38.9072, toLon: -71.0589, toLat: 42.3601, jitterKm: 12, weight: 10 },
  { name: 'Rhine Axis', fromLon: 6.96, fromLat: 50.94, toLon: 8.6821, toLat: 50.1109, jitterKm: 8, weight: 8 },
  { name: 'Tokyo-Osaka Link', fromLon: 139.6917, fromLat: 35.6895, toLon: 135.5023, toLat: 34.6937, jitterKm: 10, weight: 8 },
  { name: 'Gulf Trade Route', fromLon: 55.2708, fromLat: 25.2048, toLon: 54.3773, toLat: 24.4539, jitterKm: 7, weight: 6 },
  { name: 'Baltic Logistics', fromLon: 24.7536, fromLat: 59.437, toLon: 18.0686, toLat: 59.3293, jitterKm: 7, weight: 5 }
];

const CATEGORIES_BY_SCENARIO = {
  urban: [
    ['restaurant', 16],
    ['transit', 10],
    ['office', 14],
    ['school', 8],
    ['park', 4],
    ['retail', 12],
    ['healthcare', 6],
    ['warehouse', 4],
  ],
  sparse: [
    ['park', 12],
    ['warehouse', 10],
    ['healthcare', 6],
    ['school', 5],
    ['retail', 4],
    ['transit', 5],
    ['office', 3],
    ['restaurant', 3],
  ],
  corridor: [
    ['transit', 16],
    ['warehouse', 14],
    ['retail', 8],
    ['office', 6],
    ['restaurant', 5],
    ['healthcare', 2],
    ['school', 2],
    ['park', 1],
  ],
  noise: [
    ['restaurant', 6],
    ['transit', 6],
    ['office', 6],
    ['school', 6],
    ['park', 6],
    ['retail', 6],
    ['healthcare', 6],
    ['warehouse', 6],
  ],
} satisfies Record<string, ReadonlyArray<readonly [PointCategory, number]>>;

const NAME_PARTS: Record<PointCategory, readonly string[]> = {
  restaurant: ['Cafe', 'Bistro', 'Kitchen', 'Table', 'Roastery', 'Diner'],
  transit: ['Station', 'Terminal', 'Hub', 'Platform', 'Interchange', 'Depot'],
  office: ['Campus', 'Tower', 'Works', 'Center', 'Plaza', 'Labs'],
  school: ['Academy', 'Institute', 'College', 'Learning Center', 'Campus', 'Workshop'],
  park: ['Park', 'Garden', 'Reserve', 'Commons', 'Square', 'Green'],
  retail: ['Market', 'Outlet', 'Galleria', 'Arcade', 'Mall', 'Bazaar'],
  healthcare: ['Clinic', 'Health Center', 'Care Point', 'Medical Hub', 'Hospital', 'Wellness Center'],
  warehouse: ['Logistics Yard', 'Depot', 'Fulfillment Center', 'Warehouse', 'Cargo Hub', 'Storage Point'],
};

const CATEGORY_BASE_WEIGHT: Record<PointCategory, number> = {
  restaurant: 18,
  transit: 32,
  office: 28,
  school: 20,
  park: 14,
  retail: 24,
  healthcare: 22,
  warehouse: 30,
};

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function normalizeLon(lon: number): number {
  if (lon < -180) {
    return lon + 360;
  }

  if (lon > 180) {
    return lon - 360;
  }

  return lon;
}

function offsetPoint(lon: number, lat: number, dxKm: number, dyKm: number): { lon: number; lat: number } {
  const latOffset = dyKm / 110.574;
  const lonOffset = dxKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  return {
    lon: normalizeLon(lon + lonOffset),
    lat: clampLat(lat + latOffset),
  };
}

function pickCategory(
  rng: RandomSource,
  source: ReadonlyArray<readonly [PointCategory, number]>,
): PointCategory {
  const [category] = rng.weightedPick(source, ([, weight]) => weight);
  return category;
}

function makeName(rng: RandomSource, anchorName: string, category: PointCategory): string {
  const parts = NAME_PARTS[category];

  if (!parts) {
    throw new Error(`Unknown category for naming: ${category}`);
  }

  const suffix = rng.pick(parts);
  const serial = rng.int(1, 999);
  return `${anchorName} ${suffix} ${serial}`;
}

function makeWeight(rng: RandomSource, category: PointCategory, intensity: number): number {
  const baseWeight = CATEGORY_BASE_WEIGHT[category];

  if (baseWeight === undefined) {
    throw new Error(`Unknown category for weight: ${category}`);
  }

  const base = baseWeight * intensity;
  const jitter = Math.max(0.45, 1 + rng.normal(0, 0.25));
  return Math.max(1, Math.round(base * jitter));
}

function createUrbanPoint(index: number, rng: RandomSource): PointRecord {
  const center = rng.weightedPick(URBAN_CENTERS, (item) => item.weight);
  const distanceScale = Math.abs(rng.normal(0, center.spreadKm));
  const angle = rng.next() * Math.PI * 2;
  const offset = offsetPoint(
    center.lon,
    center.lat,
    Math.cos(angle) * distanceScale,
    Math.sin(angle) * distanceScale,
  );
  const category = pickCategory(rng, CATEGORIES_BY_SCENARIO.urban);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeName(rng, center.name, category),
    category,
    weight: makeWeight(rng, category, 1.2),
  };
}

function createSparsePoint(index: number, rng: RandomSource): PointRecord {
  const region = rng.weightedPick(SPARSE_REGIONS, (item) => item.weight);
  const lon = region.west + rng.next() * (region.east - region.west);
  const lat = region.south + rng.next() * (region.north - region.south);
  const category = pickCategory(rng, CATEGORIES_BY_SCENARIO.sparse);

  return {
    id: `pt-${index}`,
    lon,
    lat,
    name: makeName(rng, region.name, category),
    category,
    weight: makeWeight(rng, category, 0.85),
  };
}

function createCorridorPoint(index: number, rng: RandomSource): PointRecord {
  const corridor = rng.weightedPick(CORRIDORS, (item) => item.weight);
  const progress = rng.next();
  const lon = corridor.fromLon + (corridor.toLon - corridor.fromLon) * progress;
  const lat = corridor.fromLat + (corridor.toLat - corridor.fromLat) * progress;
  const heading = Math.atan2(corridor.toLat - corridor.fromLat, corridor.toLon - corridor.fromLon);
  const lateralJitter = rng.normal(0, corridor.jitterKm);
  const axialJitter = rng.normal(0, corridor.jitterKm * 0.35);
  const offset = offsetPoint(
    lon,
    lat,
    Math.cos(heading) * axialJitter - Math.sin(heading) * lateralJitter,
    Math.sin(heading) * axialJitter + Math.cos(heading) * lateralJitter,
  );
  const category = pickCategory(rng, CATEGORIES_BY_SCENARIO.corridor);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeName(rng, corridor.name, category),
    category,
    weight: makeWeight(rng, category, 1),
  };
}

function createNoisePoint(index: number, rng: RandomSource): PointRecord {
  const lon = -170 + rng.next() * 340;
  const lat = -65 + rng.next() * 140;
  const category = pickCategory(rng, CATEGORIES_BY_SCENARIO.noise);

  return {
    id: `pt-${index}`,
    lon,
    lat,
    name: makeName(rng, 'Remote', category),
    category,
    weight: makeWeight(rng, category, 0.7),
  };
}

export function generatePointsDataset(query: DatasetQuery): PointsApiResponse {
  const rng = createRandomSource(query.seed);
  const points: PointRecord[] = [];

  const urbanCount = Math.floor(query.count * 0.58);
  const sparseCount = Math.floor(query.count * 0.17);
  const corridorCount = Math.floor(query.count * 0.15);
  const noiseCount = query.count - urbanCount - sparseCount - corridorCount;

  for (let index = 0; index < urbanCount; index += 1) {
    points.push(createUrbanPoint(points.length, rng));
  }

  for (let index = 0; index < sparseCount; index += 1) {
    points.push(createSparsePoint(points.length, rng));
  }

  for (let index = 0; index < corridorCount; index += 1) {
    points.push(createCorridorPoint(points.length, rng));
  }

  for (let index = 0; index < noiseCount; index += 1) {
    points.push(createNoisePoint(points.length, rng));
  }

  return {
    meta: {
      count: points.length,
      seed: query.seed,
      mode: query.mode,
      generatedAt: new Date().toISOString(),
    },
    points,
  };
}
