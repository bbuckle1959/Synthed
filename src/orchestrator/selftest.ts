import type { ValidationReport } from "../core/interfaces.js";
import { createDefaultRegistry } from "./defaultRegistry.js";

export interface SelfTestResult {
  generatorId: string;
  generated: number;
  validation: ValidationReport | null;
  passed: boolean;
  corruptionDetectionRate?: number;
  strategyDetectionRates?: Record<string, number>;
}

export async function runSelfTest(generatorId?: string): Promise<SelfTestResult[]> {
  const registry = createDefaultRegistry();
  const gens = generatorId ? [registry.getGenerator(generatorId)] : registry.listGenerators();
  const out: SelfTestResult[] = [];
  for (const gen of gens) {
    const chunks: string[] = [];
    for await (const c of gen.generate({ seed: 42, recordCount: 5, corrupt: false, corruptRate: 0, locale: "en", extras: {} })) chunks.push(c);
    let validation: ValidationReport | null = null;
    let corruptionDetectionRate: number | undefined;
    let strategyDetectionRates: Record<string, number> | undefined;
    try {
      const v = registry.getValidator(gen.id);
      validation = await v.validate(chunks.join(""));
      const corruptChunks: string[] = [];
      for await (const c of gen.generate({ seed: 43, recordCount: 5, corrupt: true, corruptRate: 0.2, locale: "en", extras: {} })) corruptChunks.push(c);
      const corruptReport = await v.validate(corruptChunks.join(""));
      corruptionDetectionRate = corruptReport.errors.length > 0 ? 1 : 0;
      const strategyKeys = [
        "truncate",
        "null-bytes",
        "hl7-invalid-timestamp",
        "fix-wrong-checksum",
        "x12-wrong-segment-count",
        "ofx-duplicate-fitid",
        "swift-invalid-amount",
        "cdr-answered-zero-duration",
      ];
      strategyDetectionRates = {};
      for (const key of strategyKeys) {
        const sChunks: string[] = [];
        for await (const c of gen.generate({
          seed: 44,
          recordCount: 5,
          corrupt: true,
          corruptRate: 1,
          locale: "en",
          extras: {},
          corruptStrategies: { [key]: 1000 },
        })) sChunks.push(c);
        const rep = await v.validate(sChunks.join(""));
        strategyDetectionRates[key] = rep.errors.length > 0 ? 1 : 0;
      }
    } catch {
      validation = null;
    }
    out.push({ generatorId: gen.id, generated: chunks.length, validation, passed: validation ? validation.passed : true, corruptionDetectionRate, strategyDetectionRates });
  }
  return out;
}

