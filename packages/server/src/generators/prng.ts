export interface RandomSource {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly T[], weight: (item: T) => number): T;
  normal(mean?: number, stdDev?: number): number;
}

export function createRandomSource(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty collection');
      }

      const item = items[this.int(0, items.length - 1)];

      if (item === undefined) {
        throw new Error('Random pick produced an out-of-range index');
      }

      return item;
    },
    weightedPick(items, weight) {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty collection');
      }

      const totalWeight = items.reduce((sum, item) => sum + weight(item), 0);
      const threshold = next() * totalWeight;
      let currentWeight = 0;

      for (const item of items) {
        currentWeight += weight(item);

        if (currentWeight >= threshold) {
          return item;
        }
      }

      const fallback = items[items.length - 1];

      if (fallback === undefined) {
        throw new Error('Weighted pick fallback is unavailable');
      }

      return fallback;
    },
    normal(mean = 0, stdDev = 1) {
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z0 * stdDev;
    },
  };
}
