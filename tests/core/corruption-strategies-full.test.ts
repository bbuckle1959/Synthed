import { describe, expect, it } from "vitest";
import { CorruptionLayer, universalStrategies } from "../../src/core/CorruptionLayer.js";
import { RNG } from "../../src/core/RNG.js";

const layer = new CorruptionLayer(universalStrategies);

const hl7Record = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
const fixRecord = "8=FIX.4.4\x019=60\x0135=D\x0134=1\x0149=S\x0152=20260101-00:00:00.000\x0155=AAPL\x0156=T\x0111=O1\x0121=1\x0138=10\x0140=2\x0154=1\x0110=100\x01";
const x12Record = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260421*1200*^*00501*100000001*0*P*:~GS*HC*SENDER*RECV*20260421*1200*1*X*005010X222A1~ST*837*0001~NM1*41*2*SENDER*****46*123~SE*4*0001~GE*1*1~IEA*1*100000001~";
const ofxRecord = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><OPENINGBAL>100.00</OPENINGBAL><BANKTRANLIST><DTSTART>20260101</DTSTART><DTEND>20260131</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260115</DTPOSTED><TRNAMT>-5.00</TRNAMT><FITID>ID001</FITID></STMTTRN><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260120</DTPOSTED><TRNAMT>10.00</TRNAMT><FITID>ID002</FITID></STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>105.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
const swiftRecord = "{1:F01BARCGB22AXXX0000000000}{2:I103BNPAFRPPXXXXN}{4:\n:20:TXREF1\n:32A:240315EUR125000,50\n:50K:JOHN\n:59:HANS\n:70:PAYMENT FOR INVOICE\n:71A:OUR\n-}\n";
const cdrRecord = "2026-04-21 12:00:00,\"Caller\",+44123,+44124,ctx,ch,dch,app,,30,30,ANSWERED,DOC,490154203237518|234101234567890|1.1";

describe("CorruptionLayer - zero corruptRate skips mutation", () => {
  it("returns original record unchanged when corruptRate is 0", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord("somerecord", { generatorId: "x", recordIndex: 0 }, rng, 0);
    expect(result.mutated).toBe("somerecord");
    expect(result.injected).toBeUndefined();
  });
});

describe("CorruptionLayer - createManifest with no errors", () => {
  it("creates manifest with empty errors list", () => {
    const manifest = layer.createManifest("mygen", 42, 100, []);
    expect(manifest.generatorId).toBe("mygen");
    expect(manifest.seed).toBe(42);
    expect(manifest.totalRecords).toBe(100);
    expect(manifest.errors).toHaveLength(0);
    expect(manifest.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("CorruptionLayer - universal strategies", () => {
  it("overlength-field: expands a pipe-delimited field", () => {
    const strat = universalStrategies.find((s) => s.id === "overlength-field")!;
    const rng = new RNG(1);
    const result = strat.mutate("a|b|c|d", rng);
    expect(result).not.toBeNull();
    expect(result!.mutated.length).toBeGreaterThan(1024);
    expect(result!.error.strategy).toBe("overlength-field");
  });

  it("overlength-field: returns null for record with no separator", () => {
    const strat = universalStrategies.find((s) => s.id === "overlength-field")!;
    const rng = new RNG(1);
    expect(strat.mutate("noseperator", rng)).toBeNull();
  });

  it("truncate: shortens the record", () => {
    const strat = universalStrategies.find((s) => s.id === "truncate")!;
    const rng = new RNG(2);
    const record = "A".repeat(100);
    const result = strat.mutate(record, rng);
    expect(result).not.toBeNull();
    expect(result!.mutated.length).toBeLessThan(record.length);
    expect(result!.error.strategy).toBe("truncate");
  });

  it("truncate: returns null for short records", () => {
    const strat = universalStrategies.find((s) => s.id === "truncate")!;
    const rng = new RNG(2);
    expect(strat.mutate("short", rng)).toBeNull();
  });

  it("null-bytes: injects null bytes into record", () => {
    const strat = universalStrategies.find((s) => s.id === "null-bytes")!;
    const rng = new RNG(3);
    const result = strat.mutate("hello world", rng);
    expect(result).not.toBeNull();
    expect(result!.mutated).toContain("\x00");
  });

  it("wrong-encoding: injects control range byte", () => {
    const strat = universalStrategies.find((s) => s.id === "wrong-encoding")!;
    const rng = new RNG(4);
    const result = strat.mutate("hello", rng);
    expect(result).not.toBeNull();
    expect(result!.mutated.length).toBeGreaterThan("hello".length);
    expect(result!.error.strategy).toBe("wrong-encoding");
  });

  it("duplicate-record: doubles the record content", () => {
    const strat = universalStrategies.find((s) => s.id === "duplicate-record")!;
    const rng = new RNG(5);
    const result = strat.mutate("RECORD", rng);
    expect(result).not.toBeNull();
    expect(result!.mutated).toBe("RECORDRECORD");
  });

  it("extra-whitespace: injects extra spaces at first space", () => {
    const strat = universalStrategies.find((s) => s.id === "extra-whitespace")!;
    const rng = new RNG(6);
    const result = strat.mutate("hello world", rng);
    expect(result).not.toBeNull();
    expect(result!.mutated).toContain("  ");
    expect(result!.error.strategy).toBe("extra-whitespace");
  });

  it("extra-whitespace: returns null when no space present", () => {
    const strat = universalStrategies.find((s) => s.id === "extra-whitespace")!;
    const rng = new RNG(6);
    expect(strat.mutate("nospace", rng)).toBeNull();
  });
});

describe("CorruptionLayer - HL7 strategies", () => {
  it("hl7-missing-required-segment: removes PID or PV1", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord(hl7Record, { generatorId: "hl7v2", recordIndex: 0 }, rng, 1, { "hl7-missing-required-segment": 1000 });
    expect(result.injected?.strategy).toBe("hl7-missing-required-segment");
    expect(result.mutated).not.toContain(result.injected?.originalValue);
  });

  it("hl7-wrong-segment-order: swaps PID and PV1", () => {
    const rng = new RNG(2);
    const result = layer.mutateRecord(hl7Record, { generatorId: "hl7v2", recordIndex: 0 }, rng, 1, { "hl7-wrong-segment-order": 1000 });
    expect(result.injected?.strategy).toBe("hl7-wrong-segment-order");
    const segs = result.mutated.split("\r").filter(Boolean);
    const pidIdx = segs.findIndex((s) => s.startsWith("PID|"));
    const pv1Idx = segs.findIndex((s) => s.startsWith("PV1|"));
    expect(pv1Idx).toBeLessThan(pidIdx);
  });

  it("hl7-repeated-msh: prepends duplicate MSH", () => {
    const rng = new RNG(3);
    const result = layer.mutateRecord(hl7Record, { generatorId: "hl7v2", recordIndex: 0 }, rng, 1, { "hl7-repeated-msh": 1000 });
    expect(result.injected?.strategy).toBe("hl7-repeated-msh");
    const mshCount = (result.mutated.match(/MSH\|/g) ?? []).length;
    expect(mshCount).toBeGreaterThanOrEqual(2);
  });

  it("hl7-invalid-timestamp: changes MSH-7 to invalid value", () => {
    const rng = new RNG(4);
    const result = layer.mutateRecord(hl7Record, { generatorId: "hl7v2", recordIndex: 0 }, rng, 1, { "hl7-invalid-timestamp": 1000 });
    expect(result.injected?.strategy).toBe("hl7-invalid-timestamp");
  });
});

describe("CorruptionLayer - FIX strategies", () => {
  it("fix-wrong-checksum: changes checksum tag", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord(fixRecord, { generatorId: "fix", recordIndex: 0 }, rng, 1, { "fix-wrong-checksum": 1000 });
    expect(result.injected?.strategy).toBe("fix-wrong-checksum");
  });

  it("fix-missing-required-tag: removes a required FIX tag", () => {
    const rng = new RNG(2);
    const result = layer.mutateRecord(fixRecord, { generatorId: "fix", recordIndex: 0 }, rng, 1, { "fix-missing-required-tag": 1000 });
    expect(result.injected?.strategy).toBe("fix-missing-required-tag");
  });
});

describe("CorruptionLayer - X12 strategies", () => {
  it("x12-mismatched-control-numbers: breaks ISA/IEA match", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord(x12Record, { generatorId: "x12", recordIndex: 0 }, rng, 1, { "x12-mismatched-control-numbers": 1000 });
    expect(result.injected?.strategy).toBe("x12-mismatched-control-numbers");
  });

  it("x12-wrong-segment-count: alters SE-01", () => {
    const rng = new RNG(2);
    const result = layer.mutateRecord(x12Record, { generatorId: "x12", recordIndex: 0 }, rng, 1, { "x12-wrong-segment-count": 1000 });
    expect(result.injected?.strategy).toBe("x12-wrong-segment-count");
  });

  it("x12-isa-wrong-length: modifies ISA length", () => {
    const rng = new RNG(3);
    const result = layer.mutateRecord(x12Record, { generatorId: "x12", recordIndex: 0 }, rng, 1, { "x12-isa-wrong-length": 1000 });
    expect(result.injected?.strategy).toBe("x12-isa-wrong-length");
  });
});

describe("CorruptionLayer - OFX strategies", () => {
  it("ofx-mismatched-type-sign: flips DEBIT sign to positive", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord(ofxRecord, { generatorId: "ofx", recordIndex: 0 }, rng, 1, { "ofx-mismatched-type-sign": 1000 });
    expect(result.injected?.strategy).toBe("ofx-mismatched-type-sign");
  });

  it("ofx-duplicate-fitid: duplicates a FITID value", () => {
    const rng = new RNG(2);
    const result = layer.mutateRecord(ofxRecord, { generatorId: "ofx", recordIndex: 0 }, rng, 1, { "ofx-duplicate-fitid": 1000 });
    expect(result.injected?.strategy).toBe("ofx-duplicate-fitid");
    const fitids = [...result.mutated.matchAll(/<FITID>([^<]+)<\/FITID>/g)].map((m) => m[1]);
    expect(fitids.length).toBeGreaterThan(1);
    expect(fitids[0]).toBe(fitids[1]);
  });
});

describe("CorruptionLayer - SWIFT strategies", () => {
  it("swift-invalid-bic: replaces BIC with invalid value", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord(swiftRecord, { generatorId: "swift-mt", recordIndex: 0 }, rng, 1, { "swift-invalid-bic": 1000 });
    expect(result.injected?.strategy).toBe("swift-invalid-bic");
  });

  it("swift-missing-mandatory-field: removes a mandatory field", () => {
    const rng = new RNG(2);
    const result = layer.mutateRecord(swiftRecord, { generatorId: "swift-mt", recordIndex: 0 }, rng, 1, { "swift-missing-mandatory-field": 1000 });
    expect(result.injected?.strategy).toBe("swift-missing-mandatory-field");
  });

  it("swift-forbidden-character: adds forbidden char to :70:", () => {
    const rng = new RNG(3);
    const result = layer.mutateRecord(swiftRecord, { generatorId: "swift-mt", recordIndex: 0 }, rng, 1, { "swift-forbidden-character": 1000 });
    expect(result.injected?.strategy).toBe("swift-forbidden-character");
  });
});

describe("CorruptionLayer - CDR strategies", () => {
  it("cdr-answered-zero-duration: sets duration to 0", () => {
    const rng = new RNG(1);
    const result = layer.mutateRecord(cdrRecord, { generatorId: "cdr", recordIndex: 0 }, rng, 1, { "cdr-answered-zero-duration": 1000 });
    expect(result.injected?.strategy).toBe("cdr-answered-zero-duration");
    const cols = result.mutated.split(",");
    expect(cols[9]).toBe("0");
    expect(cols[10]).toBe("0");
  });

  it("cdr-invalid-imei: breaks IMEI Luhn check digit", () => {
    const rng = new RNG(2);
    const result = layer.mutateRecord(cdrRecord, { generatorId: "cdr", recordIndex: 0 }, rng, 1, { "cdr-invalid-imei": 1000 });
    expect(result.injected?.strategy).toBe("cdr-invalid-imei");
  });
});

describe("CorruptionLayer - all strategies resolved via mutateRecord", () => {
  it("returns no injection when no matching strategy yields result", () => {
    const rng = new RNG(99);
    // All weights set to 0 so no strategy applies
    const result = layer.mutateRecord("somerecord", { generatorId: "x", recordIndex: 0 }, new RNG(99), 1, Object.fromEntries(universalStrategies.map((s) => [s.id, 0])));
    expect(result.injected).toBeUndefined();
  });
});
