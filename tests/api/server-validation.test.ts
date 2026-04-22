import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/api/server.js";

describe("API validation handling", () => {
  it("returns 400 for invalid generate payload", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "", options: { seed: "not-number" } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when recordCount exceeds the maximum of 100,000", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "hl7v2", options: { seed: 1, recordCount: 100_001 } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.details.some((d: { path: string }) => d.path === "options.recordCount")).toBe(true);
  });
});

