import { Faker, en } from '@faker-js/faker';
import type { IndustrialPointCategory } from '../../../../shared/points.js';
import type { RandomSource } from './prng.js';

interface IndustrialNamePool {
  directions: string[];
  descriptors: string[];
  feedstocks: string[];
  operationPairs: Array<readonly [string, string]>;
  fallbackZoneAliases: string[];
  categoryTerms: Record<IndustrialPointCategory, Array<readonly [string, string]>>;
  codePrefixes: Record<IndustrialPointCategory, string[]>;
}

export interface IndustrialNameFactory {
  makeName(zoneName: string, category: IndustrialPointCategory, pointIndex: number, rng: RandomSource): string;
}

const DIRECTION_VALUES = [
  'Northern',
  'Eastern',
  'Western',
  'Southern',
  'Central',
  'Upper',
  'Lower',
  'Outer',
  'Inner',
  'Main',
] as const;

const DESCRIPTOR_VALUES = [
  'Cryogenic',
  'Pressurized',
  'Buffered',
  'Redundant',
  'Integrated',
  'Modular',
  'Thermal',
  'Reactive',
  'Hybrid',
  'Auxiliary',
  'Primary',
  'Secondary',
  'High-Capacity',
  'Low-Emission',
  'Multi-Stage',
  'Inline',
  'Dynamic',
  'Adaptive',
  'Automated',
  'Continuous',
] as const;

const FEEDSTOCK_VALUES = [
  'Ethylene',
  'Propylene',
  'Hydrogen',
  'Nitrogen',
  'Steam',
  'Condensate',
  'Polymer',
  'Aromatics',
  'Cooling-Water',
  'Demineralized-Water',
  'Feed-Gas',
  'Fuel-Gas',
  'Catalyst',
  'Resin',
  'Sulfur',
  'Propane',
  'Butadiene',
  'Amine',
] as const;

const OPERATION_PAIR_VALUES = [
  ['Pressure', 'Control'],
  ['Flow', 'Balancing'],
  ['Heat', 'Recovery'],
  ['Anti', 'Surge'],
  ['Remote', 'Isolation'],
  ['Steam', 'Tracing'],
  ['Fire', 'Water'],
  ['Load', 'Dispatch'],
  ['Quality', 'Control'],
  ['Leak', 'Detection'],
  ['Energy', 'Monitoring'],
  ['Emergency', 'Shutdown'],
  ['Corrosion', 'Monitoring'],
  ['Sample', 'Preparation'],
  ['Gas', 'Purification'],
  ['Fume', 'Extraction'],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const FALLBACK_ZONE_ALIAS_VALUES = [
  'Cracking',
  'Polymer',
  'Utilities',
  'Tankfarm',
  'Rail',
  'Water',
  'Safety',
  'Maintenance',
  'Laboratory',
  'Dispatch',
] as const;

const CATEGORY_TERM_VALUES: Record<
  IndustrialPointCategory,
  ReadonlyArray<readonly [string, string]>
> = {
  process_unit: [
    ['Cracking', 'Train'],
    ['Polymer', 'Reactor'],
    ['Fractionation', 'Column'],
    ['Quench', 'Module'],
    ['Catalyst', 'Loop'],
    ['Compression', 'Stage'],
  ],
  utilities: [
    ['Steam', 'Header'],
    ['Power', 'Substation'],
    ['Nitrogen', 'Manifold'],
    ['Cooling', 'Circuit'],
    ['Utility', 'Island'],
    ['Compressor', 'Station'],
  ],
  storage: [
    ['Tank', 'Farm'],
    ['Metering', 'Node'],
    ['Buffer', 'Reservoir'],
    ['Blending', 'Manifold'],
    ['Transfer', 'Bay'],
    ['Loading', 'Rack'],
  ],
  maintenance: [
    ['Inspection', 'Bay'],
    ['Repair', 'Module'],
    ['Service', 'Workshop'],
    ['Diagnostic', 'Stand'],
    ['Maintenance', 'Cell'],
    ['Calibration', 'Bench'],
  ],
  logistics: [
    ['Rail', 'Loading'],
    ['Dispatch', 'Station'],
    ['Transfer', 'Header'],
    ['Truck', 'Manifold'],
    ['Distribution', 'Gate'],
    ['Shipping', 'Node'],
  ],
  safety: [
    ['Flare', 'Header'],
    ['Fire', 'Suppression'],
    ['Gas', 'Detection'],
    ['Relief', 'Collector'],
    ['Emergency', 'Panel'],
    ['Safety', 'Barrier'],
  ],
  laboratory: [
    ['Quality', 'Control'],
    ['Process', 'Analytics'],
    ['Materials', 'Testing'],
    ['Sample', 'Laboratory'],
    ['Calibration', 'Suite'],
    ['Research', 'Bench'],
  ],
  administration: [
    ['Operations', 'Coordination'],
    ['Engineering', 'Services'],
    ['Planning', 'Center'],
    ['Digital', 'Dispatch'],
    ['Permit', 'Control'],
    ['Asset', 'Office'],
  ],
};

const CATEGORY_CODE_PREFIXES: Record<IndustrialPointCategory, readonly string[]> = {
  process_unit: ['K', 'R', 'P', 'D'],
  utilities: ['U', 'S', 'C', 'E'],
  storage: ['T', 'M', 'B', 'V'],
  maintenance: ['W', 'H', 'N', 'I'],
  logistics: ['L', 'G', 'X', 'Y'],
  safety: ['F', 'Z', 'Q', 'A'],
  laboratory: ['Q', 'L', 'B', 'C'],
  administration: ['A', 'O', 'D', 'P'],
};

function createSeededFaker(seed: number): Faker {
  const faker = new Faker({ locale: [en] });
  faker.seed(seed);
  return faker;
}

function toTitleWords(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9-\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('-'),
    )
    .join(' ');
}

function buildWordPool(
  faker: Faker,
  source: readonly string[],
  count: number,
): string[] {
  return Array.from({ length: count }, () => toTitleWords(faker.helpers.arrayElement(source)));
}

function buildPairPool(
  faker: Faker,
  source: ReadonlyArray<readonly [string, string]>,
  count: number,
): Array<readonly [string, string]> {
  return Array.from({ length: count }, () => {
    const [left, right] = faker.helpers.arrayElement(source);
    return [toTitleWords(left), toTitleWords(right)] as const;
  });
}

function buildCategoryTermPool(
  faker: Faker,
): Record<IndustrialPointCategory, Array<readonly [string, string]>> {
  return {
    process_unit: buildPairPool(faker, CATEGORY_TERM_VALUES.process_unit, 96),
    utilities: buildPairPool(faker, CATEGORY_TERM_VALUES.utilities, 96),
    storage: buildPairPool(faker, CATEGORY_TERM_VALUES.storage, 96),
    maintenance: buildPairPool(faker, CATEGORY_TERM_VALUES.maintenance, 96),
    logistics: buildPairPool(faker, CATEGORY_TERM_VALUES.logistics, 96),
    safety: buildPairPool(faker, CATEGORY_TERM_VALUES.safety, 96),
    laboratory: buildPairPool(faker, CATEGORY_TERM_VALUES.laboratory, 96),
    administration: buildPairPool(faker, CATEGORY_TERM_VALUES.administration, 96),
  };
}

function buildCodePrefixPool(
  faker: Faker,
): Record<IndustrialPointCategory, string[]> {
  return {
    process_unit: buildWordPool(faker, CATEGORY_CODE_PREFIXES.process_unit, 32),
    utilities: buildWordPool(faker, CATEGORY_CODE_PREFIXES.utilities, 32),
    storage: buildWordPool(faker, CATEGORY_CODE_PREFIXES.storage, 32),
    maintenance: buildWordPool(faker, CATEGORY_CODE_PREFIXES.maintenance, 32),
    logistics: buildWordPool(faker, CATEGORY_CODE_PREFIXES.logistics, 32),
    safety: buildWordPool(faker, CATEGORY_CODE_PREFIXES.safety, 32),
    laboratory: buildWordPool(faker, CATEGORY_CODE_PREFIXES.laboratory, 32),
    administration: buildWordPool(faker, CATEGORY_CODE_PREFIXES.administration, 32),
  };
}

function getZoneAliasTokens(zoneName: string, rng: RandomSource, pool: IndustrialNamePool): string[] {
  const significantTokens = zoneName
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9]+/g, ''))
    .filter((token) => token.length >= 4);

  if (significantTokens.length === 0) {
    return [rng.pick(pool.fallbackZoneAliases)];
  }

  const aliasLength = significantTokens.length > 1 && rng.next() > 0.55 ? 2 : 1;
  return significantTokens.slice(0, aliasLength).map(toTitleWords);
}

function createIndustrialNamePool(seed: number): IndustrialNamePool {
  const faker = createSeededFaker(seed);

  return {
    directions: buildWordPool(faker, DIRECTION_VALUES, 64),
    descriptors: buildWordPool(faker, DESCRIPTOR_VALUES, 96),
    feedstocks: buildWordPool(faker, FEEDSTOCK_VALUES, 96),
    operationPairs: buildPairPool(faker, OPERATION_PAIR_VALUES, 96),
    fallbackZoneAliases: buildWordPool(faker, FALLBACK_ZONE_ALIAS_VALUES, 32),
    categoryTerms: buildCategoryTermPool(faker),
    codePrefixes: buildCodePrefixPool(faker),
  };
}

function createCode(prefix: string, pointIndex: number): string {
  const serial = String((pointIndex % 900) + 100).padStart(3, '0');
  return `${prefix}-${serial}`;
}

export function getIndustrialNameFactory(seed: number): IndustrialNameFactory {
  const pool = createIndustrialNamePool(seed);

  return {
    makeName(zoneName, category, pointIndex, rng) {
      const zoneAliasTokens = getZoneAliasTokens(zoneName, rng, pool);
      const categoryTerms = pool.categoryTerms[category];
      const codePrefixes = pool.codePrefixes[category];
      const [termLeft, termRight] = rng.pick(categoryTerms);
      const [operationLeft, operationRight] = rng.pick(pool.operationPairs);
      const code = createCode(rng.pick(codePrefixes), pointIndex);

      return [
        rng.pick(pool.directions),
        rng.pick(pool.descriptors),
        rng.pick(pool.feedstocks),
        termLeft,
        termRight,
        operationLeft,
        operationRight,
        ...zoneAliasTokens,
        code,
      ].join(' ');
    },
  };
}
