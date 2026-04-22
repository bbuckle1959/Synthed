import { describe, expect, it } from "vitest";
import { FHIRR4Generator } from "../../src/generators/healthcare/FHIR_R4.js";
import { SyslogRFC5424Generator } from "../../src/generators/logs/SyslogRFC5424.js";
import { WindowsEventLogGenerator } from "../../src/generators/logs/WindowsEventLog.js";

describe("Phase 5 generators", () => {
  it("syslog emits structured data and offsets", async () => {
    const g = new SyslogRFC5424Generator();
    const out = (await g.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: {} }).next()).value;
    expect(out).toContain("[");
    expect(/[\+\-]\d{2}:\d{2}/.test(out)).toBe(true);
  });

  it("windows events include required event data structure", async () => {
    const g = new WindowsEventLogGenerator();
    const out = (await g.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: {} }).next()).value;
    expect(out).toContain("<EventID>");
    expect(out).toContain("<EventData>");
  });

  it("fhir searchset includes paging links", async () => {
    const g = new FHIRR4Generator();
    const out = (await g.generate({ seed: 1, recordCount: 2, corrupt: false, corruptRate: 0, locale: "en", extras: { bundleType: "searchset", baseUrl: "https://example.org/fhir" } }).next()).value;
    expect(out).toContain("\"link\"");
  });

  it("fhir rotates partial date precision", async () => {
    const g = new FHIRR4Generator();
    const outs: string[] = [];
    for await (const x of g.generate({ seed: 1, recordCount: 4, corrupt: false, corruptRate: 0, locale: "en", extras: { bundleType: "collection" } })) outs.push(x);
    expect(outs.some((o) => o.includes("\"effectiveDateTime\":\"2024\""))).toBe(true);
    expect(outs.some((o) => o.includes("\"effectiveDateTime\":\"2024-03\""))).toBe(true);
    expect(outs.some((o) => o.includes("\"effectiveDateTime\":\"2024-03-15T09:30:00+00:00\""))).toBe(true);
  });

  it("fhir includes condition with required status fields", async () => {
    const g = new FHIRR4Generator();
    const out = (await g.generate({ seed: 2, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: { bundleType: "collection" } }).next()).value;
    expect(out).toContain("\"resourceType\":\"Condition\"");
    expect(out).toContain("\"clinicalStatus\"");
    expect(out).toContain("\"verificationStatus\"");
  });
});

