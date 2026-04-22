import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { z } from "zod";
import type { RootConfig } from "../core/interfaces.js";

const jobSchema = z.object({
  id: z.string(),
  generator: z.string(),
  recordCount: z.number().int().positive().max(100_000).optional(),
  seed: z.number().int().optional(),
  corrupt: z.boolean().optional(),
  corruptRate: z.number().min(0).max(1).optional(),
  corruptStrategies: z.record(z.string(), z.number()).optional(),
  locale: z.string().optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
  output: z.object({ type: z.enum(["stdout", "file"]), path: z.string().optional(), compress: z.boolean().optional() }),
  manifest: z.object({ type: z.literal("file"), path: z.string() }).optional(),
});

const rootSchema = z.object({
  version: z.string(),
  seed: z.number().int().optional(),
  jobs: z.array(jobSchema),
});

export async function loadConfig(path: string): Promise<RootConfig> {
  const raw = await readFile(path, "utf8");
  const parsed = YAML.parse(raw);
  return rootSchema.parse(parsed);
}

