import type { IValidator, ValidationReport } from "../core/interfaces.js";
import { luhnCheckDigit } from "../core/luhn.js";

export class CDRValidator implements IValidator {
  readonly id = "cdr";
  async validate(input: string): Promise<ValidationReport> {
    const start = Date.now();
    const errors: ValidationReport["errors"] = [];
    const isBerLike = /^[0-9A-F\s\r\n]+$/i.test(input.trim()) && !input.startsWith("calldate,");
    if (isBerLike) {
      const lines = input.split(/\r?\n/).filter(Boolean);
      lines.forEach((line, idx) => {
        const hex = line.trim().toUpperCase();
        if (!hex.startsWith("30")) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "ber", rule: "CDR-008", message: "BER record must start with SEQUENCE tag 30", actual: hex.slice(0, 2), expected: "30" });
          return;
        }
        const totalLen = parseInt(hex.slice(2, 4), 16);
        const payload = hex.slice(4);
        if (payload.length / 2 !== totalLen) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "ber-length", rule: "CDR-008", message: "BER SEQUENCE length mismatch", actual: String(payload.length / 2), expected: String(totalLen) });
        }
        const presentTags = new Set<string>();
        let p = 0;
        while (p + 4 <= payload.length) {
          const tag = payload.slice(p, p + 2);
          const lenHex = payload.slice(p + 2, p + 4);
          const len = parseInt(lenHex, 16);
          const valueStart = p + 4;
          const valueEnd = valueStart + (len * 2);
          if (!Number.isFinite(len) || valueEnd > payload.length) {
            errors.push({ severity: "error", recordIndex: idx, fieldPath: "ber-tlv", rule: "CDR-008", message: "Invalid BER TLV length", actual: lenHex, expected: "valid TLV length" });
            break;
          }
          presentTags.add(tag);
          p = valueEnd;
        }
        const requiredTags = ["80", "81", "82", "83", "84", "85", "86"];
        for (const t of requiredTags) {
          if (!presentTags.has(t)) {
            errors.push({ severity: "error", recordIndex: idx, fieldPath: "ber-tag", rule: "CDR-008", message: `Missing BER tag ${t}`, actual: "missing", expected: t });
          }
        }
      });
      return { generatorId: this.id, recordsValidated: lines.length, errors, warnings: [], durationMs: Date.now() - start, passed: errors.length === 0 };
    }
    const lines = input.split(/\r?\n/).filter(Boolean);
    const records = lines.slice(1);
    records.forEach((line, idx) => {
      const cols = line.split(",");
      if (cols.length < 13) return;
      const callDate = cols[0]?.replace(/"/g, "") ?? "";
      const duration = Number(cols[9] ?? "0");
      const disp = (cols[11] ?? "").replace(/"/g, "");
      const idField = cols[13]?.replace(/"/g, "") ?? "";
      if (disp === "ANSWERED" && duration <= 0) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "duration", rule: "CDR-001", message: "ANSWERED must have duration > 0", actual: String(duration), expected: ">0" });
      }
      if (["NO ANSWER", "FAILED", "BUSY"].includes(disp) && duration !== 0) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "duration", rule: "CDR-002", message: "Non-answered must have duration 0", actual: String(duration), expected: "0" });
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(callDate) && callDate > "2035-01-01 00:00:00") {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "calldate", rule: "CDR-003", message: "Timestamp appears unrealistically in future", actual: callDate, expected: "<= 2035-01-01" });
      }
      if (duration < 0 || duration > 7200) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "duration", rule: "CDR-006", message: "Duration must be in realistic range", actual: String(duration), expected: "0..7200" });
      }
      const parts = idField.split("|");
      const imei = (parts[0] ?? "").replace(/[^\d]/g, "");
      const imsi = (parts[1] ?? "").replace(/[^\d]/g, "");
      if (imei.length === 15) {
        const expected = luhnCheckDigit(imei.slice(0, 14));
        if (imei[14] !== expected) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "imei", rule: "CDR-004", message: "IMEI failed Luhn check", actual: imei, expected: `${imei.slice(0, 14)}${expected}` });
        }
      }
      const src = (cols[2] ?? "").replace(/"/g, "");
      if (imsi.length >= 5) {
        const mcc = imsi.slice(0, 3);
        const mnc = imsi.slice(3, 5);
        if (!/^\d{2,3}$/.test(mnc)) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "imsi", rule: "CDR-007", message: "IMSI MNC malformed", actual: mnc, expected: "2-3 digits" });
        }
        if (mcc === "234" && !src.startsWith("+44")) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "imsi/msisdn", rule: "CDR-005", message: "MCC 234 should align with +44 MSISDN", actual: `${mcc}/${src}`, expected: "234/+44..." });
        }
      }
    });
    return { generatorId: this.id, recordsValidated: records.length, errors, warnings: [], durationMs: Date.now() - start, passed: errors.length === 0 };
  }
}

