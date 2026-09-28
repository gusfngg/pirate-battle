export interface Random {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

function shuffleWith<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const current = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = current;
  }
  return copy;
}

// mulberry32, small and good enough for gameplay, same seed same match
export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("cannot pick from an empty list");
      return item;
    },
    shuffle: (items) => shuffleWith(items, next),
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
