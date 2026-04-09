import type {
  DatasetQuery,
  GeneralPointCategory,
  IndustrialPointCategory,
  PointCategory,
  PointRecord,
  PointsApiResponse,
} from '../../../../shared/points.js';
import { getIndustrialNameFactory } from './industrialNames.js';
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

interface CoincidentHotspot {
  name: string;
  dxKm: number;
  dyKm: number;
  spreadKm: number;
  weight: number;
  categories: ReadonlyArray<readonly [GeneralPointCategory, number]>;
}

interface CoincidentCity {
  name: string;
  lon: number;
  lat: number;
  spreadKm: number;
  hotspots: ReadonlyArray<CoincidentHotspot>;
}

interface IndustrialZone {
  name: string;
  dxKm: number;
  dyKm: number;
  spreadKm: number;
  weight: number;
  intensity: number;
  categories: ReadonlyArray<readonly [IndustrialPointCategory, number]>;
}

interface IndustrialCorridor {
  name: string;
  fromZone: string;
  toZone: string;
  jitterKm: number;
  weight: number;
  intensity: number;
  categories: ReadonlyArray<readonly [IndustrialPointCategory, number]>;
}

const URBAN_CENTERS: NamedCenter[] = [
  { name: 'Berlin', lon: 13.405, lat: 52.52, spreadKm: 15, weight: 11 },
  { name: 'Paris', lon: 2.3522, lat: 48.8566, spreadKm: 16, weight: 12 },
  { name: 'London', lon: -0.1278, lat: 51.5072, spreadKm: 18, weight: 13 },
  { name: 'New York', lon: -74.006, lat: 40.7128, spreadKm: 20, weight: 14 },
  { name: 'Tokyo', lon: 139.6917, lat: 35.6895, spreadKm: 22, weight: 15 },
  { name: 'Singapore', lon: 103.8198, lat: 1.3521, spreadKm: 10, weight: 8 },
  { name: 'Moscow', lon: 37.6173, lat: 55.7558, spreadKm: 18, weight: 12 },
  { name: 'Dubai', lon: 55.2708, lat: 25.2048, spreadKm: 13, weight: 8 },
];

const SPARSE_REGIONS: SparseRegion[] = [
  { name: 'Great Plains', west: -104, south: 33, east: -92, north: 44, weight: 8 },
  { name: 'Kazakh Steppe', west: 58, south: 45, east: 76, north: 53, weight: 9 },
  { name: 'Iberian Interior', west: -7.5, south: 38, east: -1.5, north: 42.5, weight: 6 },
  { name: 'Patagonia Fringe', west: -72, south: -48, east: -63, north: -40, weight: 4 },
  { name: 'Western Australia', west: 114, south: -33, east: 123, north: -25, weight: 4 },
  { name: 'Scandinavian North', west: 15, south: 63, east: 28, north: 69, weight: 5 },
];

const CORRIDORS: Corridor[] = [
  {
    name: 'Northeast Corridor',
    fromLon: -77.0369,
    fromLat: 38.9072,
    toLon: -71.0589,
    toLat: 42.3601,
    jitterKm: 12,
    weight: 10,
  },
  {
    name: 'Rhine Axis',
    fromLon: 6.96,
    fromLat: 50.94,
    toLon: 8.6821,
    toLat: 50.1109,
    jitterKm: 8,
    weight: 8,
  },
  {
    name: 'Tokyo-Osaka Link',
    fromLon: 139.6917,
    fromLat: 35.6895,
    toLon: 135.5023,
    toLat: 34.6937,
    jitterKm: 10,
    weight: 8,
  },
  {
    name: 'Gulf Trade Route',
    fromLon: 55.2708,
    fromLat: 25.2048,
    toLon: 54.3773,
    toLat: 24.4539,
    jitterKm: 7,
    weight: 6,
  },
  {
    name: 'Baltic Logistics',
    fromLon: 24.7536,
    fromLat: 59.437,
    toLon: 18.0686,
    toLat: 59.3293,
    jitterKm: 7,
    weight: 5,
  },
];

const MIXED_CATEGORIES_BY_SCENARIO = {
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
} satisfies Record<string, ReadonlyArray<readonly [GeneralPointCategory, number]>>;

const MIXED_NAME_PARTS: Record<GeneralPointCategory, readonly string[]> = {
  restaurant: ['Cafe', 'Bistro', 'Kitchen', 'Table', 'Roastery', 'Diner'],
  transit: ['Station', 'Terminal', 'Hub', 'Platform', 'Interchange', 'Depot'],
  office: ['Campus', 'Tower', 'Works', 'Center', 'Plaza', 'Labs'],
  school: ['Academy', 'Institute', 'College', 'Learning Center', 'Campus', 'Workshop'],
  park: ['Park', 'Garden', 'Reserve', 'Commons', 'Square', 'Green'],
  retail: ['Market', 'Outlet', 'Galleria', 'Arcade', 'Mall', 'Bazaar'],
  healthcare: ['Clinic', 'Health Center', 'Care Point', 'Medical Hub', 'Hospital', 'Wellness Center'],
  warehouse: ['Logistics Yard', 'Depot', 'Fulfillment Center', 'Warehouse', 'Cargo Hub', 'Storage Point'],
};

const COINCIDENT_CITIES = [
  {
    name: 'Naberezhnye Chelny',
    lon: 52.403,
    lat: 55.743,
    spreadKm: 7.8,
    hotspots: [
      {
        name: 'Central Station',
        dxKm: -1.7,
        dyKm: 0.6,
        spreadKm: 0.42,
        weight: 11,
        categories: [
          ['transit', 18],
          ['retail', 10],
          ['office', 8],
          ['restaurant', 6],
        ],
      },
      {
        name: 'Riverside Mall',
        dxKm: 1.3,
        dyKm: 0.9,
        spreadKm: 0.38,
        weight: 9,
        categories: [
          ['retail', 18],
          ['restaurant', 12],
          ['office', 6],
          ['healthcare', 4],
        ],
      },
      {
        name: 'Tech Quarter',
        dxKm: -0.4,
        dyKm: -1.6,
        spreadKm: 0.34,
        weight: 8,
        categories: [
          ['office', 16],
          ['school', 10],
          ['healthcare', 8],
          ['transit', 4],
        ],
      },
      {
        name: 'South District Hub',
        dxKm: 1.8,
        dyKm: -1.1,
        spreadKm: 0.46,
        weight: 7,
        categories: [
          ['school', 12],
          ['healthcare', 10],
          ['restaurant', 7],
          ['retail', 5],
        ],
      },
    ],
  },
  {
    name: 'Nizhnekamsk',
    lon: 51.814,
    lat: 55.641,
    spreadKm: 6.9,
    hotspots: [
      {
        name: 'Central Station',
        dxKm: -1.3,
        dyKm: 0.5,
        spreadKm: 0.38,
        weight: 10,
        categories: [
          ['transit', 18],
          ['retail', 9],
          ['office', 7],
          ['restaurant', 5],
        ],
      },
      {
        name: 'Market Square',
        dxKm: 1.1,
        dyKm: 0.8,
        spreadKm: 0.4,
        weight: 9,
        categories: [
          ['retail', 18],
          ['restaurant', 11],
          ['office', 6],
          ['healthcare', 4],
        ],
      },
      {
        name: 'Medical Campus',
        dxKm: -0.2,
        dyKm: -1.4,
        spreadKm: 0.33,
        weight: 8,
        categories: [
          ['healthcare', 18],
          ['office', 8],
          ['school', 6],
          ['transit', 4],
        ],
      },
      {
        name: 'West Residential Hub',
        dxKm: 1.6,
        dyKm: -1.2,
        spreadKm: 0.44,
        weight: 7,
        categories: [
          ['school', 12],
          ['healthcare', 10],
          ['restaurant', 7],
          ['retail', 5],
        ],
      },
    ],
  },
] satisfies readonly [CoincidentCity, CoincidentCity];

const COINCIDENT_CITY_CATEGORIES: ReadonlyArray<readonly [GeneralPointCategory, number]> = [
  ['restaurant', 12],
  ['transit', 10],
  ['office', 14],
  ['school', 9],
  ['park', 4],
  ['retail', 13],
  ['healthcare', 8],
  ['warehouse', 5],
];

const COINCIDENT_CORRIDOR_CATEGORIES: ReadonlyArray<readonly [GeneralPointCategory, number]> = [
  ['transit', 16],
  ['warehouse', 14],
  ['retail', 8],
  ['office', 6],
  ['restaurant', 5],
  ['healthcare', 3],
  ['school', 2],
  ['park', 1],
];

const INDUSTRIAL_COMPLEX = {
  name: 'Nizhnekamsk Integrated Petrochemical Complex',
  lon: 51.822,
  lat: 55.638,
};

const INDUSTRIAL_ZONES: IndustrialZone[] = [
  {
    name: 'Ethylene Cracking Yard',
    dxKm: -1.8,
    dyKm: 0.9,
    spreadKm: 0.46,
    weight: 18,
    intensity: 1.45,
    categories: [
      ['process_unit', 26],
      ['utilities', 10],
      ['safety', 5],
      ['maintenance', 4],
    ],
  },
  {
    name: 'Polymer Train Field',
    dxKm: 0.6,
    dyKm: 1.3,
    spreadKm: 0.5,
    weight: 17,
    intensity: 1.4,
    categories: [
      ['process_unit', 24],
      ['utilities', 8],
      ['maintenance', 5],
      ['laboratory', 3],
    ],
  },
  {
    name: 'Tank Farm East',
    dxKm: 2.2,
    dyKm: 0.5,
    spreadKm: 0.56,
    weight: 13,
    intensity: 1.28,
    categories: [
      ['storage', 24],
      ['logistics', 10],
      ['safety', 8],
      ['maintenance', 4],
    ],
  },
  {
    name: 'Rail Loading Terminal',
    dxKm: 1.9,
    dyKm: -1.6,
    spreadKm: 0.52,
    weight: 12,
    intensity: 1.18,
    categories: [
      ['logistics', 20],
      ['storage', 10],
      ['maintenance', 7],
      ['administration', 3],
    ],
  },
  {
    name: 'Power and Steam Island',
    dxKm: -0.5,
    dyKm: -1.2,
    spreadKm: 0.42,
    weight: 11,
    intensity: 1.24,
    categories: [
      ['utilities', 24],
      ['safety', 7],
      ['maintenance', 7],
      ['process_unit', 4],
    ],
  },
  {
    name: 'Water Treatment Basin',
    dxKm: -2.4,
    dyKm: -1.3,
    spreadKm: 0.44,
    weight: 8,
    intensity: 1.04,
    categories: [
      ['utilities', 18],
      ['safety', 8],
      ['maintenance', 6],
      ['laboratory', 4],
    ],
  },
  {
    name: 'Maintenance and Fabrication District',
    dxKm: 0.3,
    dyKm: -2.4,
    spreadKm: 0.5,
    weight: 7,
    intensity: 0.95,
    categories: [
      ['maintenance', 22],
      ['logistics', 8],
      ['administration', 7],
      ['utilities', 4],
    ],
  },
  {
    name: 'Process Analytics Campus',
    dxKm: -1.2,
    dyKm: 2.2,
    spreadKm: 0.38,
    weight: 6,
    intensity: 0.9,
    categories: [
      ['laboratory', 22],
      ['administration', 10],
      ['maintenance', 4],
      ['process_unit', 3],
    ],
  },
  {
    name: 'Safety and Flare Perimeter',
    dxKm: 2.8,
    dyKm: 1.8,
    spreadKm: 0.34,
    weight: 4,
    intensity: 1.06,
    categories: [
      ['safety', 24],
      ['utilities', 8],
      ['maintenance', 3],
      ['administration', 2],
    ],
  },
];

const INDUSTRIAL_CORRIDORS: IndustrialCorridor[] = [
  {
    name: 'North Pipe Rack Spine',
    fromZone: 'Ethylene Cracking Yard',
    toZone: 'Polymer Train Field',
    jitterKm: 0.14,
    weight: 12,
    intensity: 1.22,
    categories: [
      ['process_unit', 12],
      ['utilities', 10],
      ['safety', 4],
    ],
  },
  {
    name: 'Utility Backbone South',
    fromZone: 'Power and Steam Island',
    toZone: 'Ethylene Cracking Yard',
    jitterKm: 0.16,
    weight: 10,
    intensity: 1.16,
    categories: [
      ['utilities', 18],
      ['safety', 5],
      ['maintenance', 4],
    ],
  },
  {
    name: 'Transfer Gallery East',
    fromZone: 'Polymer Train Field',
    toZone: 'Tank Farm East',
    jitterKm: 0.15,
    weight: 9,
    intensity: 1.12,
    categories: [
      ['storage', 12],
      ['logistics', 10],
      ['utilities', 4],
    ],
  },
  {
    name: 'Rail Dispatch Corridor',
    fromZone: 'Tank Farm East',
    toZone: 'Rail Loading Terminal',
    jitterKm: 0.18,
    weight: 9,
    intensity: 1.1,
    categories: [
      ['logistics', 18],
      ['storage', 8],
      ['maintenance', 4],
    ],
  },
  {
    name: 'Service Access Loop',
    fromZone: 'Maintenance and Fabrication District',
    toZone: 'Power and Steam Island',
    jitterKm: 0.17,
    weight: 6,
    intensity: 0.98,
    categories: [
      ['maintenance', 12],
      ['administration', 6],
      ['logistics', 5],
    ],
  },
];

const INDUSTRIAL_SUPPORT_CATEGORIES: ReadonlyArray<readonly [IndustrialPointCategory, number]> = [
  ['maintenance', 14],
  ['logistics', 12],
  ['administration', 10],
  ['utilities', 8],
  ['safety', 8],
  ['laboratory', 5],
  ['storage', 4],
  ['process_unit', 3],
];

const CATEGORY_BASE_WEIGHT: Record<PointCategory, number> = {
  restaurant: 18,
  transit: 32,
  office: 28,
  school: 20,
  park: 14,
  retail: 24,
  healthcare: 22,
  warehouse: 30,
  process_unit: 38,
  utilities: 30,
  storage: 34,
  maintenance: 24,
  logistics: 28,
  safety: 20,
  laboratory: 18,
  administration: 16,
};

type LocationPoint = { lon: number; lat: number };

const INDUSTRIAL_ZONE_CENTERS = new Map<string, LocationPoint>(
  INDUSTRIAL_ZONES.map((zone) => [
    zone.name,
    offsetPoint(INDUSTRIAL_COMPLEX.lon, INDUSTRIAL_COMPLEX.lat, zone.dxKm, zone.dyKm),
  ]),
);

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

function offsetPoint(lon: number, lat: number, dxKm: number, dyKm: number): LocationPoint {
  const latOffset = dyKm / 110.574;
  const lonOffset = dxKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  return {
    lon: normalizeLon(lon + lonOffset),
    lat: clampLat(lat + latOffset),
  };
}

function pickCategory<TCategory extends PointCategory>(
  rng: RandomSource,
  source: ReadonlyArray<readonly [TCategory, number]>,
): TCategory {
  const [category] = rng.weightedPick(source, ([, weight]) => weight);
  return category;
}

function makeMixedName(
  rng: RandomSource,
  anchorName: string,
  category: GeneralPointCategory,
): string {
  const parts = MIXED_NAME_PARTS[category];

  if (!parts) {
    throw new Error(`Unknown mixed category for naming: ${category}`);
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

function getIndustrialZoneCenter(zoneName: string): LocationPoint {
  const zoneCenter = INDUSTRIAL_ZONE_CENTERS.get(zoneName);

  if (!zoneCenter) {
    throw new Error(`Unknown industrial zone center: ${zoneName}`);
  }

  return zoneCenter;
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
  const category = pickCategory(rng, MIXED_CATEGORIES_BY_SCENARIO.urban);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeMixedName(rng, center.name, category),
    category,
    weight: makeWeight(rng, category, 1.2),
  };
}

function createSparsePoint(index: number, rng: RandomSource): PointRecord {
  const region = rng.weightedPick(SPARSE_REGIONS, (item) => item.weight);
  const lon = region.west + rng.next() * (region.east - region.west);
  const lat = region.south + rng.next() * (region.north - region.south);
  const category = pickCategory(rng, MIXED_CATEGORIES_BY_SCENARIO.sparse);

  return {
    id: `pt-${index}`,
    lon,
    lat,
    name: makeMixedName(rng, region.name, category),
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
  const category = pickCategory(rng, MIXED_CATEGORIES_BY_SCENARIO.corridor);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeMixedName(rng, corridor.name, category),
    category,
    weight: makeWeight(rng, category, 1),
  };
}

function createNoisePoint(index: number, rng: RandomSource): PointRecord {
  const lon = -170 + rng.next() * 340;
  const lat = -65 + rng.next() * 140;
  const category = pickCategory(rng, MIXED_CATEGORIES_BY_SCENARIO.noise);

  return {
    id: `pt-${index}`,
    lon,
    lat,
    name: makeMixedName(rng, 'Remote', category),
    category,
    weight: makeWeight(rng, category, 0.7),
  };
}

function createIndustrialZonePoint(
  index: number,
  rng: RandomSource,
  nameFactory: ReturnType<typeof getIndustrialNameFactory>,
): PointRecord {
  const zone = rng.weightedPick(INDUSTRIAL_ZONES, (item) => item.weight);
  const zoneCenter = getIndustrialZoneCenter(zone.name);
  const distanceScale = Math.abs(rng.normal(0, zone.spreadKm));
  const angle = rng.next() * Math.PI * 2;
  const offset = offsetPoint(
    zoneCenter.lon,
    zoneCenter.lat,
    Math.cos(angle) * distanceScale,
    Math.sin(angle) * distanceScale,
  );
  const category = pickCategory(rng, zone.categories);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: nameFactory.makeName(zone.name, category, index, rng),
    category,
    weight: makeWeight(rng, category, zone.intensity),
  };
}

function createIndustrialCorridorPoint(
  index: number,
  rng: RandomSource,
  nameFactory: ReturnType<typeof getIndustrialNameFactory>,
): PointRecord {
  const corridor = rng.weightedPick(INDUSTRIAL_CORRIDORS, (item) => item.weight);
  const fromCenter = getIndustrialZoneCenter(corridor.fromZone);
  const toCenter = getIndustrialZoneCenter(corridor.toZone);
  const progress = rng.next();
  const lon = fromCenter.lon + (toCenter.lon - fromCenter.lon) * progress;
  const lat = fromCenter.lat + (toCenter.lat - fromCenter.lat) * progress;
  const heading = Math.atan2(toCenter.lat - fromCenter.lat, toCenter.lon - fromCenter.lon);
  const lateralJitter = rng.normal(0, corridor.jitterKm);
  const axialJitter = rng.normal(0, corridor.jitterKm * 0.35);
  const offset = offsetPoint(
    lon,
    lat,
    Math.cos(heading) * axialJitter - Math.sin(heading) * lateralJitter,
    Math.sin(heading) * axialJitter + Math.cos(heading) * lateralJitter,
  );
  const category = pickCategory(rng, corridor.categories);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: nameFactory.makeName(corridor.name, category, index, rng),
    category,
    weight: makeWeight(rng, category, corridor.intensity),
  };
}

function createIndustrialSupportPoint(
  index: number,
  rng: RandomSource,
  nameFactory: ReturnType<typeof getIndustrialNameFactory>,
): PointRecord {
  const distanceScale = Math.abs(rng.normal(0, 2.9));
  const angle = rng.next() * Math.PI * 2;
  const offset = offsetPoint(
    INDUSTRIAL_COMPLEX.lon,
    INDUSTRIAL_COMPLEX.lat,
    Math.cos(angle) * distanceScale,
    Math.sin(angle) * distanceScale,
  );
  const category = pickCategory(rng, INDUSTRIAL_SUPPORT_CATEGORIES);
  const supportZones = [
    'Perimeter Service Loop',
    'Operations Buffer Yard',
    'Security Checkpoint Ring',
    'Utility Access Grid',
  ] as const;

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: nameFactory.makeName(rng.pick(supportZones), category, index, rng),
    category,
    weight: makeWeight(rng, category, 0.92),
  };
}

function getCoincidentHotspotCenter(city: CoincidentCity, hotspot: CoincidentHotspot): LocationPoint {
  return offsetPoint(city.lon, city.lat, hotspot.dxKm, hotspot.dyKm);
}

function createCoincidentUrbanPoint(index: number, city: CoincidentCity, rng: RandomSource): PointRecord {
  const distanceScale = Math.abs(rng.normal(0, city.spreadKm));
  const angle = rng.next() * Math.PI * 2;
  const offset = offsetPoint(
    city.lon,
    city.lat,
    Math.cos(angle) * distanceScale,
    Math.sin(angle) * distanceScale,
  );
  const category = pickCategory(rng, COINCIDENT_CITY_CATEGORIES);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeMixedName(rng, city.name, category),
    category,
    weight: makeWeight(rng, category, 1.08),
  };
}

function createCoincidentHotspotPoint(
  index: number,
  city: CoincidentCity,
  rng: RandomSource,
  exactCoordinates: boolean,
): PointRecord {
  const hotspot = rng.weightedPick(city.hotspots, (item) => item.weight);
  const hotspotCenter = getCoincidentHotspotCenter(city, hotspot);
  const offset = exactCoordinates
    ? hotspotCenter
    : offsetPoint(
        hotspotCenter.lon,
        hotspotCenter.lat,
        rng.normal(0, hotspot.spreadKm),
        rng.normal(0, hotspot.spreadKm),
      );
  const category = pickCategory(rng, hotspot.categories);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeMixedName(rng, `${city.name} ${hotspot.name}`, category),
    category,
    weight: makeWeight(rng, category, exactCoordinates ? 1.3 : 1.16),
  };
}

function createCoincidentCorridorPoint(index: number, rng: RandomSource): PointRecord {
  const [fromCity, toCity] = COINCIDENT_CITIES;
  const progress = rng.next();
  const lon = fromCity.lon + (toCity.lon - fromCity.lon) * progress;
  const lat = fromCity.lat + (toCity.lat - fromCity.lat) * progress;
  const heading = Math.atan2(toCity.lat - fromCity.lat, toCity.lon - fromCity.lon);
  const lateralJitter = rng.normal(0, 1.8);
  const axialJitter = rng.normal(0, 0.7);
  const offset = offsetPoint(
    lon,
    lat,
    Math.cos(heading) * axialJitter - Math.sin(heading) * lateralJitter,
    Math.sin(heading) * axialJitter + Math.cos(heading) * lateralJitter,
  );
  const category = pickCategory(rng, COINCIDENT_CORRIDOR_CATEGORIES);

  return {
    id: `pt-${index}`,
    lon: offset.lon,
    lat: offset.lat,
    name: makeMixedName(rng, 'Lower Kama Link', category),
    category,
    weight: makeWeight(rng, category, 0.96),
  };
}

function appendCoincidentCityPoints(
  points: PointRecord[],
  city: CoincidentCity,
  count: number,
  rng: RandomSource,
): void {
  const exactHotspotCount = Math.floor(count * 0.18);
  const hotspotHaloCount = Math.floor(count * 0.24);
  const urbanCount = count - exactHotspotCount - hotspotHaloCount;

  for (let index = 0; index < urbanCount; index += 1) {
    points.push(createCoincidentUrbanPoint(points.length, city, rng));
  }

  for (let index = 0; index < hotspotHaloCount; index += 1) {
    points.push(createCoincidentHotspotPoint(points.length, city, rng, false));
  }

  for (let index = 0; index < exactHotspotCount; index += 1) {
    points.push(createCoincidentHotspotPoint(points.length, city, rng, true));
  }
}

function generateMixedPoints(count: number, rng: RandomSource): PointRecord[] {
  const points: PointRecord[] = [];
  const urbanCount = Math.floor(count * 0.58);
  const sparseCount = Math.floor(count * 0.17);
  const corridorCount = Math.floor(count * 0.15);
  const noiseCount = count - urbanCount - sparseCount - corridorCount;

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

  return points;
}

function generateIndustrialPoints(count: number, rng: RandomSource, seed: number): PointRecord[] {
  const points: PointRecord[] = [];
  const nameFactory = getIndustrialNameFactory(seed);
  const zoneCount = Math.floor(count * 0.72);
  const corridorCount = Math.floor(count * 0.2);
  const supportCount = count - zoneCount - corridorCount;

  for (let index = 0; index < zoneCount; index += 1) {
    points.push(createIndustrialZonePoint(points.length, rng, nameFactory));
  }

  for (let index = 0; index < corridorCount; index += 1) {
    points.push(createIndustrialCorridorPoint(points.length, rng, nameFactory));
  }

  for (let index = 0; index < supportCount; index += 1) {
    points.push(createIndustrialSupportPoint(points.length, rng, nameFactory));
  }

  return points;
}

function generateCoincidentPoints(count: number, rng: RandomSource): PointRecord[] {
  const points: PointRecord[] = [];
  const cityOneCount = Math.floor(count * 0.44);
  const cityTwoCount = Math.floor(count * 0.44);
  const corridorCount = count - cityOneCount - cityTwoCount;

  appendCoincidentCityPoints(points, COINCIDENT_CITIES[0], cityOneCount, rng);
  appendCoincidentCityPoints(points, COINCIDENT_CITIES[1], cityTwoCount, rng);

  for (let index = 0; index < corridorCount; index += 1) {
    points.push(createCoincidentCorridorPoint(points.length, rng));
  }

  return points;
}

export function generatePointsDataset(query: DatasetQuery): PointsApiResponse {
  const rng = createRandomSource(query.seed);
  let points: PointRecord[];

  if (query.mode === 'industrial') {
    points = generateIndustrialPoints(query.count, rng, query.seed);
  } else if (query.mode === 'coincident') {
    points = generateCoincidentPoints(query.count, rng);
  } else {
    points = generateMixedPoints(query.count, rng);
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
