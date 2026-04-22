import { FIXProtocolGenerator } from "../generators/finance/FIXProtocol.js";
import { OFXGenerator } from "../generators/finance/OFX.js";
import { SWIFTMTGenerator } from "../generators/finance/SWIFT_MT.js";
import { EDIFACTGenerator } from "../generators/edi/EDIFACT.js";
import { X12Generator } from "../generators/edi/X12.js";
import { FHIRR4Generator } from "../generators/healthcare/FHIR_R4.js";
import { HL7v2Generator } from "../generators/healthcare/HL7v2.js";
import { ApacheAccessLogGenerator } from "../generators/logs/ApacheAccessLog.js";
import { SyslogRFC5424Generator } from "../generators/logs/SyslogRFC5424.js";
import { WindowsEventLogGenerator } from "../generators/logs/WindowsEventLog.js";
import { CDRGenerator } from "../generators/telecom/CDR.js";
import { FIXValidator } from "../validators/FIXValidator.js";
import { HL7v2Validator } from "../validators/HL7v2Validator.js";
import { OFXValidator } from "../validators/OFXValidator.js";
import { X12Validator } from "../validators/X12Validator.js";
import { SWIFTValidator } from "../validators/SWIFTValidator.js";
import { CDRValidator } from "../validators/CDRValidator.js";
import { Registry } from "./Registry.js";

export function createDefaultRegistry(): Registry {
  const r = new Registry();
  [new ApacheAccessLogGenerator(), new HL7v2Generator(), new FIXProtocolGenerator(), new OFXGenerator(), new X12Generator(), new EDIFACTGenerator(), new SWIFTMTGenerator(), new CDRGenerator(), new SyslogRFC5424Generator(), new WindowsEventLogGenerator(), new FHIRR4Generator()].forEach((g) => r.registerGenerator(g));
  [new HL7v2Validator(), new FIXValidator(), new OFXValidator(), new X12Validator(), new SWIFTValidator(), new CDRValidator()].forEach((v) => r.registerValidator(v));
  return r;
}

