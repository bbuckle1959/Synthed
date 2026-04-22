import type { InjectedError, ValidationError } from "../core/interfaces.js";

export interface ManifestMatchReport {
  totalInjected: number;
  totalDetected: number;
  matched: Array<{ injected: InjectedError; detected: ValidationError; confidence: "exact" | "approximate" }>;
  missed: InjectedError[];
  unexpected: ValidationError[];
  cascades: ValidationError[];
  detectionRate: number;
}

const CASCADE_BYTE_WINDOW = 100;

export function matchManifest(injected: InjectedError[], detected: ValidationError[]): ManifestMatchReport {
  const used = new Set<number>();
  const matched: ManifestMatchReport["matched"] = [];
  const missed: InjectedError[] = [];
  for (const inj of injected) {
    const isCompatible = (rule: string): boolean => {
      const strat = inj.strategy.toLowerCase();
      const r = rule.toLowerCase();
      if (strat.includes("checksum")) return r.includes("fix-003");
      if (strat.includes("body-length")) return r.includes("fix-002");
      if (strat.includes("pid-sex")) return r.includes("hl7-009");
      if (strat.includes("segment-order")) return r.includes("hl7-016");
      return true;
    };
    let idx = detected.findIndex((d, i) => !used.has(i) && d.recordIndex === inj.recordIndex && d.fieldPath === inj.fieldPath);
    let confidence: "exact" | "approximate" = "exact";
    if (idx >= 0) {
      const d = detected[idx]!;
      if (!isCompatible(d.rule)) {
        idx = -1;
      }
    }
    if (idx < 0) {
      idx = detected.findIndex((d, i) => !used.has(i) && d.recordIndex === inj.recordIndex && isCompatible(d.rule));
      if (idx < 0) idx = detected.findIndex((d, i) => !used.has(i) && d.recordIndex === inj.recordIndex);
      confidence = "approximate";
    }
    if (idx < 0) {
      missed.push(inj);
      continue;
    }
    used.add(idx);
    matched.push({ injected: inj, detected: detected[idx]!, confidence });
  }
  const unexpected = detected.filter((_, i) => !used.has(i));
  const cascades = unexpected.filter((u) => injected.some((inj) => inj.recordIndex === u.recordIndex && Math.abs((u.byteOffset ?? 0) - inj.byteOffset) <= CASCADE_BYTE_WINDOW));
  return {
    totalInjected: injected.length,
    totalDetected: detected.length,
    matched,
    missed,
    unexpected: unexpected.filter((u) => !cascades.includes(u)),
    cascades,
    detectionRate: injected.length === 0 ? 1 : matched.length / injected.length,
  };
}

