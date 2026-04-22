import { RNG } from "./RNG.js";

export type TimeDistribution = "uniform" | "business-hours" | "burst" | "poisson";

interface TemporalOptions {
  start: Date;
  end: Date;
  distribution: TimeDistribution;
  burstProbability?: number;
  burstDurationMs?: number;
  burstMultiplier?: number;
  timezone?: string;
}

export class TemporalEngine {
  #rng: RNG;
  #options: Required<TemporalOptions>;
  #cursorMs: number;

  constructor(rng: RNG, options: TemporalOptions) {
    this.#rng = rng;
    this.#options = {
      ...options,
      burstProbability: options.burstProbability ?? 0.05,
      burstDurationMs: options.burstDurationMs ?? 30_000,
      burstMultiplier: options.burstMultiplier ?? 10,
      timezone: options.timezone ?? "UTC",
    };
    this.#cursorMs = options.start.getTime();
  }

  next(): Date {
    const { start, end, distribution } = this.#options;
    const span = end.getTime() - start.getTime();
    if (distribution === "uniform") return new Date(start.getTime() + this.#rng.float(0, span));
    if (distribution === "poisson") {
      const gap = Math.max(1, this.#rng.poisson(2)) * 1000;
      this.#cursorMs = Math.min(end.getTime(), this.#cursorMs + gap);
      return new Date(this.#cursorMs);
    }
    if (distribution === "business-hours") {
      const d = new Date(start.getTime() + this.#rng.float(0, span));
      const h = d.getUTCHours();
      const w = h < 6 ? 0.1 : h < 9 ? 0.3 : h < 12 ? 1 : h < 13 ? 0.7 : h < 17 ? 0.9 : h < 20 ? 0.5 : 0.1;
      return new Date(d.getTime() + this.#rng.float(0, 60_000 * w));
    }
    const base = new Date(start.getTime() + this.#rng.float(0, span));
    if (this.#rng.bool(this.#options.burstProbability)) {
      return new Date(base.getTime() + this.#rng.float(0, this.#options.burstDurationMs / this.#options.burstMultiplier));
    }
    return base;
  }

  series(n: number): Date[] {
    const out = Array.from({ length: n }, () => this.next());
    out.sort((a, b) => a.getTime() - b.getTime());
    return out;
  }
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
export function toHL7DateTime(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
export function toHL7Date(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
export function toFIXDateTime(d: Date): string {
  return `${toHL7Date(d)}-${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}
export function toSWIFTDate(d: Date): string {
  return `${pad(d.getUTCFullYear() % 100)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
export function toOFXDateTime(d: Date): string {
  return toHL7DateTime(d);
}
export function toX12Date(d: Date): string {
  return toHL7Date(d);
}
export function toX12Time(d: Date): string {
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

