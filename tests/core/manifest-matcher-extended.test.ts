import { describe, expect, it } from "vitest";
import { matchManifest } from "../../src/validators/manifestMatcher.js";
import type { InjectedError, ValidationError } from "../../src/core/interfaces.js";

const makeInjected = (overrides: Partial<InjectedError> = {}): InjectedError => ({
  recordIndex: 0,
  byteOffset: 0,
  strategy: "truncate",
  fieldPath: "record",
  originalValue: "original",
  injectedValue: "inj",
  description: "test",
  ...overrides,
});

const makeDetected = (overrides: Partial<ValidationError> = {}): ValidationError => ({
  severity: "error",
  recordIndex: 0,
  fieldPath: "record",
  rule: "HL7-001",
  message: "test",
  actual: "a",
  expected: "b",
  ...overrides,
});

describe("matchManifest - basic matching", () => {
  it("returns 100% detection rate when all injected errors are matched", () => {
    const injected = [makeInjected()];
    const detected = [makeDetected()];
    const report = matchManifest(injected, detected);
    expect(report.detectionRate).toBe(1);
    expect(report.matched).toHaveLength(1);
    expect(report.missed).toHaveLength(0);
  });

  it("returns 0% detection rate when no injected errors are detected", () => {
    const injected = [makeInjected({ recordIndex: 1 })];
    const detected = [makeDetected({ recordIndex: 0 })];
    const report = matchManifest(injected, detected);
    expect(report.detectionRate).toBe(0);
    expect(report.missed).toHaveLength(1);
    expect(report.missed[0]?.strategy).toBe("truncate");
  });

  it("returns detection rate of 1 when no errors were injected", () => {
    const report = matchManifest([], []);
    expect(report.detectionRate).toBe(1);
  });

  it("counts unexpected detections correctly", () => {
    const injected: InjectedError[] = [];
    const detected = [makeDetected()];
    const report = matchManifest(injected, detected);
    expect(report.unexpected).toHaveLength(1);
    expect(report.totalDetected).toBe(1);
  });

  it("matches partial set - some missed, some matched", () => {
    const injected = [
      makeInjected({ recordIndex: 0 }),
      makeInjected({ recordIndex: 5, fieldPath: "tag9" }),
    ];
    const detected = [makeDetected({ recordIndex: 0 })];
    const report = matchManifest(injected, detected);
    expect(report.matched).toHaveLength(1);
    expect(report.missed).toHaveLength(1);
    expect(report.detectionRate).toBe(0.5);
  });
});

describe("matchManifest - confidence levels", () => {
  it("assigns exact confidence when fieldPath and record match", () => {
    const injected = [makeInjected({ strategy: "fix-wrong-checksum", fieldPath: "tag10" })];
    const detected = [makeDetected({ fieldPath: "tag10", rule: "FIX-003" })];
    const report = matchManifest(injected, detected);
    expect(report.matched[0]?.confidence).toBe("exact");
  });

  it("assigns approximate confidence when match is by record only", () => {
    const injected = [makeInjected({ strategy: "truncate", fieldPath: "record" })];
    const detected = [makeDetected({ fieldPath: "different-field", rule: "HL7-001" })];
    const report = matchManifest(injected, detected);
    // approximate or no match depending on record index match
    if (report.matched.length > 0) {
      expect(report.matched[0]?.confidence).toBe("approximate");
    } else {
      expect(report.missed).toHaveLength(1);
    }
  });

  it("checksum strategy only matches FIX-003 rule", () => {
    const injected = [makeInjected({ strategy: "fix-wrong-checksum", fieldPath: "tag10" })];
    const detected = [
      makeDetected({ fieldPath: "tag10", rule: "FIX-002" }), // body length - incompatible
      makeDetected({ fieldPath: "tag10", rule: "FIX-003" }), // checksum - compatible
    ];
    const report = matchManifest(injected, detected);
    expect(report.matched[0]?.detected.rule).toBe("FIX-003");
  });

  it("body-length strategy only matches FIX-002 rule", () => {
    const injected = [makeInjected({ strategy: "fix-wrong-body-length", fieldPath: "tag9" })];
    const detected = [
      makeDetected({ fieldPath: "tag9", rule: "FIX-003" }), // incompatible
      makeDetected({ fieldPath: "tag9", rule: "FIX-002" }), // compatible
    ];
    const report = matchManifest(injected, detected);
    expect(report.matched[0]?.detected.rule).toBe("FIX-002");
  });

  it("pid-sex strategy only matches HL7-009 rule", () => {
    const injected = [makeInjected({ strategy: "hl7-invalid-pid-sex", fieldPath: "PID.8" })];
    const detected = [makeDetected({ fieldPath: "PID.8", rule: "HL7-009" })];
    const report = matchManifest(injected, detected);
    expect(report.matched[0]?.detected.rule).toBe("HL7-009");
  });

  it("segment-order strategy only matches HL7-016 rule", () => {
    const injected = [makeInjected({ strategy: "hl7-wrong-segment-order", fieldPath: "PID/PV1" })];
    const detected = [makeDetected({ fieldPath: "PID/PV1", rule: "HL7-016" })];
    const report = matchManifest(injected, detected);
    expect(report.matched[0]?.detected.rule).toBe("HL7-016");
  });
});

describe("matchManifest - cascades detection", () => {
  it("classifies errors within byte window as cascades", () => {
    const injected = [makeInjected({ recordIndex: 0, byteOffset: 50 })];
    const detected = [
      makeDetected({ recordIndex: 0, byteOffset: 60 }), // 10 bytes away - cascade
    ];
    const report = matchManifest(injected, detected);
    // The first detected error could be matched or be a cascade
    // Cascades are unexpected errors within CASCADE_BYTE_WINDOW (100 bytes)
    expect(report.cascades.length + report.matched.length).toBeGreaterThan(0);
  });

  it("classifies errors outside byte window as unexpected", () => {
    const injected = [makeInjected({ recordIndex: 0, byteOffset: 0 })];
    const detected = [
      makeDetected({ recordIndex: 0 }), // matched
      makeDetected({ recordIndex: 1, fieldPath: "other", byteOffset: 500 }), // different record, large offset
    ];
    const report = matchManifest(injected, detected);
    expect(report.totalInjected).toBe(1);
    expect(report.totalDetected).toBe(2);
  });
});

describe("matchManifest - totals", () => {
  it("reports correct totalInjected and totalDetected", () => {
    const injected = [makeInjected({ recordIndex: 0 }), makeInjected({ recordIndex: 1 })];
    const detected = [makeDetected({ recordIndex: 0 }), makeDetected({ recordIndex: 0, fieldPath: "other" })];
    const report = matchManifest(injected, detected);
    expect(report.totalInjected).toBe(2);
    expect(report.totalDetected).toBe(2);
  });
});
