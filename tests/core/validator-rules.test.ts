import { describe, expect, it } from "vitest";
import { FIXValidator } from "../../src/validators/FIXValidator.js";
import { HL7v2Validator } from "../../src/validators/HL7v2Validator.js";
import { runSelfTest } from "../../src/orchestrator/selftest.js";
import { OFXValidator } from "../../src/validators/OFXValidator.js";

describe("Validator rule checks", () => {
  it("flags invalid HL7 timestamp", async () => {
    const v = new HL7v2Validator();
    const report = await v.validate("MSH|^~\\&|A|B|C|D|NOTADATE||ADT^A01^ADT_A01|1|P|2.5\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r");
    expect(report.errors.some((e) => e.rule === "HL7-003")).toBe(true);
  });

  it("flags invalid HL7 OBX NM value", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ORU^R01^ORU_R01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rOBX|1|NM|4544-3^Hematocrit^LN||NOT_A_NUMBER|%|36-52|N|||F\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-014")).toBe(true);
  });

  it("flags malformed HL7 batch envelope", async () => {
    const v = new HL7v2Validator();
    const msg = "BHS|^~\\&|SYNTHED|LAB|RECV|DEST|20260101000000\rMSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-001")).toBe(true);
  });

  it("flags HL7 batch BTS count mismatch", async () => {
    const v = new HL7v2Validator();
    const msg = "FHS|^~\\&|SYNTHED|LAB|RECV|DEST|20260101000000\rBHS|^~\\&|SYNTHED|LAB|RECV|DEST|20260101000000\rMSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rBTS|2\rFTS|1\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.fieldPath === "BTS")).toBe(true);
  });

  it("flags ORU missing OBR", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ORU^R01^ORU_R01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rOBX|1|ST|X||value\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.fieldPath === "OBR")).toBe(true);
  });

  it("flags OBX abnormal-flag inconsistency", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ORU^R01^ORU_R01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rOBR|1|||LAB\rOBX|1|NM|4544-3^Hematocrit^LN||40|%|36-52|HH|||F\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-013")).toBe(true);
  });

  it("flags invalid FIX checksum", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=12\x0135=D\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=999\x01";
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "FIX-003")).toBe(true);
  });

  it("flags FIX avg price inconsistency", async () => {
    const v = new FIXValidator();
    const l1 = "8=FIX.4.4\x019=98\x0135=8\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0111=ORD1\x0154=1\x0155=AAPL\x016=100.00\x0114=5\x0117=EX1\x0137=OID1\x0139=1\x01150=1\x01151=5\x0138=10\x0110=000\x01";
    const l2 = "8=FIX.4.4\x019=99\x0135=8\x0134=2\x0149=S\x0156=T\x0152=20260101-00:00:01.000\x0111=ORD1\x0154=1\x0155=AAPL\x016=200.00\x0114=10\x0117=EX2\x0137=OID1\x0139=2\x01150=2\x01151=0\x0138=10\x0110=000\x01";
    const report = await v.validate(`${l1}\n${l2}`);
    expect(report.errors.some((e) => e.rule === "FIX-009")).toBe(true);
  });

  it("selftest includes corruption signal", async () => {
    const result = await runSelfTest("fix");
    expect(result[0]?.corruptionDetectionRate).toBeDefined();
    expect(result[0]?.strategyDetectionRates).toBeDefined();
  });

  it("flags OFX date window violations", async () => {
    const v = new OFXValidator();
    const bad = "<?xml version=\"1.0\"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><OPENINGBAL>100.00</OPENINGBAL><BANKTRANLIST><DTSTART>20260131</DTSTART><DTEND>20260101</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260201</DTPOSTED><TRNAMT>-5.00</TRNAMT><FITID>1</FITID></STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>95.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "OFX-004")).toBe(true);
    expect(report.errors.some((e) => e.rule === "OFX-005")).toBe(true);
  });
});

