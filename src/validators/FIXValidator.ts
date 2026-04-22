import type { IValidator, ValidationError, ValidationReport } from "../core/interfaces.js";

const soh = "\x01";
const extract = (line: string, tag: string): string | undefined => line.split(soh).find((f) => f.startsWith(`${tag}=`))?.split("=")[1];
const bodyLength = (line: string): number => {
  const start = line.indexOf(`${soh}`, line.indexOf("9=")) + 1;
  const before10 = line.lastIndexOf(`${soh}10=`);
  if (start <= 0 || before10 < 0) return -1;
  return Buffer.byteLength(line.slice(start, before10 + 1), "utf8");
};
const checksum = (line: string): string => {
  const before10 = line.lastIndexOf(`${soh}10=`);
  const raw = before10 < 0 ? line : line.slice(0, before10 + 1);
  const sum = Buffer.from(raw, "utf8").reduce((a, b) => a + b, 0) % 256;
  return String(sum).padStart(3, "0");
};

export class FIXValidator implements IValidator {
  readonly id = "fix";
  async validate(input: string, options?: { suppressRules?: string[] }): Promise<ValidationReport> {
    const start = Date.now();
    const suppress = new Set(options?.suppressRules ?? []);
    const errors: ValidationError[] = [];
    const lines = input.split(/\r?\n/).filter(Boolean);
    let prevSeq = 0;
    const orderQtyByClOrdId = new Map<string, number>();
    const requiredTagsByType: Record<string, string[]> = {
      D: ["11", "21", "38", "40", "49", "52", "54", "55", "56"],
      "8": ["6", "11", "14", "17", "37", "39", "49", "52", "55", "56", "150", "151"],
      F: ["11", "38", "41", "49", "52", "54", "55", "56", "60"],
      G: ["11", "38", "41", "49", "52", "54", "55", "56", "40"],
    };
    const avgPxState = new Map<string, { lastCumQty: number; weightedValue: number }>();
    lines.forEach((line, idx) => {
      if (!extract(line, "8")) errors.push({ severity: "error", recordIndex: idx, fieldPath: "8", rule: "FIX-001", message: "BeginString required", actual: "", expected: "present" });
      const tag9 = extract(line, "9");
      const tag10 = extract(line, "10");
      const computedBodyLength = bodyLength(line);
      if (!tag9) errors.push({ severity: "error", recordIndex: idx, fieldPath: "9", rule: "FIX-002", message: "BodyLength required", actual: "", expected: "present" });
      else if (Number(tag9) !== computedBodyLength) errors.push({ severity: "error", recordIndex: idx, fieldPath: "9", rule: "FIX-002", message: "BodyLength mismatch", actual: tag9, expected: String(computedBodyLength) });
      const computedChecksum = checksum(line);
      if (!tag10) errors.push({ severity: "error", recordIndex: idx, fieldPath: "10", rule: "FIX-003", message: "CheckSum required", actual: "", expected: "present" });
      else if (tag10 !== computedChecksum) errors.push({ severity: "error", recordIndex: idx, fieldPath: "10", rule: "FIX-003", message: "Invalid checksum", actual: tag10, expected: computedChecksum });
      if (tag10 && tag10.length !== 3) errors.push({ severity: "warning", recordIndex: idx, fieldPath: "10", rule: "FIX-004", message: "CheckSum should be 3 digits", actual: tag10, expected: "3 digits" });
      const msgType = extract(line, "35");
      if (!msgType) errors.push({ severity: "error", recordIndex: idx, fieldPath: "35", rule: "FIX-005", message: "MsgType required", actual: "", expected: "present" });
      else if (!["D", "8", "G", "F"].includes(msgType)) errors.push({ severity: "warning", recordIndex: idx, fieldPath: "35", rule: "FIX-005b", message: "Unknown MsgType", actual: msgType, expected: "D/8/G/F or custom" });
      const seq = Number(extract(line, "34") ?? "0");
      if (!Number.isInteger(seq) || seq <= 0) errors.push({ severity: "error", recordIndex: idx, fieldPath: "34", rule: "FIX-006", message: "MsgSeqNum must be positive integer", actual: String(seq), expected: "> 0" });
      if (seq > 0 && prevSeq > 0 && seq < prevSeq) errors.push({ severity: "error", recordIndex: idx, fieldPath: "34", rule: "FIX-006b", message: "MsgSeqNum regressed", actual: String(seq), expected: `>= ${prevSeq}` });
      if (seq > 0) prevSeq = seq;
      const sendingTime = extract(line, "52");
      if (!sendingTime) errors.push({ severity: "error", recordIndex: idx, fieldPath: "52", rule: "FIX-007", message: "SendingTime required", actual: "", expected: "present" });
      else if (!/^\d{8}-\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(sendingTime)) errors.push({ severity: "error", recordIndex: idx, fieldPath: "52", rule: "FIX-007b", message: "Invalid SendingTime format", actual: sendingTime, expected: "YYYYMMDD-HH:MM:SS(.sss)" });
      if (msgType && requiredTagsByType[msgType]) {
        for (const tag of requiredTagsByType[msgType]!) {
          if (!extract(line, tag)) errors.push({ severity: "error", recordIndex: idx, fieldPath: tag, rule: "FIX-008", message: `Required tag ${tag} missing`, actual: "missing", expected: "present" });
        }
      }
      const ordQty = Number(extract(line, "38") ?? "0");
      const cumQty = Number(extract(line, "14") ?? "0");
      const leavesQty = Number(extract(line, "151") ?? "0");
      const clOrdId = extract(line, "11") ?? "";
      if (msgType === "D" && clOrdId && ordQty > 0) orderQtyByClOrdId.set(clOrdId, ordQty);
      const effectiveOrdQty = ordQty > 0 ? ordQty : (orderQtyByClOrdId.get(clOrdId) ?? 0);
      if (extract(line, "14") && extract(line, "151") && extract(line, "38") && cumQty + leavesQty !== ordQty) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "14/151/38", rule: "FIX-009", message: "CumQty + LeavesQty must equal OrderQty", actual: `${cumQty}+${leavesQty}`, expected: String(ordQty) });
      }
      if (extract(line, "14") && extract(line, "151") && effectiveOrdQty > 0 && cumQty + leavesQty !== effectiveOrdQty) {
        errors.push({ severity: "error", recordIndex: idx, fieldPath: "14/151/38", rule: "FIX-009", message: "CumQty + LeavesQty must equal session OrderQty", actual: `${cumQty}+${leavesQty}`, expected: String(effectiveOrdQty) });
      }
      if ((extract(line, "39") ?? "") === "2" && leavesQty !== 0) errors.push({ severity: "error", recordIndex: idx, fieldPath: "151", rule: "FIX-010", message: "Filled requires LeavesQty=0", actual: String(leavesQty), expected: "0" });
      if ((extract(line, "39") ?? "") === "0" && cumQty !== 0) errors.push({ severity: "error", recordIndex: idx, fieldPath: "14", rule: "FIX-011", message: "New requires CumQty=0", actual: String(cumQty), expected: "0" });
      const avgPx = Number(extract(line, "6") ?? "0");
      if (msgType === "8" && clOrdId && cumQty > 0 && Number.isFinite(avgPx)) {
        const prev = avgPxState.get(clOrdId) ?? { lastCumQty: 0, weightedValue: 0 };
        const deltaQty = Math.max(0, cumQty - prev.lastCumQty);
        const nextWeighted = prev.weightedValue + (deltaQty * avgPx);
        const impliedAvg = cumQty > 0 ? nextWeighted / cumQty : avgPx;
        if (Math.abs(avgPx - impliedAvg) > 0.05) {
          errors.push({
            severity: "error",
            recordIndex: idx,
            fieldPath: "6",
            rule: "FIX-009",
            message: "AvgPx inconsistent with cumulative fill progression",
            actual: avgPx.toFixed(2),
            expected: impliedAvg.toFixed(2),
          });
        }
        avgPxState.set(clOrdId, { lastCumQty: cumQty, weightedValue: nextWeighted });
      }
      if (line.includes("\x00")) errors.push({ severity: "error", recordIndex: idx, fieldPath: "record", rule: "FIX-012", message: "Message contains null bytes", actual: "\\x00 present", expected: "none" });
    });
    const filtered = errors.filter((e) => !suppress.has(e.rule));
    return { generatorId: this.id, recordsValidated: lines.length, errors: filtered.filter((e) => e.severity === "error"), warnings: filtered.filter((e) => e.severity === "warning"), durationMs: Date.now() - start, passed: filtered.every((e) => e.severity !== "error") };
  }
}

