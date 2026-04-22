import { describe, expect, it } from "vitest";
import { CorruptionLayer, universalStrategies } from "../../src/core/CorruptionLayer.js";
import { RNG } from "../../src/core/RNG.js";

describe("Corruption strategy coverage", () => {
  it("can apply hl7-specific strategy", () => {
    const layer = new CorruptionLayer(universalStrategies);
    const rng = new RNG(9);
    const input = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const result = layer.mutateRecord(input, { generatorId: "hl7v2", recordIndex: 0 }, rng, 1, { "hl7-invalid-pid-sex": 1000 });
    expect(result.injected?.strategy).toBe("hl7-invalid-pid-sex");
  });

  it("can apply fix-specific strategy", () => {
    const layer = new CorruptionLayer(universalStrategies);
    const rng = new RNG(11);
    const input = "8=FIX.4.4\x019=12\x0135=D\x0134=1\x0149=S\x0152=20260101-00:00:00.000\x0155=AAPL\x0156=T\x0111=O1\x0121=1\x0138=10\x0140=2\x0154=1\x0110=000\x01";
    const result = layer.mutateRecord(input, { generatorId: "fix", recordIndex: 0 }, rng, 1, { "fix-wrong-body-length": 1000 });
    expect(result.injected?.strategy).toBe("fix-wrong-body-length");
  });

  it("can apply swift-specific strategy", () => {
    const layer = new CorruptionLayer(universalStrategies);
    const rng = new RNG(13);
    const input = "{4:\n:32A:240315EUR125000,50\n-}\n";
    const result = layer.mutateRecord(input, { generatorId: "swift-mt", recordIndex: 0 }, rng, 1, { "swift-invalid-amount": 1000 });
    expect(result.injected?.strategy).toBe("swift-invalid-amount");
  });

  it("can apply cdr future timestamp strategy", () => {
    const layer = new CorruptionLayer(universalStrategies);
    const rng = new RNG(15);
    const input = "2026-04-21 12:00:00,\"Caller\",+44123,+44124,ctx,ch,dch,app,,30,30,ANSWERED,DOC,1.1";
    const result = layer.mutateRecord(input, { generatorId: "cdr", recordIndex: 0 }, rng, 1, { "cdr-future-timestamp": 1000 });
    expect(result.injected?.strategy).toBe("cdr-future-timestamp");
  });

  it("can apply ofx imbalance strategy", () => {
    const layer = new CorruptionLayer(universalStrategies);
    const rng = new RNG(21);
    const input = "<OFX><LEDGERBAL><BALAMT>100.00</BALAMT></LEDGERBAL><TRNTYPE>DEBIT</TRNTYPE><TRNAMT>-5.00</TRNAMT></OFX>";
    const result = layer.mutateRecord(input, { generatorId: "ofx", recordIndex: 0 }, rng, 1, { "ofx-imbalanced-statement": 1000 });
    expect(result.injected?.strategy).toBe("ofx-imbalanced-statement");
  });
});

