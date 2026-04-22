import { describe, expect, it } from "vitest";
import { CDRGenerator } from "../../src/generators/telecom/CDR.js";

describe("CDR ASN.1 BER output", () => {
  it("emits BER-like sequence records", async () => {
    const g = new CDRGenerator();
    const out = (await g.generate({ seed: 7, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: { format: "asn1-ber" } }).next()).value;
    expect(out.trim().startsWith("30")).toBe(true);
    expect(/^[0-9A-F]+$/i.test(out.trim())).toBe(true);
  });
});

