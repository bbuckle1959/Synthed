import type { IValidator, ValidationError, ValidationReport } from "../core/interfaces.js";

export class HL7v2Validator implements IValidator {
  readonly id = "hl7v2";
  async validate(input: string, options?: { suppressRules?: string[] }): Promise<ValidationReport> {
    const start = Date.now();
    const suppress = new Set(options?.suppressRules ?? []);
    const errors: ValidationError[] = [];
    const hasBatch = input.includes("FHS|") || input.includes("BHS|");
    if (hasBatch) {
      const fhs = input.includes("FHS|");
      const bhs = input.includes("BHS|");
      const bts = input.match(/BTS\|(\d+)/);
      const fts = input.includes("FTS|1");
      if (!fhs || !bhs) errors.push({ severity: "error", recordIndex: 0, fieldPath: "batch", rule: "HL7-001", message: "Batch mode requires FHS and BHS", actual: "missing", expected: "FHS/BHS present" });
      if (!bts) errors.push({ severity: "error", recordIndex: 0, fieldPath: "BTS", rule: "HL7-004", message: "Batch mode requires BTS count", actual: "missing", expected: "BTS|<count>" });
      if (!fts) errors.push({ severity: "error", recordIndex: 0, fieldPath: "FTS", rule: "HL7-004", message: "Batch mode requires FTS|1", actual: "missing", expected: "FTS|1" });
      if (bts) {
        const expected = Number(bts[1]);
        const actual = (input.match(/(^|\r)MSH\|/g) ?? []).length;
        if (expected !== actual) {
          errors.push({ severity: "error", recordIndex: 0, fieldPath: "BTS", rule: "HL7-004", message: "BTS count must match number of MSH messages", actual: String(actual), expected: String(expected) });
        }
      }
    }
    const msgs = input
      .split("\r")
      .join("\n")
      .split(/\n(?=MSH\|)/)
      .map((m) => m.replace(/\n/g, "\r").trim())
      .filter((m) => m.startsWith("MSH|"));
    msgs.forEach((message, idx) => {
      const segments = message.split("\r").filter(Boolean);
      const msh = segments[0] ?? "";
      if (!msh.startsWith("MSH|")) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "MSH", rule: "HL7-001", message: "MSH must be first segment", actual: msh, expected: "MSH|..." });
        return;
      }
      const mshFields = msh.split("|");
      if ((mshFields[1] ?? "").length !== 4) errors.push({ severity: "error", recordIndex: idx, fieldPath: "MSH.2", rule: "HL7-002", message: "MSH-2 must be 4 chars", actual: mshFields[1] ?? "", expected: "^~\\&" });
      if (!/^\d{4}(\d{4}(\d{6})?)?$/.test(mshFields[6] ?? "")) errors.push({ severity: "error", recordIndex: idx, fieldPath: "MSH.7", rule: "HL7-003", message: "Invalid HL7 datetime", actual: mshFields[6] ?? "", expected: "YYYY|YYYYMMDD|YYYYMMDDHHMMSS" });
      const known = new Set(["ADT^A01^ADT_A01", "ADT^A03^ADT_A03", "ADT^A08^ADT_A08", "ORU^R01^ORU_R01", "ORM^O01^ORM_O01"]);
      const msh9 = mshFields[8] ?? "";
      if (!msh9) errors.push({ severity: "error", recordIndex: idx, fieldPath: "MSH.9", rule: "HL7-004", message: "MSH-9 required", actual: "", expected: "known message type" });
      else if (!known.has(msh9)) errors.push({ severity: "warning", recordIndex: idx, fieldPath: "MSH.9", rule: "HL7-004b", message: "Unknown/atypical trigger event", actual: msh9, expected: "known standard set" });
      const version = mshFields[11] ?? "";
      if (version && !["2.3", "2.4", "2.5", "2.5.1", "2.6"].includes(version)) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "MSH.12", rule: "HL7-005", message: "Unsupported version", actual: version, expected: "2.3|2.4|2.5|2.5.1|2.6" });
      }
      if (!(mshFields[11] ?? "").trim()) errors.push({ severity: "error", recordIndex: idx, fieldPath: "MSH.12", rule: "HL7-005", message: "Version ID required", actual: mshFields[11] ?? "", expected: "2.x" });
      if (segments.some((s) => !/^[A-Z0-9]{3}\|/.test(s))) errors.push({ severity: "error", recordIndex: idx, fieldPath: "SEG", rule: "HL7-006", message: "Invalid segment ID", actual: "invalid", expected: "3 uppercase alnum chars" });
      const pidIdx = segments.findIndex((s) => s.startsWith("PID|"));
      if (pidIdx < 0) errors.push({ severity: "error", recordIndex: idx, fieldPath: "PID", rule: "HL7-007", message: "PID required", actual: "missing", expected: "PID segment" });
      const pv1Idx = segments.findIndex((s) => s.startsWith("PV1|"));
      if (pidIdx >= 0 && pv1Idx >= 0 && pidIdx > pv1Idx) errors.push({ severity: "error", recordIndex: idx, fieldPath: "PID/PV1", rule: "HL7-016", message: "PID must appear before PV1", actual: `${pidIdx}>${pv1Idx}`, expected: "PID<PV1" });
      const obrIdx = segments.findIndex((s) => s.startsWith("OBR|"));
      const orcIdx = segments.findIndex((s) => s.startsWith("ORC|"));
      if (msh9.startsWith("ORU^R01")) {
        if (obrIdx < 0) errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBR", rule: "HL7-004", message: "ORU_R01 requires OBR", actual: "missing", expected: "OBR present" });
        if (pv1Idx >= 0 && obrIdx >= 0 && pv1Idx > obrIdx) errors.push({ severity: "error", recordIndex: idx, fieldPath: "PV1/OBR", rule: "HL7-016", message: "PV1 should appear before OBR in ORU", actual: `${pv1Idx}>${obrIdx}`, expected: "PV1<OBR" });
      }
      if (msh9.startsWith("ORM^O01")) {
        if (orcIdx < 0) errors.push({ severity: "error", recordIndex: idx, fieldPath: "ORC", rule: "HL7-004", message: "ORM_O01 requires ORC", actual: "missing", expected: "ORC present" });
        if (orcIdx >= 0 && obrIdx >= 0 && orcIdx > obrIdx) errors.push({ severity: "error", recordIndex: idx, fieldPath: "ORC/OBR", rule: "HL7-016", message: "ORC should appear before OBR in ORM", actual: `${orcIdx}>${obrIdx}`, expected: "ORC<OBR" });
      }
      const pid = pidIdx >= 0 ? segments[pidIdx]!.split("|") : [];
      if (pid.length > 7 && pid[7] && !/^\d{4}(\d{4}(\d{6})?)?$/.test(pid[7])) errors.push({ severity: "error", recordIndex: idx, fieldPath: "PID.7", rule: "HL7-008", message: "PID-7 invalid date", actual: pid[7], expected: "YYYY|YYYYMMDD|YYYYMMDDHHMMSS" });
      if (pid.length > 8 && pid[8] && !["M", "F", "O", "U", "A", "N", "C"].includes(pid[8])) errors.push({ severity: "error", recordIndex: idx, fieldPath: "PID.8", rule: "HL7-009", message: "PID-8 invalid sex code", actual: pid[8], expected: "M/F/O/U/A/N/C" });
      if (pid.length > 3 && !(pid[3] ?? "").trim()) errors.push({ severity: "warning", recordIndex: idx, fieldPath: "PID.3", rule: "HL7-010", message: "PID-3 should not be empty", actual: "", expected: "identifier list" });
      if (message.includes("\x00")) errors.push({ severity: "error", recordIndex: idx, fieldPath: "record", rule: "HL7-015", message: "Message contains null bytes", actual: "\\x00 present", expected: "none" });
      const obxSegments = segments.filter((s) => s.startsWith("OBX|"));
      for (const obx of obxSegments) {
        const f = obx.split("|");
        if ((f[5] ?? "").trim() && !(f[2] ?? "").trim()) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBX.2", rule: "HL7-011", message: "OBX-2 required when OBX-5 populated", actual: "", expected: "HL7 data type" });
        }
        if ((f[2] ?? "").trim() && !["NM", "ST", "CWE", "TX", "RP", "ED"].includes(f[2]!)) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBX.2", rule: "HL7-012", message: "Unrecognized OBX-2 data type", actual: f[2]!, expected: "NM|ST|CWE|TX|RP|ED" });
        }
        if ((f[8] ?? "").trim() && !["H", "HH", "L", "LL", "A", "AA", "N"].includes(f[8]!)) {
          errors.push({ severity: "warning", recordIndex: idx, fieldPath: "OBX.8", rule: "HL7-013", message: "Non-standard abnormal flag", actual: f[8]!, expected: "H|HH|L|LL|A|AA|N" });
        }
        if ((f[2] ?? "") === "NM" && (f[5] ?? "").trim() && Number.isNaN(Number(f[5]))) {
          errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBX.5", rule: "HL7-014", message: "OBX NM value must be numeric", actual: f[5] ?? "", expected: "decimal number" });
        }
        if ((f[2] ?? "") === "NM" && !Number.isNaN(Number(f[5] ?? ""))) {
          const value = Number(f[5]);
          const flag = (f[8] ?? "").trim();
          if ((flag === "H" || flag === "HH") && value <= 52) {
            errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBX.8", rule: "HL7-013", message: "High abnormal flag inconsistent with numeric OBX-5", actual: `${flag}/${value}`, expected: "value above range for high flag" });
          }
          if ((flag === "L" || flag === "LL") && value >= 36) {
            errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBX.8", rule: "HL7-013", message: "Low abnormal flag inconsistent with numeric OBX-5", actual: `${flag}/${value}`, expected: "value below range for low flag" });
          }
          if (flag === "N" && (value < 36 || value > 52)) {
            errors.push({ severity: "error", recordIndex: idx, fieldPath: "OBX.8", rule: "HL7-013", message: "Normal abnormal flag inconsistent with numeric OBX-5", actual: `${flag}/${value}`, expected: "value within normal range" });
          }
        }
      }
    });
    const filtered = errors.filter((e) => !suppress.has(e.rule));
    return { generatorId: this.id, recordsValidated: msgs.length, errors: filtered, warnings: [], durationMs: Date.now() - start, passed: filtered.length === 0 };
  }
}

