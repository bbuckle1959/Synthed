import { writeFile } from "node:fs/promises";
import { CorruptionLayer, universalStrategies } from "../core/CorruptionLayer.js";
import { RNG } from "../core/RNG.js";
import type { GeneratorOptions, JobConfig, RootConfig } from "../core/interfaces.js";
import { Registry } from "./Registry.js";
import { FileSink, StdoutSink } from "./sinks.js";

export class JobOrchestrator {
  constructor(private readonly registry: Registry) {}

  async runJob(job: JobConfig, globalSeed?: number): Promise<void> {
    const seed = job.seed ?? globalSeed ?? 42;
    const gen = this.registry.getGenerator(job.generator);
    const options: GeneratorOptions = {
      seed,
      recordCount: job.recordCount ?? 100,
      corrupt: job.corrupt ?? false,
      corruptRate: job.corruptRate ?? 0,
      corruptStrategies: job.corruptStrategies,
      locale: job.locale ?? "en",
      extras: job.extras ?? {},
    };
    const layer = new CorruptionLayer(universalStrategies);
    const corruptionRng = new RNG(seed + 99);
    const errors: NonNullable<ReturnType<typeof layer.createManifest>["errors"]> = [];
    let recordIndex = 0;
    const sink = job.output.type === "stdout" ? new StdoutSink() : new FileSink(job.output.path ?? `./output/${job.id}.txt`, job.output.compress ?? false);
    for await (const rec of gen.generate(options)) {
      if (options.corrupt) {
        const result = layer.mutateRecord(rec, { generatorId: gen.id, recordIndex }, corruptionRng, options.corruptRate, options.corruptStrategies);
        if (result.injected) errors.push(result.injected);
        await sink.write(result.mutated);
      } else {
        await sink.write(rec);
      }
      recordIndex += 1;
    }
    await sink.close();
    if (options.corrupt && job.manifest?.path) {
      const manifest = layer.createManifest(gen.id, seed, recordIndex, errors);
      await writeFile(job.manifest.path, JSON.stringify(manifest, null, 2), "utf8");
    }
  }

  async runConfig(config: RootConfig): Promise<void> {
    for (const job of config.jobs) await this.runJob(job, config.seed);
  }
}

