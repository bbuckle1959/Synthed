import type { IValidator, ValidationReport } from "../core/interfaces.js";

export class OFXValidator implements IValidator {
  readonly id = "ofx";
  async validate(input: string): Promise<ValidationReport> {
    const start = Date.now();
    const errors: ValidationReport["errors"] = [];
    if (!input.includes("<OFX>")) {
      errors.push({ severity: "error", recordIndex: 0, fieldPath: "OFX", rule: "OFX-001", message: "Invalid OFX envelope", actual: "missing", expected: "present" });
    }
    const tx = [...input.matchAll(/<STMTTRN>[\s\S]*?<TRNTYPE>([^<]+)<\/TRNTYPE>[\s\S]*?<TRNAMT>([^<]+)<\/TRNAMT>[\s\S]*?<FITID>([^<]+)<\/FITID>[\s\S]*?<\/STMTTRN>/g)];
    const fitids = new Set<string>();
    let sum = 0;
    for (const m of tx) {
      const type = m[1] ?? "";
      const amt = Number(m[2] ?? "0");
      const fit = m[3] ?? "";
      sum += amt;
      if (fitids.has(fit)) errors.push({ severity: "error", recordIndex: 0, fieldPath: "FITID", rule: "OFX-002", message: "FITID must be unique", actual: fit, expected: "unique" });
      fitids.add(fit);
      if (type === "DEBIT" && amt >= 0) errors.push({ severity: "error", recordIndex: 0, fieldPath: "TRNAMT", rule: "OFX-003", message: "DEBIT must be negative", actual: String(amt), expected: "< 0" });
      if (type === "CREDIT" && amt <= 0) errors.push({ severity: "error", recordIndex: 0, fieldPath: "TRNAMT", rule: "OFX-003", message: "CREDIT must be positive", actual: String(amt), expected: "> 0" });
    }
    const open = Number(input.match(/<OPENINGBAL>([^<]+)<\/OPENINGBAL>/)?.[1] ?? 0);
    const ledger = Number(input.match(/<BALAMT>([^<]+)<\/BALAMT>/)?.[1] ?? 0);
    if (Number.isFinite(ledger) && Number.isFinite(open) && Math.abs((open + sum) - ledger) > 0.01) {
      errors.push({ severity: "error", recordIndex: 0, fieldPath: "LEDGERBAL.BALAMT", rule: "OFX-001", message: "Ledger does not reconcile", actual: String(ledger), expected: String(open + sum) });
    }
    const dtStart = input.match(/<DTSTART>([^<]+)<\/DTSTART>/)?.[1];
    const dtEnd = input.match(/<DTEND>([^<]+)<\/DTEND>/)?.[1];
    if (dtStart && dtEnd && dtStart >= dtEnd) {
      errors.push({ severity: "error", recordIndex: 0, fieldPath: "DTSTART/DTEND", rule: "OFX-004", message: "DTSTART must be before DTEND", actual: `${dtStart}>=${dtEnd}`, expected: "DTSTART<DTEND" });
    }
    if (dtStart && dtEnd) {
      const posted = [...input.matchAll(/<DTPOSTED>([^<]+)<\/DTPOSTED>/g)].map((m) => m[1]!);
      for (const p of posted) {
        if (p < dtStart || p > dtEnd) {
          errors.push({ severity: "error", recordIndex: 0, fieldPath: "DTPOSTED", rule: "OFX-005", message: "DTPOSTED outside statement window", actual: p, expected: `${dtStart}-${dtEnd}` });
        }
      }
    }
    return { generatorId: this.id, recordsValidated: 1, errors, warnings: [], durationMs: Date.now() - start, passed: errors.length === 0 };
  }
}

