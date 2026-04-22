import { describe, expect, it } from "vitest";
import { OFXGenerator } from "../../src/generators/finance/OFX.js";
import { X12Generator } from "../../src/generators/edi/X12.js";
import { EDIFACTGenerator } from "../../src/generators/edi/EDIFACT.js";

describe("OFX and X12 generators", () => {
  it("emit basic envelopes", async () => {
    const ofx = new OFXGenerator();
    const x12 = new X12Generator();
    const ofxOut = (await ofx.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: {} }).next()).value;
    const x12Out = (await x12.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: {} }).next()).value;
    expect(ofxOut).toContain("<OFX>");
    expect(x12Out).toContain("ISA*");
  });

  it("supports OFX 1.x SGML header", async () => {
    const ofx = new OFXGenerator();
    const ofxOut = (await ofx.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: { format: "1x" } }).next()).value;
    expect(ofxOut).toContain("OFXHEADER:100");
  });

  it("supports EDIFACT release escapes", async () => {
    const edi = new EDIFACTGenerator();
    const out = (await edi.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: { withEscapes: true } }).next()).value;
    expect(out).toContain("REF?+");
    expect(out).toContain("O?'BRIEN");
  });

  it("supports EDIFACT non-default delimiters", async () => {
    const edi = new EDIFACTGenerator();
    const out = (await edi.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: { delimiters: { component: ":", element: "*", decimal: ".", release: "!", segment: "~" } } }).next()).value;
    expect(out).toContain("UNA:*.! ~");
    expect(out).toContain("UNB*");
  });
});

