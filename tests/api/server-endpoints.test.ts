import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/api/server.js";

describe("API endpoint contracts", () => {
  it("lists generators from GET /generators", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/v1/generators" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(typeof body[0].id).toBe("string");
  });

  it("describes one generator from GET /generators/:id", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/v1/generators/hl7v2" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; defaultOptions: unknown };
    expect(body.id).toBe("hl7v2");
    expect(body.defaultOptions).toBeDefined();
  });

  it("returns non-empty body from POST /generate", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/generate",
      payload: {
        generator: "hl7v2",
        options: { seed: 7, recordCount: 2 },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it("returns validation report JSON from /validate/:id", async () => {
    const app = await buildServer();
    const payload = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/validate/hl7v2",
      payload,
      headers: { "content-type": "text/plain" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generatorId).toBe("hl7v2");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("returns selftest result from /selftest/:id", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/selftest/fix",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generatorId).toBe("fix");
    expect(typeof body.passed).toBe("boolean");
  });

  it("returns 404 for unknown generator details", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/generators/does-not-exist",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });

  it("returns 400 for non-text validate payload", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/validate/hl7v2",
      payload: { bad: "payload" },
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
  });
});

