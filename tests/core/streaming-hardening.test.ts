import { describe, expect, it } from "vitest";
import { JobOrchestrator } from "../../src/orchestrator/JobOrchestrator.js";
import { createDefaultRegistry } from "../../src/orchestrator/defaultRegistry.js";

describe("Streaming hardening", () => {
  it("handles medium generation without throwing", async () => {
    const orchestrator = new JobOrchestrator(createDefaultRegistry());
    await expect(
      orchestrator.runJob({
        id: "stream-medium",
        generator: "apache-access-log",
        recordCount: 10000,
        seed: 42,
        output: { type: "file", path: "./output/stream-medium.log" },
      }),
    ).resolves.toBeUndefined();
  });
});

