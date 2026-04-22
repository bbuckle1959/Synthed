import { describe, expect, it } from "vitest";
import { RNG } from "../../src/core/RNG.js";
import { TemporalEngine } from "../../src/core/TemporalEngine.js";

describe("RNG", () => {
  it("is deterministic", () => {
    const a = new RNG(42);
    const b = new RNG(42);
    expect([a.random(), a.random(), a.random()]).toEqual([b.random(), b.random(), b.random()]);
  });

  it("temporal poisson is deterministic", () => {
    const a = new TemporalEngine(new RNG(12), { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-01-01T01:00:00Z"), distribution: "poisson" });
    const b = new TemporalEngine(new RNG(12), { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-01-01T01:00:00Z"), distribution: "poisson" });
    expect(a.series(5).map((d) => d.toISOString())).toEqual(b.series(5).map((d) => d.toISOString()));
  });
});

