import { describe, expect, it } from "vitest";
import { CorruptionLayer, universalStrategies } from "../../src/core/CorruptionLayer.js";
import { RNG } from "../../src/core/RNG.js";

describe("CorruptionLayer", () => {
  it("creates a manifest for mutations", () => {
    const layer = new CorruptionLayer(universalStrategies);
    const rng = new RNG(1);
    const before = Date.now();
    const r = layer.mutateRecord("abcdefg h", { generatorId: "x", recordIndex: 0 }, rng, 1);
    const manifest = layer.createManifest("x", 1, 1, r.injected ? [r.injected] : []);
    const after = Date.now();
    expect(manifest.totalRecords).toBe(1);
    expect(manifest.errors.length).toBe(1);
    const generatedAtMs = Date.parse(manifest.generatedAt);
    expect(Number.isNaN(generatedAtMs)).toBe(false);
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(generatedAtMs).toBeLessThanOrEqual(after);
  });
});

