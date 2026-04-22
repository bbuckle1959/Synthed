import { describe, expect, it } from "vitest";
import { FIXValidator } from "../../src/validators/FIXValidator.js";

describe("FIX 35=G rule coverage", () => {
  it("flags missing required tags for 35=G", async () => {
    const v = new FIXValidator();
    const badG = "8=FIX.4.4\x019=20\x0135=G\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0111=ORD1\x0110=000\x01";
    const report = await v.validate(badG);
    expect(report.errors.some((e) => e.rule === "FIX-008")).toBe(true);
  });
});

