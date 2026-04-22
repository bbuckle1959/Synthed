import { describe, expect, it } from "vitest";
import { HL7v2Generator } from "../../src/generators/healthcare/HL7v2.js";

describe("HL7v2 generator", () => {
  it("emits MSH and PID", async () => {
    const g = new HL7v2Generator();
    const arr: string[] = [];
    for await (const x of g.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: {} })) arr.push(x);
    expect(arr[0]).toContain("MSH|");
    expect(arr[0]).toContain("PID|");
    expect(arr[0]).toContain("PV1|");
  });

  it("supports HL7 batch envelope mode", async () => {
    const g = new HL7v2Generator();
    const arr: string[] = [];
    for await (const x of g.generate({ seed: 1, recordCount: 2, corrupt: false, corruptRate: 0, locale: "en", extras: { batchMode: true } })) arr.push(x);
    const out = arr.join("");
    expect(out).toContain("FHS|");
    expect(out).toContain("BHS|");
    expect(out).toContain("BTS|2");
    expect(out).toContain("FTS|1");
  });
});

