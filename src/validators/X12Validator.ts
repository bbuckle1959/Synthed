import type { IValidator, ValidationReport } from "../core/interfaces.js";

export class X12Validator implements IValidator {
  readonly id = "x12";
  async validate(input: string): Promise<ValidationReport> {
    const start = Date.now();
    const errors: ValidationReport["errors"] = [];
    const warnings: ValidationReport["warnings"] = [];
    const segments = input.split("~").map((s) => s.trim()).filter(Boolean);
    const isa = segments.find((s) => s.startsWith("ISA*"));
    if (!isa) errors.push({ severity: "error", recordIndex: 0, fieldPath: "ISA", rule: "X12-001", message: "ISA required", actual: "missing", expected: "present" });
    else if (`${isa}~`.length !== 106) errors.push({ severity: "error", recordIndex: 0, fieldPath: "ISA", rule: "X12-001", message: "ISA length must be 106", actual: String(`${isa}~`.length), expected: "106" });
    const iea = segments.find((s) => s.startsWith("IEA*"))?.split("*");
    const isa13 = isa?.split("*")[13];
    if (iea && isa13 && iea[2] !== isa13) errors.push({ severity: "error", recordIndex: 0, fieldPath: "IEA-02", rule: "X12-002", message: "IEA-02 must match ISA-13", actual: iea[2] ?? "", expected: isa13 });
    const gs = segments.find((s) => s.startsWith("GS*"))?.split("*");
    const ge = segments.find((s) => s.startsWith("GE*"))?.split("*");
    if (gs && ge && gs[6] !== ge[2]) errors.push({ severity: "error", recordIndex: 0, fieldPath: "GE-02", rule: "X12-003", message: "GE-02 must match GS-06", actual: ge[2] ?? "", expected: gs[6] ?? "" });
    const st = segments.find((s) => s.startsWith("ST*"))?.split("*");
    const se = segments.find((s) => s.startsWith("SE*"))?.split("*");
    if (st && se) {
      const stIndex = segments.findIndex((s) => s.startsWith("ST*"));
      const seIndex = segments.findIndex((s) => s.startsWith("SE*"));
      const actualCount = stIndex >= 0 && seIndex >= stIndex ? (seIndex - stIndex + 1) : 0;
      if (Number(se[1] ?? "0") !== actualCount) errors.push({ severity: "error", recordIndex: 0, fieldPath: "SE-01", rule: "X12-004", message: "SE-01 must match segment count", actual: se[1] ?? "", expected: String(actualCount) });
    }
    if (st && se && st[2] !== se[2]) errors.push({ severity: "error", recordIndex: 0, fieldPath: "SE-02", rule: "X12-005", message: "SE-02 must match ST-02", actual: se[2] ?? "", expected: st[2] ?? "" });
    const isa15 = isa?.split("*")[15]?.replace(/~$/, "");
    if (isa15 && !["P", "T"].includes(isa15)) warnings.push({ severity: "warning", recordIndex: 0, fieldPath: "ISA-15", rule: "X12-006", message: "ISA-15 should be P or T", actual: isa15, expected: "P|T" });
    return { generatorId: this.id, recordsValidated: 1, errors, warnings, durationMs: Date.now() - start, passed: errors.length === 0 };
  }
}

