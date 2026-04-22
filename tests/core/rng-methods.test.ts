import { describe, expect, it } from "vitest";
import { RNG } from "../../src/core/RNG.js";
import { StateMachine } from "../../src/core/StateMachine.js";
import { TemporalEngine, toHL7DateTime, toHL7Date, toFIXDateTime, toSWIFTDate, toOFXDateTime, toX12Date, toX12Time } from "../../src/core/TemporalEngine.js";

const start = new Date("2026-01-01T00:00:00Z");
const end = new Date("2026-01-01T02:00:00Z");

describe("RNG methods", () => {
  it("exposes seed property", () => {
    const rng = new RNG(123);
    expect(rng.seed).toBe(123);
  });

  it("int returns value within range", () => {
    const rng = new RNG(1);
    for (let i = 0; i < 50; i++) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("int includes both endpoints", () => {
    const rng = new RNG(42);
    const vals = new Set(Array.from({ length: 200 }, () => rng.int(0, 1)));
    expect(vals.has(0)).toBe(true);
    expect(vals.has(1)).toBe(true);
  });

  it("float returns value within range", () => {
    const rng = new RNG(2);
    for (let i = 0; i < 50; i++) {
      const v = rng.float(1.0, 2.0);
      expect(v).toBeGreaterThanOrEqual(1.0);
      expect(v).toBeLessThan(2.0);
    }
  });

  it("pick returns element from array", () => {
    const rng = new RNG(3);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it("sample returns n unique elements", () => {
    const rng = new RNG(4);
    const arr = [1, 2, 3, 4, 5];
    const result = rng.sample(arr, 3);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    result.forEach((v) => expect(arr).toContain(v));
  });

  it("sample clamps to array length", () => {
    const rng = new RNG(5);
    const arr = [1, 2];
    expect(rng.sample(arr, 10)).toHaveLength(2);
  });

  it("bool returns true with probability 1", () => {
    const rng = new RNG(6);
    expect(rng.bool(1)).toBe(true);
  });

  it("bool returns false with probability 0", () => {
    const rng = new RNG(7);
    expect(rng.bool(0)).toBe(false);
  });

  it("bool respects default probability near 0.5", () => {
    const rng = new RNG(8);
    const results = Array.from({ length: 200 }, () => rng.bool());
    const trueCount = results.filter(Boolean).length;
    expect(trueCount).toBeGreaterThan(60);
    expect(trueCount).toBeLessThan(140);
  });

  it("uuid returns valid v4 UUID format", () => {
    const rng = new RNG(9);
    const id = rng.uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("weightedPick favors higher weight items", () => {
    const rng = new RNG(10);
    const items = [{ value: "rare", weight: 1 }, { value: "common", weight: 100 }];
    const results = Array.from({ length: 200 }, () => rng.weightedPick(items));
    const commonCount = results.filter((v) => v === "common").length;
    expect(commonCount).toBeGreaterThan(150);
  });

  it("weightedPick returns last item when all weights exhausted", () => {
    const rng = new RNG(11);
    const items = [{ value: "only", weight: 0 }];
    expect(rng.weightedPick(items)).toBe("only");
  });

  it("gaussian produces values around mean", () => {
    const rng = new RNG(12);
    const vals = Array.from({ length: 500 }, () => rng.gaussian(10, 2));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    expect(avg).toBeGreaterThan(8);
    expect(avg).toBeLessThan(12);
  });

  it("logNormal produces positive values", () => {
    const rng = new RNG(13);
    const vals = Array.from({ length: 100 }, () => rng.logNormal(0, 1));
    vals.forEach((v) => expect(v).toBeGreaterThan(0));
  });

  it("poisson produces non-negative integers", () => {
    const rng = new RNG(14);
    const vals = Array.from({ length: 100 }, () => rng.poisson(3));
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  it("fork produces a different RNG with different seed", () => {
    const rng = new RNG(42);
    const forked = rng.fork("test");
    expect(forked.seed).not.toBe(rng.seed);
    expect(forked.random()).not.toBe(rng.random());
  });

  it("fork with same salt is deterministic", () => {
    const a = new RNG(42).fork("salt");
    const b = new RNG(42).fork("salt");
    expect(a.random()).toBe(b.random());
  });
});

describe("TemporalEngine distributions", () => {
  it("uniform distribution returns dates within range", () => {
    const rng = new RNG(1);
    const engine = new TemporalEngine(rng, { start, end, distribution: "uniform" });
    for (let i = 0; i < 20; i++) {
      const d = engine.next();
      expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(end.getTime());
    }
  });

  it("business-hours distribution returns dates within range", () => {
    const rng = new RNG(2);
    const engine = new TemporalEngine(rng, { start, end, distribution: "business-hours" });
    for (let i = 0; i < 20; i++) {
      const d = engine.next();
      expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
    }
  });

  it("burst distribution returns dates within range", () => {
    const rng = new RNG(3);
    const engine = new TemporalEngine(rng, { start, end, distribution: "burst", burstProbability: 0.5 });
    for (let i = 0; i < 20; i++) {
      const d = engine.next();
      expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
    }
  });

  it("series returns sorted dates", () => {
    const rng = new RNG(4);
    const engine = new TemporalEngine(rng, { start, end, distribution: "uniform" });
    const dates = engine.series(10);
    expect(dates).toHaveLength(10);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]!.getTime()).toBeGreaterThanOrEqual(dates[i - 1]!.getTime());
    }
  });

  it("uses default burst options when not provided", () => {
    const rng = new RNG(5);
    const engine = new TemporalEngine(rng, { start, end, distribution: "burst" });
    expect(() => engine.next()).not.toThrow();
  });
});

describe("Date utility functions", () => {
  const ref = new Date("2026-03-15T09:30:45.123Z");

  it("toHL7DateTime formats correctly", () => {
    expect(toHL7DateTime(ref)).toBe("20260315093045");
  });

  it("toHL7Date formats correctly", () => {
    expect(toHL7Date(ref)).toBe("20260315");
  });

  it("toFIXDateTime formats correctly", () => {
    expect(toFIXDateTime(ref)).toBe("20260315-09:30:45.123");
  });

  it("toSWIFTDate formats as YYMMDD", () => {
    expect(toSWIFTDate(ref)).toBe("260315");
  });

  it("toOFXDateTime equals toHL7DateTime", () => {
    expect(toOFXDateTime(ref)).toBe(toHL7DateTime(ref));
  });

  it("toX12Date equals toHL7Date", () => {
    expect(toX12Date(ref)).toBe(toHL7Date(ref));
  });

  it("toX12Time formats as HHMM", () => {
    expect(toX12Time(ref)).toBe("0930");
  });
});

describe("StateMachine", () => {
  type State = "idle" | "running" | "done";
  const states: State[] = ["idle", "running", "done"];
  const transitions: Record<State, Array<{ to: State; weight: number }>> = {
    idle: [{ to: "running", weight: 1 }],
    running: [{ to: "done", weight: 1 }],
    done: [{ to: "idle", weight: 1 }],
  };

  it("starts at first state", () => {
    const rng = new RNG(1);
    const sm = new StateMachine(states, transitions, rng);
    expect(sm.current()).toBe("idle");
  });

  it("advance moves to next state", () => {
    const rng = new RNG(1);
    const sm = new StateMachine(states, transitions, rng);
    const next = sm.advance();
    expect(next).toBe("running");
    expect(sm.current()).toBe("running");
  });

  it("path returns sequence including initial state", () => {
    const rng = new RNG(1);
    const sm = new StateMachine(states, transitions, rng);
    const path = sm.path(2);
    expect(path).toHaveLength(3);
    expect(path[0]).toBe("idle");
  });

  it("uses fallback when no transitions defined", () => {
    const rng = new RNG(2);
    const sm = new StateMachine(["solo" as State], {} as Record<State, Array<{ to: State; weight: number }>>, rng);
    const next = sm.advance();
    expect(next).toBe("solo");
  });
});
