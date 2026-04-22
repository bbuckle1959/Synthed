import seedrandom from "seedrandom";

export class RNG {
  #seed: number;
  #rng: seedrandom.PRNG;

  constructor(seed: number) {
    this.#seed = seed;
    this.#rng = seedrandom(String(seed));
  }

  get seed(): number {
    return this.#seed;
  }

  random(): number {
    return this.#rng();
  }

  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)]!;
  }

  sample<T>(array: T[], n: number): T[] {
    const copy = [...array];
    const out: T[] = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i += 1) {
      const idx = this.int(0, copy.length - 1);
      out.push(copy[idx]!);
      copy.splice(idx, 1);
    }
    return out;
  }

  bool(probability = 0.5): boolean {
    return this.random() < probability;
  }

  uuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.floor(this.random() * 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  weightedPick<T>(items: Array<{ value: T; weight: number }>): T {
    const total = items.reduce((acc, it) => acc + Math.max(0, it.weight), 0);
    let target = this.float(0, total);
    for (const item of items) {
      target -= Math.max(0, item.weight);
      if (target <= 0) return item.value;
    }
    return items[items.length - 1]!.value;
  }

  gaussian(mean = 0, stddev = 1): number {
    const u1 = 1 - this.random();
    const u2 = 1 - this.random();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const z0 = mag * Math.cos(2.0 * Math.PI * u2);
    return z0 * stddev + mean;
  }

  logNormal(mean = 0, stddev = 1): number {
    return Math.exp(this.gaussian(mean, stddev));
  }

  poisson(lambda: number): number {
    const l = Math.exp(-lambda);
    let p = 1;
    let k = 0;
    do {
      k += 1;
      p *= this.random();
    } while (p > l);
    return k - 1;
  }

  fork(salt: string): RNG {
    let hash = this.#seed;
    for (let i = 0; i < salt.length; i += 1) hash = (hash * 31 + salt.charCodeAt(i)) >>> 0;
    return new RNG(hash);
  }
}

