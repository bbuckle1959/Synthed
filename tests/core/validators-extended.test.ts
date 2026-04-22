import { describe, expect, it } from "vitest";
import { HL7v2Validator } from "../../src/validators/HL7v2Validator.js";
import { FIXValidator } from "../../src/validators/FIXValidator.js";
import { OFXValidator } from "../../src/validators/OFXValidator.js";
import { SWIFTValidator } from "../../src/validators/SWIFTValidator.js";
import { X12Validator } from "../../src/validators/X12Validator.js";
import { CDRValidator } from "../../src/validators/CDRValidator.js";

const validHL7 = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";

describe("HL7v2Validator - extended rule coverage", () => {
  it("flags unsupported HL7 version (HL7-005)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|9.9\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-005")).toBe(true);
  });

  it("flags missing version ID (HL7-005)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-005")).toBe(true);
  });

  it("flags invalid segment ID (HL7-006)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r!!!|invalid\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-006")).toBe(true);
  });

  it("flags missing PID segment (HL7-007)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-007")).toBe(true);
  });

  it("flags invalid PID-7 date (HL7-008)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||BADDATE|F\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-008")).toBe(true);
  });

  it("flags invalid PID-8 sex code (HL7-009)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|MALE\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-009")).toBe(true);
  });

  it("warns when PID-3 is empty (HL7-010)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1|||DOE^JANE||19700101|F\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-010")).toBe(true);
  });

  it("flags OBX missing value type when OBX-5 present (HL7-011)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ORU^R01^ORU_R01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rOBR|1|||LAB\rOBX|1||4544-3^Hematocrit^LN||40|%|36-52|N|||F\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-011")).toBe(true);
  });

  it("flags unrecognized OBX-2 data type (HL7-012)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ORU^R01^ORU_R01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rOBR|1|||LAB\rOBX|1|XX|4544-3^Hematocrit^LN||40|%|36-52|N|||F\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-012")).toBe(true);
  });

  it("flags null bytes in HL7 message (HL7-015)", async () => {
    const v = new HL7v2Validator();
    const msg = `MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||\x00|F\rPV1|1|I\r`;
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-015")).toBe(true);
  });

  it("flags PID appearing after PV1 (HL7-016)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPV1|1|I\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-016")).toBe(true);
  });

  it("passes a valid HL7 message", async () => {
    const v = new HL7v2Validator();
    const report = await v.validate(validHL7);
    expect(report.passed).toBe(true);
  });

  it("suppresses rules when suppressRules option is provided", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|NOTADATE||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const report = await v.validate(msg, { suppressRules: ["HL7-003"] });
    expect(report.errors.every((e) => e.rule !== "HL7-003")).toBe(true);
  });

  it("flags ORM_O01 missing ORC (HL7-004)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~\\&|A|B|C|D|20260315093000||ORM^O01^ORM_O01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\rOBR|1|||LAB\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.fieldPath === "ORC")).toBe(true);
  });

  it("flags MSH-2 wrong length (HL7-002)", async () => {
    const v = new HL7v2Validator();
    const msg = "MSH|^~|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1\rPID|1||123^^^HOSP^MR||DOE^JANE||19700101|F\rPV1|1|I\r";
    const report = await v.validate(msg);
    expect(report.errors.some((e) => e.rule === "HL7-002")).toBe(true);
  });
});

describe("FIXValidator - extended rule coverage", () => {
  it("flags checksum not 3 digits (FIX-004)", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=10\x0135=D\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=99\x01";
    const report = await v.validate(bad);
    expect(report.warnings.some((e) => e.rule === "FIX-004")).toBe(true);
  });

  it("warns on unknown MsgType (FIX-005b)", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=10\x0135=Z\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=000\x01";
    const report = await v.validate(bad);
    expect(report.warnings.some((e) => e.rule === "FIX-005b")).toBe(true);
  });

  it("flags invalid SendingTime format (FIX-007b)", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=10\x0135=D\x0134=1\x0149=S\x0156=T\x0152=NOT-A-DATE\x0110=000\x01";
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "FIX-007b")).toBe(true);
  });

  it("flags MsgSeqNum <= 0 (FIX-006)", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=10\x0135=D\x0134=0\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=000\x01";
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "FIX-006")).toBe(true);
  });

  it("flags regressed MsgSeqNum (FIX-006b)", async () => {
    const v = new FIXValidator();
    const msg1 = "8=FIX.4.4\x019=10\x0135=D\x0134=5\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=000\x01";
    const msg2 = "8=FIX.4.4\x019=10\x0135=D\x0134=2\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=000\x01";
    const report = await v.validate(`${msg1}\n${msg2}`);
    expect(report.errors.some((e) => e.rule === "FIX-006b")).toBe(true);
  });

  it("flags null bytes in FIX message (FIX-012)", async () => {
    const v = new FIXValidator();
    const bad = `8=FIX.4.4\x019=10\x0135=D\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=000\x01\x00`;
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "FIX-012")).toBe(true);
  });

  it("flags filled order with non-zero LeavesQty (FIX-010)", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=80\x0135=8\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0111=O1\x0154=1\x0155=AAPL\x016=100.00\x0114=10\x0117=E1\x0137=OID1\x0139=2\x01150=2\x01151=5\x0138=10\x0110=000\x01";
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "FIX-010")).toBe(true);
  });

  it("flags new order with non-zero CumQty (FIX-011)", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=80\x0135=8\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0111=O1\x0154=1\x0155=AAPL\x016=0\x0114=5\x0117=E1\x0137=OID1\x0139=0\x01150=0\x01151=5\x0138=10\x0110=000\x01";
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "FIX-011")).toBe(true);
  });

  it("suppresses rules when suppressRules provided", async () => {
    const v = new FIXValidator();
    const bad = "8=FIX.4.4\x019=12\x0135=D\x0134=1\x0149=S\x0156=T\x0152=20260101-00:00:00.000\x0110=999\x01";
    const report = await v.validate(bad, { suppressRules: ["FIX-003"] });
    expect(report.errors.every((e) => e.rule !== "FIX-003")).toBe(true);
  });
});

describe("OFXValidator - extended rule coverage", () => {
  it("flags missing OFX envelope (OFX-001)", async () => {
    const v = new OFXValidator();
    const report = await v.validate("<HTML><BODY>not OFX</BODY></HTML>");
    expect(report.errors.some((e) => e.rule === "OFX-001")).toBe(true);
  });

  it("flags duplicate FITID (OFX-002)", async () => {
    const v = new OFXValidator();
    const input = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><OPENINGBAL>100.00</OPENINGBAL><BANKTRANLIST><DTSTART>20260101</DTSTART><DTEND>20260131</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260115</DTPOSTED><TRNAMT>-5.00</TRNAMT><FITID>SAME</FITID></STMTTRN><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260120</DTPOSTED><TRNAMT>10.00</TRNAMT><FITID>SAME</FITID></STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>105.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    const report = await v.validate(input);
    expect(report.errors.some((e) => e.rule === "OFX-002")).toBe(true);
  });

  it("flags positive DEBIT amount (OFX-003)", async () => {
    const v = new OFXValidator();
    const input = "<OFX><OPENINGBAL>100.00</OPENINGBAL><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><TRNAMT>5.00</TRNAMT><FITID>ID1</FITID></STMTTRN><LEDGERBAL><BALAMT>105.00</BALAMT></LEDGERBAL></OFX>";
    const report = await v.validate(input);
    expect(report.errors.some((e) => e.rule === "OFX-003")).toBe(true);
  });

  it("flags negative CREDIT amount (OFX-003)", async () => {
    const v = new OFXValidator();
    const input = "<OFX><OPENINGBAL>100.00</OPENINGBAL><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><TRNAMT>-5.00</TRNAMT><FITID>ID1</FITID></STMTTRN><LEDGERBAL><BALAMT>95.00</BALAMT></LEDGERBAL></OFX>";
    const report = await v.validate(input);
    expect(report.errors.some((e) => e.rule === "OFX-003")).toBe(true);
  });

  it("passes on a valid OFX document", async () => {
    const v = new OFXValidator();
    const input = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><OPENINGBAL>100.00</OPENINGBAL><BANKTRANLIST><DTSTART>20260101</DTSTART><DTEND>20260131</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260115</DTPOSTED><TRNAMT>-5.00</TRNAMT><FITID>ID1</FITID></STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>95.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    const report = await v.validate(input);
    expect(report.passed).toBe(true);
  });
});

describe("SWIFTValidator - extended rule coverage", () => {
  it("flags missing SWIFT blocks (SWIFT-001)", async () => {
    const v = new SWIFTValidator();
    const report = await v.validate("{1:F01BARCGB22AXXX0000000000}no block 2 or 4");
    expect(report.errors.some((e) => e.rule === "SWIFT-001")).toBe(true);
  });

  it("flags missing mandatory block 4 fields (SWIFT-004)", async () => {
    const v = new SWIFTValidator();
    const swift = "{1:F01BARCGB22AXXX0000000000}{2:I103BNPAFRPPXXXXN}{4:\n:71A:OUR\n-}";
    const report = await v.validate(swift);
    expect(report.errors.some((e) => e.rule === "SWIFT-004")).toBe(true);
  });

  it("flags no valid BIC detected (SWIFT-005)", async () => {
    const v = new SWIFTValidator();
    // Use all-digit characters after the block type codes so neither block1 nor block2 yields a valid BIC
    const swift = "{1:F011234567890000}{2:I1031234567890N}{4:\n:20:TXREF1\n:32A:240315EUR125000,50\n-}";
    const report = await v.validate(swift);
    expect(report.errors.some((e) => e.rule === "SWIFT-005")).toBe(true);
  });

  it("warns on 50K with only one line (SWIFT-006)", async () => {
    const v = new SWIFTValidator();
    const swift = "{1:F01BARCGB22AXXX0000000000}{2:I103BNPAFRPPXXXXN}{4:\n:20:TXREF1\n:32A:240315EUR125000,50\n:50K:JOHN SMITH\n:71A:OUR\n-}";
    const report = await v.validate(swift);
    expect(report.warnings.some((e) => e.rule === "SWIFT-006")).toBe(true);
  });

  it("warns on :59 with only one line (SWIFT-007)", async () => {
    const v = new SWIFTValidator();
    const swift = "{1:F01BARCGB22AXXX0000000000}{2:I103BNPAFRPPXXXXN}{4:\n:20:TXREF1\n:32A:240315EUR125000,50\n:50K:JOHN\nSMITH\n:59:HANS\n:71A:OUR\n-}";
    const report = await v.validate(swift);
    expect(report.warnings.some((e) => e.rule === "SWIFT-007")).toBe(true);
  });
});

describe("X12Validator - extended rule coverage", () => {
  const validX12 = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260421*1200*^*00501*100000001*0*P*:~GS*HC*SENDER*RECV*20260421*1200*1*X*005010X222A1~ST*837*0001~NM1*41*2*SENDER*****46*123~SE*3*0001~GE*1*1~IEA*1*100000001~";

  it("flags missing ISA (X12-001)", async () => {
    const v = new X12Validator();
    const report = await v.validate("GS*HC*SENDER*RECV*20260421*1200*1*X*005010X222A1~");
    expect(report.errors.some((e) => e.rule === "X12-001")).toBe(true);
  });

  it("flags ISA with wrong length (X12-001)", async () => {
    const v = new X12Validator();
    const shortISA = "ISA*00*ABC*~";
    const report = await v.validate(shortISA);
    expect(report.errors.some((e) => e.rule === "X12-001")).toBe(true);
  });

  it("flags IEA-02 mismatch with ISA-13 (X12-002)", async () => {
    const v = new X12Validator();
    const bad = validX12.replace("IEA*1*100000001~", "IEA*1*999999999~");
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "X12-002")).toBe(true);
  });

  it("flags GE-02 mismatch with GS-06 (X12-003)", async () => {
    const v = new X12Validator();
    const bad = validX12.replace("GE*1*1~", "GE*1*9999~");
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "X12-003")).toBe(true);
  });

  it("flags SE-01 wrong segment count (X12-004)", async () => {
    const v = new X12Validator();
    const bad = validX12.replace("SE*3*0001~", "SE*99*0001~");
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "X12-004")).toBe(true);
  });

  it("flags SE-02 mismatch with ST-02 (X12-005)", async () => {
    const v = new X12Validator();
    const bad = validX12.replace("SE*3*0001~", "SE*4*9999~");
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "X12-005")).toBe(true);
  });

  it("passes a valid X12 document", async () => {
    const v = new X12Validator();
    const report = await v.validate(validX12);
    expect(report.passed).toBe(true);
  });
});

describe("CDRValidator - extended rule coverage", () => {
  const header = "calldate,clid,src,dst,dcontext,channel,dstchannel,lastapp,lastdata,duration,billsec,disposition,amaflags,uniqueid\n";

  it("flags non-answered call with non-zero duration (CDR-002)", async () => {
    const v = new CDRValidator();
    const cdr = `${header}2026-04-21 12:00:00,"Caller",+44123,+44124,ctx,ch,dch,app,,30,30,NO ANSWER,DOC,490154203237518`;
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-002")).toBe(true);
  });

  it("flags BUSY with non-zero duration (CDR-002)", async () => {
    const v = new CDRValidator();
    const cdr = `${header}2026-04-21 12:00:00,"Caller",+44123,+44124,ctx,ch,dch,app,,5,5,BUSY,DOC,490154203237518`;
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-002")).toBe(true);
  });

  it("flags negative duration (CDR-006)", async () => {
    const v = new CDRValidator();
    const cdr = `${header}2026-04-21 12:00:00,"Caller",+44123,+44124,ctx,ch,dch,app,,-1,-1,ANSWERED,DOC,490154203237518`;
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-006")).toBe(true);
  });

  it("passes a valid CDR record", async () => {
    const v = new CDRValidator();
    const cdr = `${header}2026-04-21 12:00:00,"Caller",+44123,+44124,ctx,ch,dch,app,,30,30,ANSWERED,DOC,490154203237518|234101234567890|1.1`;
    const report = await v.validate(cdr);
    expect(report.passed).toBe(true);
  });

  it("handles records with fewer than 13 columns gracefully", async () => {
    const v = new CDRValidator();
    const cdr = `${header}short,row`;
    const report = await v.validate(cdr);
    expect(report.passed).toBe(true);
  });
});
