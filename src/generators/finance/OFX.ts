import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";
import { RNG } from "../../core/RNG.js";

export class OFXGenerator implements IGenerator {
  readonly id = "ofx";
  readonly description = "OFX 1.x/2.x bank statements";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0, extras: { format: "2x", openingBalance: 1000 } };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const rng = new RNG(options.seed);
    const opening = Number(options.extras.openingBalance ?? 1000);
    let sum = 0;
    const format = String(options.extras.format ?? "2x");
    const dtStart = "20260101";
    const dtEnd = "20260131";
    const tx = Array.from({ length: options.recordCount }, (_, i) => {
      const amt = parseFloat((rng.bool(0.72) ? -rng.float(5, 150) : rng.float(5, 300)).toFixed(2));
      sum += amt;
      const dt = `202601${String((i % 28) + 1).padStart(2, "0")}`;
      return `<STMTTRN><TRNTYPE>${amt < 0 ? "DEBIT" : "CREDIT"}</TRNTYPE><DTPOSTED>${dt}</DTPOSTED><TRNAMT>${amt.toFixed(2)}</TRNAMT><FITID>20260101-${String(i).padStart(6, "0")}</FITID></STMTTRN>`;
    }).join("");
    if (format === "1x") {
      yield `OFXHEADER:100\nDATA:OFXSGML\nVERSION:151\n\n<OFX>\n<SIGNONMSGSRSV1>\n<STMTRS>\n<OPENINGBAL>${opening.toFixed(2)}\n<BANKTRANLIST>\n<DTSTART>${dtStart}\n<DTEND>${dtEnd}\n${tx}\n<LEDGERBAL>\n<BALAMT>${(opening + sum).toFixed(2)}\n`;
    } else {
      yield `<?xml version="1.0"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><OPENINGBAL>${opening.toFixed(2)}</OPENINGBAL><BANKTRANLIST><DTSTART>${dtStart}</DTSTART><DTEND>${dtEnd}</DTEND>${tx}</BANKTRANLIST><LEDGERBAL><BALAMT>${(opening + sum).toFixed(2)}</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n`;
    }
  }
}

