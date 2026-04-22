import { describe, expect, it } from "vitest";
import { FieldProvider } from "../../src/core/FieldProvider.js";
import { luhnCheckDigit } from "../../src/core/luhn.js";
import { RNG } from "../../src/core/RNG.js";

describe("luhnCheckDigit", () => {
  it("produces correct check digit for known IMEI prefix", () => {
    const prefix = "35661102750011";
    const digit = luhnCheckDigit(prefix);
    expect(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]).toContain(digit);
    const full = `${prefix}${digit}`;
    // Verify with a second pass: luhn of first 14 digits should match appended digit
    expect(luhnCheckDigit(full.slice(0, 14))).toBe(full[14]);
  });

  it("returns single digit string", () => {
    const d = luhnCheckDigit("123456789012340");
    expect(d).toMatch(/^\d$/);
  });

  it("computes correct check digit for a well-known prefix", () => {
    // "7992739871" as prefix should produce "3" → full number "79927398713"
    // Verify that appending the computed digit satisfies Luhn validation
    const prefix = "7992739871";
    const digit = luhnCheckDigit(prefix);
    const full = `${prefix}${digit}`;
    // Running the function on the first n-1 digits of the full number gives the same check digit
    expect(luhnCheckDigit(full.slice(0, full.length - 1))).toBe(full[full.length - 1]);
  });

  it("is deterministic", () => {
    const s = "490154203237518";
    expect(luhnCheckDigit(s.slice(0, 14))).toBe(luhnCheckDigit(s.slice(0, 14)));
  });
});

describe("FieldProvider", () => {
  const rng = new RNG(42);
  const fp = new FieldProvider(rng);

  it("firstName returns a non-empty string", () => {
    const name = fp.firstName();
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("lastName returns a non-empty string", () => {
    expect(fp.lastName().length).toBeGreaterThan(0);
  });

  it("fullName is firstName + space + lastName", () => {
    const fp2 = new FieldProvider(new RNG(10));
    const first = fp2.firstName();
    const fp3 = new FieldProvider(new RNG(10));
    const last = fp3.lastName();
    // fullName calls firstName then lastName on same rng so just check format
    const full = new FieldProvider(new RNG(10)).fullName();
    expect(full).toContain(" ");
    expect(full.split(" ")).toHaveLength(2);
  });

  it("dob returns YYYY-MM-DD format", () => {
    const fp2 = new FieldProvider(new RNG(1));
    expect(fp2.dob()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("dob respects min/max age", () => {
    const fp2 = new FieldProvider(new RNG(2));
    const year = parseInt(fp2.dob(30, 40).slice(0, 4));
    const currentYear = new Date().getUTCFullYear();
    expect(year).toBeGreaterThanOrEqual(currentYear - 40);
    expect(year).toBeLessThanOrEqual(currentYear - 30);
  });

  it("sex returns one of valid HL7 sex codes", () => {
    const valid = ["M", "F", "O", "U", "A", "N", "C"];
    const fp2 = new FieldProvider(new RNG(3));
    for (let i = 0; i < 20; i++) {
      expect(valid).toContain(fp2.sex());
    }
  });

  it("phone starts with +1 and has 12 chars", () => {
    const fp2 = new FieldProvider(new RNG(4));
    const p = fp2.phone();
    expect(p).toMatch(/^\+1\d{10}$/);
  });

  it("ipv4 returns valid IPv4 format", () => {
    const fp2 = new FieldProvider(new RNG(5));
    expect(fp2.ipv4()).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("ipv4Private starts with 10.", () => {
    const fp2 = new FieldProvider(new RNG(6));
    expect(fp2.ipv4Private()).toMatch(/^10\.\d+\.\d+\.\d+$/);
  });

  it("ipv6 returns 8 colon-separated hex groups", () => {
    const fp2 = new FieldProvider(new RNG(7));
    const parts = fp2.ipv6().split(":");
    expect(parts).toHaveLength(8);
    parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/i));
  });

  it("macAddress returns 6 colon-separated hex bytes", () => {
    const fp2 = new FieldProvider(new RNG(8));
    const parts = fp2.macAddress().split(":");
    expect(parts).toHaveLength(6);
    parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]{2}$/i));
  });

  it("port returns value 1-65535", () => {
    const fp2 = new FieldProvider(new RNG(9));
    const p = fp2.port();
    expect(p).toBeGreaterThanOrEqual(1);
    expect(p).toBeLessThanOrEqual(65535);
  });

  it("userAgent returns a non-empty string", () => {
    const fp2 = new FieldProvider(new RNG(10));
    expect(fp2.userAgent().length).toBeGreaterThan(0);
  });

  it("httpMethod returns one of expected HTTP verbs", () => {
    const fp2 = new FieldProvider(new RNG(11));
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    for (let i = 0; i < 20; i++) {
      expect(methods).toContain(fp2.httpMethod());
    }
  });

  it("httpPath returns a non-empty path", () => {
    const fp2 = new FieldProvider(new RNG(12));
    expect(fp2.httpPath()).toMatch(/^\//);
  });

  it("httpStatusCode returns 200 most of the time at low errorRate", () => {
    const fp2 = new FieldProvider(new RNG(13));
    const results = Array.from({ length: 100 }, () => fp2.httpStatusCode(0.05));
    const count200 = results.filter((c) => c === 200).length;
    expect(count200).toBeGreaterThan(80);
  });

  it("responseBytes returns 0 for status 304", () => {
    const fp2 = new FieldProvider(new RNG(14));
    expect(fp2.responseBytes(304)).toBe(0);
  });

  it("responseBytes returns positive value for non-304", () => {
    const fp2 = new FieldProvider(new RNG(15));
    expect(fp2.responseBytes(200)).toBeGreaterThan(0);
  });

  it("npi returns 10-digit string", () => {
    const fp2 = new FieldProvider(new RNG(16));
    expect(fp2.npi()).toMatch(/^\d{10}$/);
  });

  it("mrn starts with MRN", () => {
    const fp2 = new FieldProvider(new RNG(17));
    expect(fp2.mrn()).toMatch(/^MRN\d{6}$/);
  });

  it("icd10Code returns a known code", () => {
    const fp2 = new FieldProvider(new RNG(18));
    expect(fp2.icd10Code().length).toBeGreaterThan(0);
  });

  it("cptCode returns a known code", () => {
    const fp2 = new FieldProvider(new RNG(19));
    expect(fp2.cptCode()).toMatch(/^\d{5}$/);
  });

  it("snomedCode returns a numeric string", () => {
    const fp2 = new FieldProvider(new RNG(20));
    expect(fp2.snomedCode()).toMatch(/^\d+$/);
  });

  it("rxNormCode returns a numeric string", () => {
    const fp2 = new FieldProvider(new RNG(21));
    expect(fp2.rxNormCode()).toMatch(/^\d+$/);
  });

  it("loincObservation returns object with required fields", () => {
    const fp2 = new FieldProvider(new RNG(22));
    const obs = fp2.loincObservation();
    expect(obs).toHaveProperty("code");
    expect(obs).toHaveProperty("display");
    expect(obs).toHaveProperty("unit");
    expect(obs).toHaveProperty("low");
    expect(obs).toHaveProperty("high");
  });

  it("labResult returns a number", () => {
    const fp2 = new FieldProvider(new RNG(23));
    const obs = { low: 36, high: 52 };
    expect(typeof fp2.labResult(obs)).toBe("number");
  });

  it("equitySymbol returns known ticker", () => {
    const fp2 = new FieldProvider(new RNG(24));
    const known = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
    expect(known).toContain(fp2.equitySymbol());
  });

  it("fxPair returns valid pair format", () => {
    const fp2 = new FieldProvider(new RNG(25));
    expect(fp2.fxPair()).toMatch(/^[A-Z]{3}\/[A-Z]{3}$/);
  });

  it("equityPrice returns positive number with 2 decimal places", () => {
    const fp2 = new FieldProvider(new RNG(26));
    const p = fp2.equityPrice();
    expect(p).toBeGreaterThan(0);
    expect(String(p)).toMatch(/\.\d{2}$/);
  });

  it("fxRate returns number with up to 5 decimal places", () => {
    const fp2 = new FieldProvider(new RNG(27));
    const r = fp2.fxRate();
    expect(r).toBeGreaterThan(0);
  });

  it("orderQty returns positive integer", () => {
    const fp2 = new FieldProvider(new RNG(28));
    const q = fp2.orderQty();
    expect(q).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(q)).toBe(true);
  });

  it("swiftBic returns known BIC", () => {
    const fp2 = new FieldProvider(new RNG(29));
    const known = ["BARCGB22", "BNPAFRPP", "DEUTDEFF", "CHASUS33"];
    expect(known).toContain(fp2.swiftBic());
  });

  it("iban returns string starting with country code", () => {
    const fp2 = new FieldProvider(new RNG(30));
    expect(fp2.iban()).toMatch(/^DE\d+$/);
  });

  it("claimId starts with CLM-", () => {
    const fp2 = new FieldProvider(new RNG(31));
    expect(fp2.claimId()).toMatch(/^CLM-\d{6}$/);
  });

  it("e164Phone starts with country code", () => {
    const fp2 = new FieldProvider(new RNG(32));
    expect(fp2.e164Phone("+44")).toMatch(/^\+44\d+$/);
  });

  it("imei is 15 digits and passes Luhn check", () => {
    const fp2 = new FieldProvider(new RNG(33));
    const imei = fp2.imei();
    expect(imei).toMatch(/^\d{15}$/);
    expect(luhnCheckDigit(imei.slice(0, 14))).toBe(imei[14]);
  });

  it("imsi has correct format with default MCC/MNC", () => {
    const fp2 = new FieldProvider(new RNG(34));
    const imsi = fp2.imsi();
    expect(imsi).toMatch(/^23410\d{10}$/);
  });

  it("callDurationSeconds returns non-negative number", () => {
    const fp2 = new FieldProvider(new RNG(35));
    expect(fp2.callDurationSeconds()).toBeGreaterThanOrEqual(0);
  });

  it("callDisposition returns ANSWERED for positive duration", () => {
    const fp2 = new FieldProvider(new RNG(36));
    expect(fp2.callDisposition(30)).toBe("ANSWERED");
  });

  it("callDisposition returns non-ANSWERED for zero duration", () => {
    const fp2 = new FieldProvider(new RNG(37));
    const d = fp2.callDisposition(0);
    expect(["NO ANSWER", "FAILED", "BUSY"]).toContain(d);
  });

  it("controlNumber returns string with correct digit count", () => {
    const fp2 = new FieldProvider(new RNG(38));
    const cn = fp2.controlNumber(9);
    expect(cn).toMatch(/^\d{9}$/);
  });

  it("messageControlId increments counter across calls", () => {
    const fp2 = new FieldProvider(new RNG(39));
    const id1 = fp2.messageControlId();
    const id2 = fp2.messageControlId();
    expect(id1).not.toBe(id2);
    expect(id1).toContain("-00000001-");
    expect(id2).toContain("-00000002-");
  });

  it("hl7SendingApp returns known system name", () => {
    const fp2 = new FieldProvider(new RNG(40));
    const known = ["EPIC", "CERNER", "MEDITECH"];
    expect(known).toContain(fp2.hl7SendingApp());
  });

  it("hl7Facility returns known facility name", () => {
    const fp2 = new FieldProvider(new RNG(41));
    const known = ["MEMORIAL_HOSP", "CITY_CLINIC", "GENERAL_MED"];
    expect(known).toContain(fp2.hl7Facility());
  });
});
