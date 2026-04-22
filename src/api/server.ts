import Fastify from "fastify";
import { createDefaultRegistry } from "../orchestrator/defaultRegistry.js";
import { runSelfTest } from "../orchestrator/selftest.js";
import { z } from "zod";

const generateBodySchema = z.object({
  generator: z.string().min(1),
  options: z.object({
    seed: z.number().int(),
    recordCount: z.number().int().positive().max(100_000),
    corrupt: z.boolean().optional(),
    corruptRate: z.number().min(0).max(1).optional(),
    locale: z.string().optional(),
    extras: z.record(z.string(), z.unknown()).optional(),
  }),
});

export async function buildServer() {
  const app = Fastify();
  const registry = createDefaultRegistry();
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) {
      void reply.status(400).send({ error: "VALIDATION_ERROR", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    if (err instanceof Error && /Unknown generator|Unknown validator/.test(err.message)) {
      void reply.status(404).send({ error: "NOT_FOUND", message: err.message });
      return;
    }
    void reply.status(500).send({ error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  });

  app.get("/api/v1/generators", async () => registry.listGenerators().map((g) => ({ id: g.id, description: g.description, defaultOptions: g.defaultOptions })));
  app.get("/api/v1/generators/:id", async (req: any) => {
    const g = registry.getGenerator(req.params.id);
    return { id: g.id, description: g.description, defaultOptions: g.defaultOptions, extraSchema: {} };
  });
  app.post("/api/v1/generate", async (req: any, reply) => {
    const body = generateBodySchema.parse(req.body);
    const gen = registry.getGenerator(body.generator);
    reply.type("application/octet-stream");
    for await (const chunk of gen.generate({ corrupt: false, corruptRate: 0, locale: "en", extras: {}, ...body.options })) reply.raw.write(chunk);
    reply.raw.end();
    return reply;
  });
  app.post("/api/v1/validate/:id", async (req: any) => {
    const payload = z.string().parse(req.body);
    return registry.getValidator(req.params.id).validate(payload);
  });
  app.post("/api/v1/selftest/:id", async (req: any) => (await runSelfTest(req.params.id))[0]);
  return app;
}

if (process.argv.includes("--start")) {
  const app = await buildServer();
  await app.listen({ host: "0.0.0.0", port: 3000 });
}

