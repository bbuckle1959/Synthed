import { describe, expect, it } from "vitest";
import { matchManifest } from "../../src/validators/manifestMatcher.js";

describe("Manifest matcher confidence mapping", () => {
  it("prefers exact mapping only for compatible rule classes", () => {
    const injected = [{
      recordIndex: 0,
      byteOffset: 0,
      strategy: "fix-wrong-checksum",
      fieldPath: "tag10",
      originalValue: "001",
      injectedValue: "099",
      description: "checksum changed",
    }];
    const detected = [
      { severity: "error" as const, recordIndex: 0, fieldPath: "tag10", rule: "FIX-002", message: "wrong body len", actual: "x", expected: "y" },
      { severity: "error" as const, recordIndex: 0, fieldPath: "tag10", rule: "FIX-003", message: "wrong checksum", actual: "x", expected: "y" },
    ];
    const report = matchManifest(injected, detected);
    expect(report.matched.length).toBe(1);
    expect(report.matched[0]?.detected.rule).toBe("FIX-003");
  });
});

