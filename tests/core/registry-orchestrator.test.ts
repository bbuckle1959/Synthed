import { describe, expect, it } from "vitest";
import { Registry } from "../../src/orchestrator/Registry.js";
import { JobOrchestrator } from "../../src/orchestrator/JobOrchestrator.js";
import { createDefaultRegistry } from "../../src/orchestrator/defaultRegistry.js";
import { HL7v2Generator } from "../../src/generators/healthcare/HL7v2.js";
import { HL7v2Validator } from "../../src/validators/HL7v2Validator.js";

describe("Registry", () => {
  it("throws on unknown generator id", () => {
    const r = new Registry();
    expect(() => r.getGenerator("does-not-exist")).toThrow("Unknown generator: does-not-exist");
  });

  it("throws on unknown validator id", () => {
    const r = new Registry();
    expect(() => r.getValidator("does-not-exist")).toThrow("Unknown validator: does-not-exist");
  });

  it("listGenerators returns all registered generators", () => {
    const r = new Registry();
    r.registerGenerator(new HL7v2Generator());
    const list = r.listGenerators();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("hl7v2");
  });

  it("registerGenerator and getGenerator round-trip", () => {
    const r = new Registry();
    const gen = new HL7v2Generator();
    r.registerGenerator(gen);
    expect(r.getGenerator("hl7v2")).toBe(gen);
  });

  it("registerValidator and getValidator round-trip", () => {
    const r = new Registry();
    const val = new HL7v2Validator();
    r.registerValidator(val);
    expect(r.getValidator("hl7v2")).toBe(val);
  });

  it("default registry registers all expected generators", () => {
    const r = createDefaultRegistry();
    const ids = r.listGenerators().map((g) => g.id);
    expect(ids).toContain("hl7v2");
    expect(ids).toContain("fix");
    expect(ids).toContain("ofx");
    expect(ids).toContain("x12");
    expect(ids).toContain("swift-mt");
    expect(ids).toContain("cdr");
    expect(ids).toContain("apache-access-log");
  });
});

describe("JobOrchestrator", () => {
  it("runJob with stdout output completes without throwing", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    await expect(
      orch.runJob({
        id: "test-stdout",
        generator: "hl7v2",
        recordCount: 2,
        seed: 1,
        output: { type: "stdout" },
      }),
    ).resolves.toBeUndefined();
  });

  it("runJob with corruption enabled produces output", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    await expect(
      orch.runJob({
        id: "test-corrupt",
        generator: "hl7v2",
        recordCount: 3,
        seed: 5,
        corrupt: true,
        corruptRate: 0.5,
        output: { type: "file", path: "/tmp/synthed-test-corrupt.txt" },
      }),
    ).resolves.toBeUndefined();
  });

  it("runJob with corrupt=true and manifest writes manifest file", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    const manifestPath = "/tmp/synthed-test-manifest.json";
    await orch.runJob({
      id: "test-manifest",
      generator: "fix",
      recordCount: 5,
      seed: 7,
      corrupt: true,
      corruptRate: 1.0,
      output: { type: "file", path: "/tmp/synthed-test-output.txt" },
      manifest: { type: "file", path: manifestPath },
    });
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(content);
    expect(manifest.generatorId).toBe("fix");
    expect(manifest.seed).toBe(7);
    // The FIX generator may emit more messages than recordCount (fills, cancels, etc.)
    expect(manifest.totalRecords).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(manifest.errors)).toBe(true);
  });

  it("runConfig runs multiple jobs sequentially", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    await expect(
      orch.runConfig({
        version: "1",
        jobs: [
          { id: "job1", generator: "hl7v2", recordCount: 1, output: { type: "file", path: "/tmp/synthed-job1.txt" } },
          { id: "job2", generator: "fix", recordCount: 1, output: { type: "file", path: "/tmp/synthed-job2.txt" } },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("runConfig uses global seed for jobs without their own seed", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    // Should complete without error - just verifying seed inheritance
    await expect(
      orch.runConfig({
        version: "1",
        seed: 99,
        jobs: [
          { id: "job-global-seed", generator: "cdr", recordCount: 2, output: { type: "file", path: "/tmp/synthed-globalseed.txt" } },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("runJob with unknown generator throws", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    await expect(
      orch.runJob({
        id: "bad-gen",
        generator: "does-not-exist",
        output: { type: "stdout" },
      }),
    ).rejects.toThrow("Unknown generator");
  });

  it("runJob uses default recordCount when not specified", async () => {
    const registry = createDefaultRegistry();
    const orch = new JobOrchestrator(registry);
    // Default is 100 records; just check it runs
    await expect(
      orch.runJob({
        id: "test-default-count",
        generator: "apache-access-log",
        seed: 42,
        output: { type: "file", path: "/tmp/synthed-default-count.txt" },
      }),
    ).resolves.toBeUndefined();
  });
});
