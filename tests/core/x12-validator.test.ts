import { describe, expect, it } from "vitest";
import { X12Validator } from "../../src/validators/X12Validator.js";

describe("X12Validator", () => {
  it("warns on ISA-15 non P/T", async () => {
    const v = new X12Validator();
    const input = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260421*1200*^*00501*100000001*0*X*:~GS*HC*SENDER*RECV*20260421*1200*1*X*005010X222A1~ST*837*0001~NM1*41*2*SENDER*****46*123~SE*3*0001~GE*1*1~IEA*1*100000001~";
    const report = await v.validate(input);
    expect(report.warnings.some((w) => w.rule === "X12-006")).toBe(true);
  });
});

