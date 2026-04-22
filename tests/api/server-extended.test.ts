import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/api/server.js";

describe("API server - extended coverage", () => {
  it("returns 404 for unknown validator in POST /validate/:id", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/validate/does-not-exist",
      payload: "MSH|^~\\&|A",
      headers: { "content-type": "text/plain" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });

  it("returns 404 for unknown generator in POST /selftest/:id", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/selftest/does-not-exist",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });

  it("returns 404 for unknown generator in POST /generate", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "does-not-exist", options: { seed: 1, recordCount: 1 } },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });

  it("validates fix records via POST /validate/fix", async () => {
    const app = await buildServer();
    const fixMsg = "8=FIX.4.4\x019=12\x0135=D\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=999\x01";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/validate/fix",
      payload: fixMsg,
      headers: { "content-type": "text/plain" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generatorId).toBe("fix");
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("returns all generators from GET /generators", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/v1/generators" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; description: string; defaultOptions: unknown }>;
    const ids = body.map((g) => g.id);
    expect(ids).toContain("hl7v2");
    expect(ids).toContain("fix");
    expect(ids).toContain("swift-mt");
    expect(ids).toContain("cdr");
    body.forEach((g) => {
      expect(typeof g.description).toBe("string");
      expect(g.defaultOptions).toBeDefined();
    });
  });

  it("returns generator detail with extraSchema from GET /generators/:id", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/v1/generators/fix" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("fix");
    expect(body).toHaveProperty("extraSchema");
  });

  it("can generate swift-mt records via POST /generate", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "swift-mt", options: { seed: 1, recordCount: 2 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(0);
    expect(res.rawPayload.toString()).toContain("{1:F01");
  });

  it("POST /generate with corrupt=true returns data", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "cdr", options: { seed: 5, recordCount: 3, corrupt: true, corruptRate: 0.5 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it("selftest for hl7v2 returns passed field", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "POST", url: "/api/v1/selftest/hl7v2" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generatorId).toBe("hl7v2");
    expect(typeof body.passed).toBe("boolean");
  });

  it("returns 400 when recordCount is 0", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "hl7v2", options: { seed: 1, recordCount: 0 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when seed is not an integer", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: { generator: "hl7v2", options: { seed: 1.5, recordCount: 1 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
  });
});
