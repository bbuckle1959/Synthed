import { RNG } from "./RNG.js";
import type { CorruptionStrategyDef, ErrorManifest } from "./interfaces.js";

export class CorruptionLayer {
  constructor(private readonly strategies: CorruptionStrategyDef[]) {}

  mutateRecord(
    record: string,
    context: { generatorId: string; recordIndex: number },
    rng: RNG,
    corruptRate: number,
    overrides: Record<string, number> = {},
  ): { mutated: string; injected?: ErrorManifest["errors"][number] } {
    if (!rng.bool(corruptRate)) return { mutated: record };
    const candidates = this.strategies
      .map((s) => ({ value: s, weight: overrides[s.id] ?? s.defaultWeight }))
      .filter((x) => x.weight > 0);
    let mutated = record;
    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const strat = rng.weightedPick(candidates);
      const result = strat.mutate(mutated, rng, context);
      if (!result) continue;
      mutated = result.mutated;
      return {
        mutated,
        injected: { ...result.error, recordIndex: context.recordIndex, byteOffset: 0 },
      };
    }
    return { mutated: record };
  }

  createManifest(generatorId: string, seed: number, totalRecords: number, errors: ErrorManifest["errors"]): ErrorManifest {
    return {
      generatorId,
      seed,
      totalRecords,
      generatedAt: new Date().toISOString(),
      errors,
    };
  }
}

export const universalStrategies: CorruptionStrategyDef[] = [
  {
    id: "overlength-field",
    description: "Expand a field beyond typical parser limits",
    applicableTo: ["*"],
    defaultWeight: 3,
    mutate(record, rng) {
      const sepMatch = record.match(/[|*+,]/);
      if (!sepMatch) return null;
      const sep = sepMatch[0];
      const parts = record.split(sep);
      if (parts.length < 2) return null;
      const idx = rng.int(1, Math.min(parts.length - 1, 4));
      const original = parts[idx] ?? "";
      const expanded = `${original}${"X".repeat(1024 + rng.int(0, 2048))}`;
      parts[idx] = expanded;
      const mutated = parts.join(sep);
      return {
        mutated,
        error: {
          strategy: "overlength-field",
          fieldPath: `field-${idx}`,
          originalValue: original,
          injectedValue: expanded,
          description: "Expanded field length beyond typical parser limits",
        },
      };
    },
  },
  {
    id: "truncate",
    description: "Truncate record",
    applicableTo: ["*"],
    defaultWeight: 10,
    mutate(record, rng) {
      if (record.length < 10) return null;
      const pos = Math.floor(record.length * rng.float(0.2, 0.85));
      return {
        mutated: record.slice(0, pos),
        error: { strategy: "truncate", fieldPath: "record", originalValue: record, injectedValue: record.slice(0, pos), description: "Record truncated" },
      };
    },
  },
  {
    id: "null-bytes",
    description: "Inject null bytes",
    applicableTo: ["*"],
    defaultWeight: 5,
    mutate(record, rng) {
      const count = rng.int(1, 4);
      const pos = rng.int(0, Math.max(0, record.length - 1));
      const injected = `${record.slice(0, pos)}${"\x00".repeat(count)}${record.slice(pos)}`;
      return {
        mutated: injected,
        error: { strategy: "null-bytes", fieldPath: "record", originalValue: record, injectedValue: injected, description: "Inserted null bytes" },
      };
    },
  },
  {
    id: "wrong-encoding",
    description: "Insert invalid UTF-8 control range bytes",
    applicableTo: ["*"],
    defaultWeight: 6,
    mutate(record, rng) {
      const pos = rng.int(0, Math.max(0, record.length - 1));
      const b = String.fromCharCode(rng.int(0x80, 0x9f));
      const injected = `${record.slice(0, pos)}${b}${record.slice(pos)}`;
      return {
        mutated: injected,
        error: { strategy: "wrong-encoding", fieldPath: "record", originalValue: record, injectedValue: injected, description: "Inserted invalid encoding byte" },
      };
    },
  },
  {
    id: "duplicate-record",
    description: "Duplicate record bytes",
    applicableTo: ["*"],
    defaultWeight: 7,
    mutate(record) {
      const injected = `${record}${record}`;
      return {
        mutated: injected,
        error: { strategy: "duplicate-record", fieldPath: "record", originalValue: record, injectedValue: injected, description: "Duplicated record body" },
      };
    },
  },
  {
    id: "extra-whitespace",
    description: "Inject excess whitespace",
    applicableTo: ["*"],
    defaultWeight: 4,
    mutate(record, rng) {
      const idx = record.indexOf(" ");
      if (idx < 0) return null;
      const spaces = " ".repeat(rng.int(2, 10));
      const injected = `${record.slice(0, idx)}${spaces}${record.slice(idx + 1)}`;
      return {
        mutated: injected,
        error: { strategy: "extra-whitespace", fieldPath: "record", originalValue: record, injectedValue: injected, description: "Added extra spaces" },
      };
    },
  },
  {
    id: "hl7-invalid-timestamp",
    description: "Replace MSH-7 with invalid timestamp",
    applicableTo: ["hl7v2"],
    defaultWeight: 10,
    mutate(record, rng) {
      if (!record.startsWith("MSH|")) return null;
      const values = ["2024-03-15", "20241332093000", "20240315256100", "2024031509300", "", "NOTADATE"];
      const segs = record.split("\r");
      const msh = segs[0]?.split("|") ?? [];
      if (msh.length < 7) return null;
      msh[6] = rng.pick(values);
      segs[0] = msh.join("|");
      const injected = segs.join("\r");
      return { mutated: injected, error: { strategy: "hl7-invalid-timestamp", fieldPath: "MSH.7", originalValue: record, injectedValue: injected, description: "Invalid HL7 timestamp" } };
    },
  },
  {
    id: "hl7-missing-required-segment",
    description: "Remove PID or PV1 segment",
    applicableTo: ["hl7v2"],
    defaultWeight: 12,
    mutate(record, rng) {
      const segs = record.split("\r").filter(Boolean);
      const target = rng.bool(0.5) ? "PID|" : "PV1|";
      const idx = segs.findIndex((s) => s.startsWith(target));
      if (idx < 0) return null;
      const original = segs[idx]!;
      segs.splice(idx, 1);
      const mutated = `${segs.join("\r")}\r`;
      return {
        mutated,
        error: {
          strategy: "hl7-missing-required-segment",
          fieldPath: target.slice(0, 3),
          originalValue: original,
          injectedValue: "",
          description: `Removed required ${target.slice(0, 3)} segment`,
        },
      };
    },
  },
  {
    id: "hl7-wrong-segment-order",
    description: "Swap PID and PV1 segments",
    applicableTo: ["hl7v2"],
    defaultWeight: 8,
    mutate(record) {
      const segs = record.split("\r").filter(Boolean);
      const pid = segs.findIndex((s) => s.startsWith("PID|"));
      const pv1 = segs.findIndex((s) => s.startsWith("PV1|"));
      if (pid < 0 || pv1 < 0) return null;
      [segs[pid], segs[pv1]] = [segs[pv1], segs[pid]];
      const mutated = `${segs.join("\r")}\r`;
      return {
        mutated,
        error: {
          strategy: "hl7-wrong-segment-order",
          fieldPath: "PID/PV1",
          originalValue: record,
          injectedValue: mutated,
          description: "Swapped PID and PV1 segments",
        },
      };
    },
  },
  {
    id: "hl7-invalid-pid-sex",
    description: "Set PID-8 to invalid value",
    applicableTo: ["hl7v2"],
    defaultWeight: 6,
    mutate(record, rng) {
      const invalid = ["X", "1", "Male", "MALE"];
      const segs = record.split("\r").filter(Boolean);
      const pidIdx = segs.findIndex((s) => s.startsWith("PID|"));
      if (pidIdx < 0) return null;
      const f = segs[pidIdx]!.split("|");
      if (f.length < 9) return null;
      const old = f[8] ?? "";
      f[8] = rng.pick(invalid);
      segs[pidIdx] = f.join("|");
      const mutated = `${segs.join("\r")}\r`;
      return {
        mutated,
        error: {
          strategy: "hl7-invalid-pid-sex",
          fieldPath: "PID.8",
          originalValue: old,
          injectedValue: f[8]!,
          description: "Injected invalid PID-8 sex code",
        },
      };
    },
  },
  {
    id: "hl7-repeated-msh",
    description: "Duplicate MSH segment",
    applicableTo: ["hl7v2"],
    defaultWeight: 4,
    mutate(record) {
      const segs = record.split("\r").filter(Boolean);
      if (!segs[0]?.startsWith("MSH|")) return null;
      const mutated = `${segs[0]}\r${segs.join("\r")}\r`;
      return {
        mutated,
        error: {
          strategy: "hl7-repeated-msh",
          fieldPath: "MSH",
          originalValue: segs[0],
          injectedValue: mutated,
          description: "Prepended duplicated MSH segment",
        },
      };
    },
  },
  {
    id: "fix-wrong-checksum",
    description: "Corrupt FIX tag 10 checksum",
    applicableTo: ["fix"],
    defaultWeight: 10,
    mutate(record, rng) {
      const match = record.match(/(?:^|\x01)10=(\d{3})\x01/);
      if (!match) return null;
      const current = Number(match[1]);
      const next = String((current + rng.int(1, 254)) % 256).padStart(3, "0");
      const injected = record.replace(/(?:^|\x01)10=\d{3}\x01/, `${record.startsWith("10=") ? "" : "\x01"}10=${next}\x01`);
      return { mutated: injected, error: { strategy: "fix-wrong-checksum", fieldPath: "tag10", originalValue: record, injectedValue: injected, description: "Checksum altered" } };
    },
  },
  {
    id: "fix-wrong-body-length",
    description: "Alter FIX tag 9 body length",
    applicableTo: ["fix"],
    defaultWeight: 10,
    mutate(record, rng) {
      const m = record.match(/(?:^|\x01)9=(\d+)\x01/);
      if (!m) return null;
      const current = Number(m[1]);
      const delta = rng.pick([1, -1, 5, -5, 100]);
      const next = String(Math.max(0, current + delta));
      const mutated = record.replace(/(?:^|\x01)9=\d+\x01/, `${record.startsWith("9=") ? "" : "\x01"}9=${next}\x01`);
      return {
        mutated,
        error: {
          strategy: "fix-wrong-body-length",
          fieldPath: "tag9",
          originalValue: String(current),
          injectedValue: next,
          description: "Altered FIX body length",
        },
      };
    },
  },
  {
    id: "fix-missing-required-tag",
    description: "Remove required FIX tag",
    applicableTo: ["fix"],
    defaultWeight: 9,
    mutate(record, rng) {
      const required = ["11", "49", "52", "55", "56"];
      const tag = rng.pick(required);
      const re = new RegExp(`(?:^|\\x01)${tag}=[^\\x01]*\\x01`);
      if (!re.test(record)) return null;
      const mutated = record.replace(re, "\x01");
      return {
        mutated,
        error: {
          strategy: "fix-missing-required-tag",
          fieldPath: `tag${tag}`,
          originalValue: tag,
          injectedValue: "",
          description: `Removed required tag ${tag}`,
        },
      };
    },
  },
  {
    id: "x12-mismatched-control-numbers",
    description: "Set IEA-02 to mismatch ISA-13",
    applicableTo: ["x12"],
    defaultWeight: 10,
    mutate(record) {
      const m = record.match(/IEA\*1\*([0-9]+)~/);
      if (!m) return null;
      const current = m[1]!;
      const next = String(Number(current) + 1);
      const mutated = record.replace(/IEA\*1\*[0-9]+~/, `IEA*1*${next}~`);
      return {
        mutated,
        error: {
          strategy: "x12-mismatched-control-numbers",
          fieldPath: "IEA-02",
          originalValue: current,
          injectedValue: next,
          description: "Broke ISA/IEA control-number match",
        },
      };
    },
  },
  {
    id: "x12-wrong-segment-count",
    description: "Set SE-01 to wrong count",
    applicableTo: ["x12"],
    defaultWeight: 10,
    mutate(record) {
      const m = record.match(/SE\*([0-9]+)\*/);
      if (!m) return null;
      const current = Number(m[1]);
      const next = String(current + 2);
      const mutated = record.replace(/SE\*[0-9]+\*/, `SE*${next}*`);
      return {
        mutated,
        error: {
          strategy: "x12-wrong-segment-count",
          fieldPath: "SE-01",
          originalValue: String(current),
          injectedValue: next,
          description: "Broke X12 segment count",
        },
      };
    },
  },
  {
    id: "x12-isa-wrong-length",
    description: "Pad/truncate ISA away from 106 chars",
    applicableTo: ["x12"],
    defaultWeight: 8,
    mutate(record, rng) {
      const m = record.match(/ISA\*[^~]*~/);
      if (!m) return null;
      const isa = m[0];
      const mutatedIsa = rng.bool(0.5) ? `${isa}X` : isa.slice(0, Math.max(1, isa.length - 2));
      const mutated = record.replace(isa, mutatedIsa);
      return {
        mutated,
        error: {
          strategy: "x12-isa-wrong-length",
          fieldPath: "ISA",
          originalValue: isa,
          injectedValue: mutatedIsa,
          description: "Changed ISA segment away from required fixed length",
        },
      };
    },
  },
  {
    id: "ofx-imbalanced-statement",
    description: "Modify LEDGERBAL to no longer reconcile",
    applicableTo: ["ofx"],
    defaultWeight: 10,
    mutate(record, rng) {
      const m = record.match(/<BALAMT>([^<]+)<\/BALAMT>/);
      if (!m) return null;
      const current = Number(m[1]);
      const next = (current + rng.float(1, 50)).toFixed(2);
      const mutated = record.replace(/<BALAMT>[^<]+<\/BALAMT>/, `<BALAMT>${next}</BALAMT>`);
      return {
        mutated,
        error: {
          strategy: "ofx-imbalanced-statement",
          fieldPath: "LEDGERBAL.BALAMT",
          originalValue: String(current),
          injectedValue: next,
          description: "Adjusted OFX ledger balance to break reconciliation",
        },
      };
    },
  },
  {
    id: "ofx-mismatched-type-sign",
    description: "Flip sign/type consistency for debit/credit",
    applicableTo: ["ofx"],
    defaultWeight: 9,
    mutate(record) {
      if (!record.includes("<TRNTYPE>DEBIT</TRNTYPE>") && !record.includes("<TRNTYPE>CREDIT</TRNTYPE>")) return null;
      const mutated = record
        .replace(/<TRNAMT>(-?\d+(\.\d+)?)<\/TRNAMT>/, (_m, n) => `<TRNAMT>${Math.abs(Number(n)).toFixed(2)}</TRNAMT>`);
      if (mutated === record) return null;
      return {
        mutated,
        error: {
          strategy: "ofx-mismatched-type-sign",
          fieldPath: "TRNTYPE/TRNAMT",
          originalValue: record,
          injectedValue: mutated,
          description: "Forced mismatched debit/credit sign behavior",
        },
      };
    },
  },
  {
    id: "ofx-duplicate-fitid",
    description: "Duplicate an OFX FITID value",
    applicableTo: ["ofx"],
    defaultWeight: 8,
    mutate(record) {
      const ids = [...record.matchAll(/<FITID>([^<]+)<\/FITID>/g)];
      if (ids.length < 2) return null;
      const first = ids[0]![1]!;
      const second = ids[1]![1]!;
      const mutated = record.replace(`<FITID>${second}</FITID>`, `<FITID>${first}</FITID>`);
      return {
        mutated,
        error: {
          strategy: "ofx-duplicate-fitid",
          fieldPath: "FITID",
          originalValue: second,
          injectedValue: first,
          description: "Duplicated FITID to break uniqueness",
        },
      };
    },
  },
  {
    id: "swift-invalid-amount",
    description: "Use dot decimal in :32A: instead of comma",
    applicableTo: ["swift-mt"],
    defaultWeight: 9,
    mutate(record) {
      if (!record.includes(":32A:")) return null;
      const mutated = record.replace(/:32A:([0-9]{6}[A-Z]{3}[0-9]+),([0-9]{2})/, ":32A:$1.$2");
      if (mutated === record) return null;
      return {
        mutated,
        error: {
          strategy: "swift-invalid-amount",
          fieldPath: ":32A:",
          originalValue: record,
          injectedValue: mutated,
          description: "Changed SWIFT decimal separator to dot",
        },
      };
    },
  },
  {
    id: "swift-invalid-bic",
    description: "Inject invalid SWIFT BIC format",
    applicableTo: ["swift-mt"],
    defaultWeight: 8,
    mutate(record) {
      if (!record.includes("{1:")) return null;
      const mutated = record.replace(/([A-Z]{8})([A-Z]{3})?/, "INVALID1");
      if (mutated === record) return null;
      return {
        mutated,
        error: {
          strategy: "swift-invalid-bic",
          fieldPath: "BIC",
          originalValue: record,
          injectedValue: mutated,
          description: "Replaced BIC with invalid value",
        },
      };
    },
  },
  {
    id: "swift-missing-mandatory-field",
    description: "Remove mandatory block 4 field tag",
    applicableTo: ["swift-mt"],
    defaultWeight: 9,
    mutate(record, rng) {
      const fields = [":20:", ":32A:", ":71A:"];
      const field = rng.pick(fields);
      const re = new RegExp(`${field}[^\\n\\r]*\\n?`, "m");
      if (!re.test(record)) return null;
      const mutated = record.replace(re, "");
      return {
        mutated,
        error: {
          strategy: "swift-missing-mandatory-field",
          fieldPath: field,
          originalValue: field,
          injectedValue: "",
          description: `Removed mandatory SWIFT field ${field}`,
        },
      };
    },
  },
  {
    id: "swift-forbidden-character",
    description: "Inject forbidden character into :70: field",
    applicableTo: ["swift-mt"],
    defaultWeight: 7,
    mutate(record, rng) {
      if (!record.includes(":70:")) return null;
      const bad = rng.pick(["&", "<", "_", "@"]);
      const mutated = record.replace(/:70:([^\n\r-]+)/, (_m, v) => `:70:${v}${bad}`);
      if (mutated === record) return null;
      return {
        mutated,
        error: {
          strategy: "swift-forbidden-character",
          fieldPath: ":70:",
          originalValue: record,
          injectedValue: mutated,
          description: "Injected forbidden SWIFT character",
        },
      };
    },
  },
  {
    id: "cdr-answered-zero-duration",
    description: "Set ANSWERED call duration to 0",
    applicableTo: ["cdr"],
    defaultWeight: 10,
    mutate(record) {
      if (!record.includes(",ANSWERED,")) return null;
      const cols = record.split(",");
      if (cols.length < 13) return null;
      cols[9] = "0";
      cols[10] = "0";
      const mutated = cols.join(",");
      return {
        mutated,
        error: {
          strategy: "cdr-answered-zero-duration",
          fieldPath: "duration",
          originalValue: record,
          injectedValue: mutated,
          description: "Forced ANSWERED call to zero duration",
        },
      };
    },
  },
  {
    id: "cdr-future-timestamp",
    description: "Set CDR timestamp into far future",
    applicableTo: ["cdr"],
    defaultWeight: 7,
    mutate(record) {
      const mutated = record.replace(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/, "2099-01-01 00:00:00");
      if (mutated === record) return null;
      return {
        mutated,
        error: {
          strategy: "cdr-future-timestamp",
          fieldPath: "calldate",
          originalValue: record,
          injectedValue: mutated,
          description: "Moved CDR timestamp into future",
        },
      };
    },
  },
  {
    id: "cdr-invalid-imei",
    description: "Break IMEI Luhn check by incrementing final digit",
    applicableTo: ["cdr"],
    defaultWeight: 8,
    mutate(record) {
      const m = record.match(/(\b\d{14})(\d)\b/);
      if (!m) return null;
      const nextDigit = String((Number(m[2]) + 1) % 10);
      const broken = `${m[1]}${nextDigit}`;
      const mutated = record.replace(m[0], broken);
      return {
        mutated,
        error: {
          strategy: "cdr-invalid-imei",
          fieldPath: "imei",
          originalValue: m[0],
          injectedValue: broken,
          description: "Altered IMEI check digit",
        },
      };
    },
  },
];

