import { describe, expect, it } from "vitest";
import { HL7v2Generator } from "../../src/generators/healthcare/HL7v2.js";

describe("HL7 optional segment shape", () => {
  it("emits optional segments across a sample", async () => {
    const g = new HL7v2Generator();
    let hasPd1 = false;
    let hasNk1 = false;
    let hasZ = false;
    for await (const msg of g.generate({ seed: 42, recordCount: 40, corrupt: false, corruptRate: 0, locale: "en", extras: { messageTypes: ["ADT_A01"] } })) {
      hasPd1 ||= msg.includes("PD1|");
      hasNk1 ||= msg.includes("NK1|");
      hasZ ||= msg.includes("ZXT|");
    }
    expect(hasPd1).toBe(true);
    expect(hasNk1).toBe(true);
    expect(hasZ).toBe(true);
  });
});

