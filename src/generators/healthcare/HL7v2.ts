import { FieldProvider } from "../../core/FieldProvider.js";
import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";
import { RNG } from "../../core/RNG.js";
import { toHL7Date, toHL7DateTime } from "../../core/TemporalEngine.js";

export class HL7v2Generator implements IGenerator {
  readonly id = "hl7v2";
  readonly description = "HL7 v2 ADT/ORU/ORM messages";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0, extras: { messageTypes: ["ADT_A01"], version: "2.5.1" } };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const rng = new RNG(options.seed);
    const fp = new FieldProvider(rng);
    const messageTypes = (options.extras.messageTypes as string[] | undefined) ?? ["ADT_A01", "ORU_R01", "ORM_O01"];
    const batchMode = Boolean(options.extras.batchMode ?? false);
    if (batchMode) {
      yield "FHS|^~\\&|SYNTHED|LAB|RECV|DEST|20260101000000\r";
      yield "BHS|^~\\&|SYNTHED|LAB|RECV|DEST|20260101000000\r";
    }
    for (let i = 0; i < options.recordCount; i += 1) {
      const msgType = messageTypes[i % messageTypes.length]!;
      const now = new Date(Date.UTC(2026, 0, 1, 12, 0, i % 60));
      const msh9 = msgType === "ADT_A01" ? "ADT^A01^ADT_A01" : msgType === "ORU_R01" ? "ORU^R01^ORU_R01" : "ORM^O01^ORM_O01";
      const msh = `MSH|^~\\&|${fp.hl7SendingApp()}|${fp.hl7Facility()}|RECV|DEST|${toHL7DateTime(now)}||${msh9}|${fp.messageControlId()}|P|${(options.extras.version as string) ?? "2.5.1"}`;
      const pid3 = `${fp.mrn()}^^^HOSPITAL^MR~${rng.int(100000000, 999999999)}^^^SSN^SS`;
      const dobVariants = [toHL7Date(new Date(Date.UTC(1975, 3, 4))), `${toHL7Date(new Date(Date.UTC(1975, 3, 4)))}000000`, "1975"];
      const pid = `PID|1||${pid3}||${fp.lastName()}^${fp.firstName()}^^^||${dobVariants[i % dobVariants.length]}|${fp.sex()}|||123 Main^^City^ST^12345${rng.bool(0.7) ? "^US" : ""}`;
      const pv1 = "PV1|1|I|W^389^1^UABH||||12345^TEST^DOC";
      const obxType = rng.pick(["NM", "ST", "CWE"]);
      const obxValue = obxType === "NM" ? `${fp.labResult({ low: 36, high: 52 })}` : obxType === "ST" ? "Normal" : "4544-3^Hematocrit^LN";
      const obx = `OBX|1|${obxType}|4544-3^Hematocrit^LN||${obxValue}|%|36-52|N|||${rng.pick(["F", "P", "C"])}`;
      const pd1 = rng.bool(0.6) ? "PD1|||PRIMARYCARE^^^^^NPI" : "";
      const nk1 = rng.bool(0.5) ? `NK1|1|${fp.lastName()}^${fp.firstName()}|SPO` : "";
      const z = rng.bool(0.8) ? "ZXT|1|\\F\\escaped\\S\\value\\R\\demo" : "";
      if (msgType === "ORU_R01") {
        yield `${msh}\r${pid}\r${pd1 ? `${pd1}\r` : ""}${pv1}\rOBR|1|||LAB\r${obx}\r${rng.bool(0.2) ? "NTE|1|L|Note\r" : ""}${z ? `${z}\r` : ""}`;
      } else if (msgType === "ORM_O01") {
        yield `${msh}\r${pid}\r${pd1 ? `${pd1}\r` : ""}${pv1}\rORC|NW\rOBR|1|||LAB\r${obx}\r${rng.bool(0.2) ? "NTE|1|L|Order note\r" : ""}${z ? `${z}\r` : ""}`;
      } else {
        yield `${msh}\r${pid}\r${pd1 ? `${pd1}\r` : ""}${nk1 ? `${nk1}\r` : ""}${pv1}\r${obx}\r${rng.bool(0.35) ? "AL1|1||^PENICILLIN\r" : ""}${rng.bool(0.6) ? "DG1|1||I10\r" : ""}${z ? `${z}\r` : ""}`;
      }
    }
    if (batchMode) {
      yield `BTS|${options.recordCount}\r`;
      yield "FTS|1\r";
    }
  }
}

