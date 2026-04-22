import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";

export class X12Generator implements IGenerator {
  readonly id = "x12";
  readonly description = "X12 EDI generator";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0, extras: { transaction: "837P" } };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const sender = String(options.extras.senderISAId ?? "SENDERID").padEnd(15, " ").slice(0, 15);
    const receiver = String(options.extras.receiverISAId ?? "RECEIVERID").padEnd(15, " ").slice(0, 15);
    const usage = String(options.extras.usageIndicator ?? "T");
    for (let i = 0; i < options.recordCount; i += 1) {
      const ctrl = String(100000000 + i);
      const isa = `ISA*00*          *00*          *ZZ*${sender}*ZZ*${receiver}*260421*1200*^*00501*${ctrl}*0*${usage}*:~`;
      const st = `ST*837*${ctrl.slice(-4)}~`;
      const hl1 = "HL*1**20*1~";
      const hl2 = "HL*2*1*22*0~";
      const clm = "CLM*CLM0001*100***11:B:1*Y*A*Y*I~";
      const sv1 = "SV1*HC:99213*100*UN*1***1~";
      const payload = `NM1*85*2*BILLING*****XX*1234567893~NM1*IL*1*DOE*JOHN****MI*123456~${hl1}${hl2}${clm}${sv1}`;
      const segCount = payload.split("~").filter(Boolean).length + 2;
      yield `${isa}GS*HC*SENDER*RECV*20260421*1200*1*X*005010X222A1~${st}${payload}SE*${segCount}*${ctrl.slice(-4)}~GE*1*1~IEA*1*${ctrl}~\n`;
    }
  }
}

