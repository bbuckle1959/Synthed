import type { IValidator, ValidationReport } from "../core/interfaces.js";

export class SWIFTValidator implements IValidator {
  readonly id = "swift-mt";
  async validate(input: string): Promise<ValidationReport> {
    const start = Date.now();
    const errors: ValidationReport["errors"] = [];
    const warnings: ValidationReport["warnings"] = [];
    const records = input.split(/\r?\n(?=\{1:)/).filter(Boolean);
    records.forEach((r, i) => {
      if (!r.includes("{1:") || !r.includes("{2:") || !r.includes("{4:")) {
        errors.push({ severity: "error", recordIndex: i, fieldPath: "block", rule: "SWIFT-001", message: "Missing required SWIFT blocks", actual: "incomplete", expected: "{1:}{2:}{4:}" });
      }
      if (!r.includes(":20:") || !r.includes(":32A:")) {
        errors.push({ severity: "error", recordIndex: i, fieldPath: "mandatory", rule: "SWIFT-004", message: "Missing mandatory block 4 field", actual: "missing :20 or :32A", expected: ":20 and :32A present" });
      }
      const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
      const block1Bic = r.match(/\{1:[A-Z]\d{2}([A-Z0-9]{8}(?:[A-Z0-9]{3})?)/)?.[1];
      const block2Bic = r.match(/\{2:[IO]\d{3}([A-Z0-9]{8}(?:[A-Z0-9]{3})?)/)?.[1];
      const valid1 = !!block1Bic && bicRegex.test(block1Bic);
      const valid2 = !!block2Bic && bicRegex.test(block2Bic);
      if (!valid1 && !valid2) {
        errors.push({ severity: "error", recordIndex: i, fieldPath: "BIC", rule: "SWIFT-005", message: "No valid BIC detected", actual: "none", expected: "8 or 11 char BIC" });
      }
      const amt = r.match(/:32A:[0-9]{6}[A-Z]{3}([0-9]+[.,][0-9]{2})/)?.[1];
      if (amt && amt.includes(".")) {
        errors.push({ severity: "error", recordIndex: i, fieldPath: ":32A:", rule: "SWIFT-002", message: "SWIFT amount must use comma decimal", actual: amt, expected: "comma decimal" });
      }
      const fiftyK = r.match(/:50K:([\s\S]*?)\n:/)?.[1];
      if (fiftyK) {
        const lines = fiftyK.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          warnings.push({ severity: "warning", recordIndex: i, fieldPath: ":50K:", rule: "SWIFT-006", message: "50K should be multiline name/address", actual: String(lines.length), expected: ">=2 lines" });
        }
      }
      const fiftyNine = r.match(/:59:([\s\S]*?)\n:/)?.[1];
      if (fiftyNine) {
        const lines = fiftyNine.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          warnings.push({ severity: "warning", recordIndex: i, fieldPath: ":59:", rule: "SWIFT-007", message: "59 should be multiline beneficiary", actual: String(lines.length), expected: ">=2 lines" });
        }
      }
      const line61 = r.match(/:61:([^\r\n]+)/)?.[1];
      if (line61 && !/^\d{6}\d{4}(CR|DR)\d+,\d{2}[A-Z]{4}[A-Z0-9]+\/\/[A-Z0-9]+$/.test(line61)) {
        errors.push({ severity: "error", recordIndex: i, fieldPath: ":61:", rule: "SWIFT-008", message: "61 line format invalid", actual: line61, expected: "ValDtBkDtCR/DRAmtTypeRef//BankRef" });
      }
      if (/[&<>\";_!#%*=@]/.test(r)) {
        errors.push({ severity: "error", recordIndex: i, fieldPath: "charset", rule: "SWIFT-003", message: "Forbidden UNOA characters detected", actual: "contains forbidden chars", expected: "UNOA-safe text" });
      }
    });
    return { generatorId: this.id, recordsValidated: records.length, errors, warnings, durationMs: Date.now() - start, passed: errors.length === 0 };
  }
}

