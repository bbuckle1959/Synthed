import { describe, expect, it } from "vitest";
import { SWIFTValidator } from "../../src/validators/SWIFTValidator.js";
import { CDRValidator } from "../../src/validators/CDRValidator.js";
import { CDRGenerator } from "../../src/generators/telecom/CDR.js";

describe("SWIFT and CDR validators", () => {
  it("flags invalid SWIFT decimal separator", async () => {
    const v = new SWIFTValidator();
    const swift = "{1:F01BARCGB22AXXX0000000000}{2:I103BNPAFRPPXXXXN}{4:\n:32A:240315EUR125000.50\n-}";
    const report = await v.validate(swift);
    expect(report.errors.some((e) => e.rule === "SWIFT-002")).toBe(true);
  });

  it("warns on malformed SWIFT 61 format", async () => {
    const v = new SWIFTValidator();
    const swift = "{1:F01BARCGB22AXXX0000000000}{2:I940BNPAFRPPXXXXN}{4:\n:20:TXREF1\n:32A:240315EUR125000,50\n:50K:JOHN\n:59:HANS\n:61:BADFORMAT\n-}";
    const report = await v.validate(swift);
    expect(report.errors.some((e) => e.rule === "SWIFT-008")).toBe(true);
  });

  it("flags forbidden SWIFT characters as errors", async () => {
    const v = new SWIFTValidator();
    const swift = "{1:F01BARCGB22AXXX0000000000}{2:I103BNPAFRPPXXXXN}{4:\n:20:TXREF1\n:32A:240315EUR125000,50\n:70:PAYMENT @ BAD\n-}";
    const report = await v.validate(swift);
    expect(report.errors.some((e) => e.rule === "SWIFT-003")).toBe(true);
  });

  it("flags invalid CDR disposition-duration mismatch", async () => {
    const v = new CDRValidator();
    const cdr = "calldate,clid,src,dst,dcontext,channel,dstchannel,lastapp,lastdata,duration,billsec,disposition,amaflags,uniqueid\n2026-04-21 12:00:00,\"Caller\",+44123,+44124,ctx,ch,dch,app,,0,0,ANSWERED,DOC,1.1";
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-001")).toBe(true);
  });

  it("flags CDR future timestamp and bad imei", async () => {
    const v = new CDRValidator();
    const cdr = "calldate,clid,src,dst,dcontext,channel,dstchannel,lastapp,lastdata,duration,billsec,disposition,amaflags,uniqueid\n2099-01-01 00:00:00,\"Caller\",+44123,+44124,ctx,ch,dch,app,,10,10,ANSWERED,DOC,490154203237519";
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-003")).toBe(true);
    expect(report.errors.some((e) => e.rule === "CDR-004")).toBe(true);
  });

  it("flags MCC/MSISDN mismatch", async () => {
    const v = new CDRValidator();
    const cdr = "calldate,clid,src,dst,dcontext,channel,dstchannel,lastapp,lastdata,duration,billsec,disposition,amaflags,uniqueid\n2026-04-21 12:00:00,\"Caller\",+33123,+44124,ctx,ch,dch,app,,10,10,ANSWERED,DOC,490154203237518|234101234567890|1.1";
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-005")).toBe(true);
  });

  it("flags out-of-range CDR duration", async () => {
    const v = new CDRValidator();
    const cdr = "calldate,clid,src,dst,dcontext,channel,dstchannel,lastapp,lastdata,duration,billsec,disposition,amaflags,uniqueid\n2026-04-21 12:00:00,\"Caller\",+44123,+44124,ctx,ch,dch,app,,9001,9001,ANSWERED,DOC,490154203237518|234101234567890|1.1";
    const report = await v.validate(cdr);
    expect(report.errors.some((e) => e.rule === "CDR-006")).toBe(true);
  });

  it("validates BER-like CDR sequence structure", async () => {
    const v = new CDRValidator();
    const g = new CDRGenerator();
    const valid = (await g.generate({ seed: 7, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: { format: "asn1-ber" } }).next()).value;
    const report = await v.validate(valid);
    expect(report.errors.length).toBe(0);
  });

  it("flags malformed BER TLV length", async () => {
    const v = new CDRValidator();
    const bad = "300680023132810AFF\n"; // tag 81 length says 0A but value short
    const report = await v.validate(bad);
    expect(report.errors.some((e) => e.rule === "CDR-008")).toBe(true);
  });
});

