import { FieldProvider } from "../../core/FieldProvider.js";
import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";
import { RNG } from "../../core/RNG.js";

export class CDRGenerator implements IGenerator {
  readonly id = "cdr";
  readonly description = "Call detail records";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0 };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const rng = new RNG(options.seed);
    const fp = new FieldProvider(rng);
    const format = String(options.extras.format ?? "asterisk-csv");
    if (format === "asn1-ber") {
      const encodeTlv = (tag: number, value: string): string => {
        const valHex = Buffer.from(value, "utf8").toString("hex").toUpperCase();
        const len = (valHex.length / 2).toString(16).padStart(2, "0").toUpperCase();
        const t = tag.toString(16).padStart(2, "0").toUpperCase();
        return `${t}${len}${valHex}`;
      };
      const seqWrap = (hexPayload: string): string => {
        const len = (hexPayload.length / 2).toString(16).padStart(2, "0").toUpperCase();
        return `30${len}${hexPayload}`;
      };
      for (let i = 0; i < options.recordCount; i += 1) {
        const duration = Math.max(0, Math.min(7200, fp.callDurationSeconds()));
        const disp = fp.callDisposition(duration);
        const src = fp.e164Phone("+44");
        const tlv = [
          encodeTlv(0x80, `${options.seed}`),
          encodeTlv(0x81, `${i}`),
          encodeTlv(0x82, `${duration}`),
          encodeTlv(0x83, disp),
          encodeTlv(0x84, fp.imei()),
          encodeTlv(0x85, fp.imsi("234", "10")),
          encodeTlv(0x86, src),
        ].join("");
        yield `${seqWrap(tlv)}\n`;
      }
      return;
    }
    yield "calldate,clid,src,dst,dcontext,channel,dstchannel,lastapp,lastdata,duration,billsec,disposition,amaflags,uniqueid\n";
    for (let i = 0; i < options.recordCount; i += 1) {
      const duration = fp.callDurationSeconds();
      const disp = fp.callDisposition(duration);
      const d = disp === "ANSWERED" ? Math.max(1, duration) : 0;
      // Weighted hour profile: business + residential evening, low overnight.
      const hour = rng.weightedPick([
        { value: rng.int(9, 16), weight: 45 },
        { value: rng.int(17, 21), weight: 35 },
        { value: rng.int(6, 8), weight: 12 },
        { value: rng.int(0, 5), weight: 8 },
      ]);
      const minute = String(rng.int(0, 59)).padStart(2, "0");
      const second = String(rng.int(0, 59)).padStart(2, "0");
      const calldate = `2026-04-21 ${String(hour).padStart(2, "0")}:${minute}:${second}`;
      const imei = fp.imei();
      const imsi = fp.imsi("234", "10");
      const src = fp.e164Phone("+44");
      const dst = fp.e164Phone("+44");
      yield `${calldate},"Caller",${src},${dst},from-internal,SIP/a,SIP/b,Dial,,${d},${d},${disp},DOCUMENTATION,${imei}|${imsi}|${options.seed}.${i}\n`;
    }
  }
}

